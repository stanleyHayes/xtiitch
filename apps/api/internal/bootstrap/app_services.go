package bootstrap

import (
	"context"
	"log/slog"
	"strings"
	"time"

	aiadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/ai"
	authadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/auth"
	botcatalogueadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/botcatalogue"
	emailadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/email"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/postgres"
	smsadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/sms"
	whatsappadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/whatsapp"
	aiassistapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aiassist"
	aisearchapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aisearch"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	whatsappbotapp "github.com/xcreativs/xtiitch/apps/api/internal/application/whatsappbot"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/clock"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/ids"

	"github.com/jackc/pgx/v5/pgxpool"
)

// buildAISearchService wires the marketplace semantic-search service and kicks
// off a non-blocking embedding backfill. Both AI hops degrade to deterministic,
// key-free dev implementations (mirrors the Paystack/Cloudinary dev fallbacks):
//   - embeddings: hosted model when OPENAI_API_KEY is set, else a hashing embedder
//   - query understanding: Claude when ANTHROPIC_API_KEY is set, else a heuristic
func buildAISearchService(cfg config.Config, logger *slog.Logger, db *pgxpool.Pool) aisearchapp.Service {
	var embedder ports.Embedder
	if cfg.OpenAIAPIKey != "" {
		embedder = aiadapter.NewOpenAIEmbedder(cfg.OpenAIAPIKey, cfg.OpenAIEmbeddingModel)
	} else {
		logger.Warn("openai api key not set; using dev embedder for AI search")
		embedder = aiadapter.NewDevEmbedder()
	}

	var queryParser ports.QueryParser
	if cfg.AnthropicAPIKey != "" {
		queryParser = aiadapter.NewClaudeQueryParser(cfg.AnthropicAPIKey, cfg.AnthropicQueryModel)
	} else {
		logger.Warn("anthropic api key not set; using heuristic query parser for AI search")
		queryParser = aiadapter.NewHeuristicQueryParser()
	}

	service := aisearchapp.NewService(aisearchapp.Dependencies{
		Embedder: embedder,
		Repo:     postgres.NewEmbeddingRepository(db),
		Parser:   queryParser,
		Usage:    postgres.NewSearchUsageRepository(db),
		Clock:    clock.SystemClock{},
	})

	// Backfill embeddings in the background so the catalogue is searchable shortly
	// after boot without blocking startup. Safe to run repeatedly; it only embeds
	// designs whose content changed.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		embedded, err := service.Backfill(ctx, 500)
		if err != nil {
			logger.Warn("ai search backfill failed", "error", err)
			return
		}
		if embedded > 0 {
			logger.Info("ai search backfill complete", "embedded", embedded, "model", embedder.Model())
		}
	}()

	return service
}

// buildAIAssistService wires the ✨ AI writing assistant (a paid add-on billed
// separately from a business's plan). The assist call uses Claude when
// ANTHROPIC_API_KEY is set, reusing the same key + model as AI search; with no
// key the ClaudeAssistant degrades to returning the input text unchanged, so the
// endpoint stays exercisable locally. The add-on entitlement check is always
// tenant-scoped via the business_addons repository.
func buildAIAssistService(
	cfg config.Config,
	logger *slog.Logger,
	db *pgxpool.Pool,
	payments ports.PaymentProvider,
) aiassistapp.Service {
	assistantEnabled := cfg.AnthropicAPIKey != ""
	if !assistantEnabled {
		logger.Warn("anthropic api key not set; AI assistant returns input unchanged " +
			"— the paid add-on is DISABLED (not sellable) on this deployment")
	}
	return aiassistapp.NewService(aiassistapp.Dependencies{
		Assistant:        aiadapter.NewClaudeAssistant(cfg.AnthropicAPIKey, cfg.AnthropicQueryModel),
		Addons:           postgres.NewBusinessAddonRepository(db),
		Payments:         payments,
		Settings:         postgres.NewPlatformSettingsReader(db),
		IDs:              ids.UUIDGenerator{},
		Clock:            clock.SystemClock{},
		PriceMinor:       int64(cfg.AIAssistantAddonPriceMinor),
		Currency:         "GHS",
		AssistantEnabled: assistantEnabled,
	})
}

// buildWhatsAppBotService wires the inbound WhatsApp bot's conversation engine.
// Replies go through the Cloud API when WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_ACCESS_TOKEN are set, else a logging sender (dev fallback) so the
// engine is fully exercisable locally.
func buildWhatsAppBotService(
	cfg config.Config,
	logger *slog.Logger,
	db *pgxpool.Pool,
	checkout botcatalogueadapter.CheckoutPlacer,
) whatsappbotapp.Service {
	var sender ports.WhatsAppSender
	if cfg.WhatsAppPhoneNumberID != "" && cfg.WhatsAppAccessToken != "" {
		sender = whatsappadapter.NewCloudSender(cfg.WhatsAppPhoneNumberID, cfg.WhatsAppAccessToken, cfg.WhatsAppGraphVersion)
	} else {
		logger.Warn("whatsapp cloud credentials not set; bot replies will be logged only")
		sender = whatsappadapter.NewLoggingSender(logger)
	}

	repo := postgres.NewWhatsAppRepository(db)
	catalogue := botcatalogueadapter.New(
		postgres.NewStorefrontRepository(db),
		postgres.NewOrderRepository(db),
		checkout,
	)
	return whatsappbotapp.NewService(whatsappbotapp.Dependencies{
		Sessions:       repo,
		Dedupe:         repo,
		Sender:         sender,
		Catalogue:      catalogue,
		Clock:          clock.SystemClock{},
		StorefrontBase: cfg.StorefrontBaseURL,
	})
}

// buildCustomerOTPDelivery selects the auth-OTP channel for BOTH customers and
// store owners. The platform standard is SMS (OTP_CHANNEL=sms, the default):
// codes go over SMS (Arkesel) when a key is set. If SMS is unavailable or
// OTP_CHANNEL=whatsapp, it falls back to WhatsApp (Cloud API); with neither
// configured it logs the code (dev), so sign-in stays exercisable locally.
func buildCustomerOTPDelivery(cfg config.Config, logger *slog.Logger) ports.CustomerOTPDelivery {
	smsConfigured := cfg.SMSArkeselAPIKey != ""
	whatsAppConfigured := cfg.WhatsAppPhoneNumberID != "" && cfg.WhatsAppAccessToken != ""
	preferSMS := !strings.EqualFold(strings.TrimSpace(cfg.OTPChannel), "whatsapp")

	if preferSMS && smsConfigured {
		logger.Info("customer/owner OTP channel: SMS (Arkesel)", slog.String("sender_id", cfg.SMSSenderID))
		return authadapter.NewSMSOTPDelivery(
			smsadapter.NewArkeselSender(cfg.SMSArkeselAPIKey, cfg.SMSSenderID, cfg.SMSArkeselEndpoint),
		)
	}
	if whatsAppConfigured {
		if cfg.WhatsAppOTPTemplateName == "" {
			logger.Warn("WHATSAPP_OTP_TEMPLATE_NAME not set; OTPs send as free-form text, " +
				"which WhatsApp only delivers inside a 24h session " +
				"— set an approved AUTHENTICATION template for cold sign-ups")
		}
		logger.Info("customer/owner OTP channel: WhatsApp (Cloud API)")
		return authadapter.NewWhatsAppOTPDelivery(
			whatsappadapter.NewCloudSender(cfg.WhatsAppPhoneNumberID, cfg.WhatsAppAccessToken, cfg.WhatsAppGraphVersion),
			cfg.WhatsAppOTPTemplateName,
			cfg.WhatsAppOTPTemplateLang,
		)
	}
	if preferSMS && !smsConfigured {
		logger.Warn("OTP_CHANNEL=sms but ARKESEL_API_KEY not set and no WhatsApp creds; OTPs will be logged, not sent")
	} else {
		logger.Warn("no OTP delivery configured (SMS/WhatsApp); OTPs will be logged, not sent")
	}
	return authadapter.NewLoggingOTPDelivery(logger)
}

// buildCustomerEmailOTPDelivery emails customer sign-in codes via Resend when a
// key is configured; otherwise NewResendSender returns nil and the email
// delivery logs the code (dev), so email sign-in is exercisable locally with no
// provider key.
func buildCustomerEmailOTPDelivery(cfg config.Config, logger *slog.Logger) ports.CustomerEmailOTPDelivery {
	sender := emailadapter.NewResendSender(cfg.ResendAPIKey, cfg.ResendFromEmail)
	if sender == nil {
		logger.Warn("resend not configured; customer email OTPs will be logged, not sent")
	}
	return authadapter.NewEmailOTPDelivery(sender, logger)
}
