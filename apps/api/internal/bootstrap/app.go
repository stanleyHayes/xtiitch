package bootstrap

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	httpadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http"
	adminauthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/adminauth"
	aiassisthttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/aiassist"
	aisearchhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/aisearch"
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	availabilityhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/availability"
	bookinghttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/booking"
	cataloguehttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/catalogue"
	checkouthttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/checkout"
	customerauthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/customerauth"
	deliveryhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/delivery"
	growthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/growth"
	marketinghttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/marketing"
	measurementhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/measurement"
	mediahttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/media"
	notificationhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/notification"
	orderhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/order"
	paymentshttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/payments"
	whatsapphttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/whatsapp"
	aiadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/ai"
	authadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/auth"
	botcatalogueadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/botcatalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/cloudinary"
	emailadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/email"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/paystack"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/postgres"
	smsadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/sms"
	whatsappadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/whatsapp"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	aiassistapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aiassist"
	aisearchapp "github.com/xcreativs/xtiitch/apps/api/internal/application/aisearch"
	authapp "github.com/xcreativs/xtiitch/apps/api/internal/application/auth"
	availabilityapp "github.com/xcreativs/xtiitch/apps/api/internal/application/availability"
	bookingapp "github.com/xcreativs/xtiitch/apps/api/internal/application/booking"
	catalogueapp "github.com/xcreativs/xtiitch/apps/api/internal/application/catalogue"
	checkoutapp "github.com/xcreativs/xtiitch/apps/api/internal/application/checkout"
	customerauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/customerauth"
	deliveryapp "github.com/xcreativs/xtiitch/apps/api/internal/application/delivery"
	growthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/growth"
	marketingapp "github.com/xcreativs/xtiitch/apps/api/internal/application/marketingwaitlist"
	measurementapp "github.com/xcreativs/xtiitch/apps/api/internal/application/measurement"
	mediaapp "github.com/xcreativs/xtiitch/apps/api/internal/application/media"
	notifyapp "github.com/xcreativs/xtiitch/apps/api/internal/application/notification"
	orderapp "github.com/xcreativs/xtiitch/apps/api/internal/application/order"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	whatsappbotapp "github.com/xcreativs/xtiitch/apps/api/internal/application/whatsappbot"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/clock"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/ids"

	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	httpServer *http.Server
	db         *pgxpool.Pool
}

func New(ctx context.Context, cfg config.Config, logger *slog.Logger) (App, error) {
	// Refuse to start in production with insecure dev defaults or stub providers.
	if err := validateProductionConfig(cfg); err != nil {
		return App{}, err
	}

	adminBootstrapUsers, err := adminBootstrapCommands(cfg)
	if err != nil {
		return App{}, err
	}

	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return App{}, err
	}
	if err := db.Ping(ctx); err != nil {
		db.Close()
		return App{}, err
	}

	jwtIssuer, err := authadapter.NewJWTIssuer(cfg.JWTSigningKey, cfg.JWTIssuer, cfg.JWTAudience)
	if err != nil {
		db.Close()
		return App{}, err
	}

	// MFA secrets are encrypted at rest. Prefer a dedicated key; fall back to the
	// JWT signing key so local dev needs no extra config.
	mfaEncryptionKey := cfg.MFAEncryptionKey
	if mfaEncryptionKey == "" {
		mfaEncryptionKey = cfg.JWTSigningKey
	}
	totpManager := authadapter.NewTOTPManager(cfg.MFAIssuer, mfaEncryptionKey)

	var paymentProvider ports.PaymentProvider
	if cfg.PaystackSecretKey != "" {
		paymentProvider = paystack.NewClient(cfg.PaystackSecretKey, cfg.PaystackWebhookKey)
	} else {
		// No live key: deterministic dev provider with real webhook-signature
		// verification, so the money path runs locally and in tests.
		logger.Warn("paystack secret key not set; using dev payment provider")
		paymentProvider = paystack.NewDevProvider(cfg.PaystackWebhookKey)
	}

	businessIdentityRepo := postgres.NewBusinessIdentityRepository(db)
	authService := authapp.NewService(authapp.Dependencies{
		Businesses:    businessIdentityRepo,
		Payments:      paymentProvider,
		Sessions:      postgres.NewAuthSessionRepository(db),
		Passwords:     authadapter.NewBcryptPasswordHasher(0),
		AccessTokens:  jwtIssuer,
		RefreshTokens: authadapter.NewRefreshTokenIssuer(),
		Emails:        emailadapter.NewResendSender(cfg.ResendAPIKey, cfg.ResendFromEmail),
		Resets:        businessIdentityRepo,
		DashboardURL:  cfg.BusinessDashboardBaseURL,
		IDs:           ids.UUIDGenerator{},
		Clock:         clock.SystemClock{},
		MFA:           postgres.NewMFARepository(db),
		MFASecrets:    totpManager,
		MFAChallenges: jwtIssuer,
		MFAVerifier:   jwtIssuer,
		// WhatsApp one-time-code sign-in: the same business identity repo backs
		// the challenge store + handle/number lookup, reusing the customer OTP
		// generator and WhatsApp delivery (Cloud when creds are set, else logged).
		WhatsAppAuth: businessIdentityRepo,
		OTPGen:       authadapter.NewCustomerOTPGenerator(),
		WhatsAppOTP:  buildCustomerOTPDelivery(cfg, logger),
		// Optional subscription discount-code redemption at checkout (admins CRUD the
		// codes; this validates + applies one at authorization/verify).
		Discounts: postgres.NewSubscriptionDiscountRepository(db),
		// VAT on subscription charges (Pricing Book tax decision flag). Default
		// rate 0 = disabled; set XTIITCH_SUBSCRIPTION_VAT_RATE_BPS=2000 for Ghana 20%.
		VATRateBps:   cfg.SubscriptionVATRateBps,
		VATInclusive: cfg.SubscriptionVATInclusive,
		Logger:       logger,
	})

	authenticator := authhttp.NewAuthenticator(jwtIssuer)
	adminAuthRepository := postgres.NewAdminAuthRepository(db)

	var mediaStore ports.MediaStore
	if cfg.CloudinaryURL != "" {
		client, mediaErr := cloudinary.NewClientFromURL(cfg.CloudinaryURL)
		if mediaErr != nil {
			db.Close()
			return App{}, mediaErr
		}
		mediaStore = client
	} else {
		logger.Warn("cloudinary url not set; using dev media store")
		mediaStore = cloudinary.NewDevMediaStore()
	}

	adminAuthService := adminauthapp.NewService(adminauthapp.Dependencies{
		Users:         adminAuthRepository,
		Sessions:      adminAuthRepository,
		Audits:        adminAuthRepository,
		Businesses:    adminAuthRepository,
		Media:         mediaStore,
		Payments:      paymentProvider,
		Passwords:     authadapter.NewBcryptPasswordHasher(0),
		AccessTokens:  jwtIssuer,
		RefreshTokens: authadapter.NewRefreshTokenIssuer(),
		IDs:           ids.UUIDGenerator{},
		Clock:         clock.SystemClock{},
		Readiness:     adminLaunchReadinessConfig(cfg),
		// True IFF WhatsApp Cloud creds are configured to actually SEND customer
		// OTPs (same condition as buildCustomerOTPDelivery). The public branding
		// endpoint surfaces this so storefronts can gate the WhatsApp sign-in tab.
		WhatsAppEnabled: cfg.WhatsAppPhoneNumberID != "" && cfg.WhatsAppAccessToken != "",
		// SMS (Arkesel) is configured to send OTPs — phone sign-in works over SMS.
		SMSEnabled: cfg.SMSArkeselAPIKey != "",
		// Applies subscription downgrades scheduled for period end (from the
		// self-serve plan-change flow) at the top of each recurring sweep, so a
		// downgraded subscription renews on the new plan.
		PlanChanges: businessIdentityRepo,
		// Same VAT policy as the activation path, so renewal charges match.
		VATRateBps:   cfg.SubscriptionVATRateBps,
		VATInclusive: cfg.SubscriptionVATInclusive,
	})
	for _, command := range adminBootstrapUsers {
		adminUser, err := adminAuthService.BootstrapAdmin(ctx, command)
		if err != nil {
			db.Close()
			return App{}, err
		}
		logger.Info("admin bootstrap user ensured", "email", adminUser.Email, "role", adminUser.Role)
	}
	adminAuthenticator := adminauthhttp.NewAuthenticator(jwtIssuer)

	paymentService := paymentsapp.NewService(paymentsapp.Dependencies{
		Provider:   paymentProvider,
		Payments:   postgres.NewPaymentRepository(db),
		Businesses: postgres.NewBusinessChargeRepository(db),
		IDs:        ids.UUIDGenerator{},
	})

	promotionRepository := postgres.NewPromotionRepository(db)

	catalogueService := catalogueapp.NewService(catalogueapp.Dependencies{
		Catalogue:  postgres.NewCatalogueRepository(db),
		Storefront: postgres.NewStorefrontRepository(db),
		Settings:   postgres.NewStoreSettingsRepository(db),
		Promotions: promotionRepository,
		Waitlist:   postgres.NewDesignWaitlistRepository(db),
		IDs:        ids.UUIDGenerator{},
	})

	mediaService := mediaapp.NewService(mediaStore)

	orderService := orderapp.NewService(orderapp.Dependencies{
		Orders:   postgres.NewOrderRepository(db),
		Payments: paymentService,
		IDs:      ids.UUIDGenerator{},
	})

	availabilityService := availabilityapp.NewService(availabilityapp.Dependencies{
		Availability: postgres.NewAvailabilityRepository(db),
		Storefront:   postgres.NewStorefrontRepository(db),
		IDs:          ids.UUIDGenerator{},
	})

	bookingService := bookingapp.NewService(bookingapp.Dependencies{
		Bookings:     postgres.NewBookingRepository(db),
		Availability: availabilityService,
		IDs:          ids.UUIDGenerator{},
	})

	deliveryZoneRepository := postgres.NewDeliveryZoneRepository(db)
	deliveryService := deliveryapp.NewService(deliveryapp.Dependencies{
		Handovers: postgres.NewDeliveryRepository(db),
		Zones:     deliveryZoneRepository,
		IDs:       ids.UUIDGenerator{},
	})

	growthRepository := postgres.NewAffiliateRepository(db)
	growthService := growthapp.NewService(growthapp.Dependencies{
		Affiliates: growthRepository,
		Sponsored:  growthRepository,
		Referrals:  growthRepository,
		IDs:        ids.UUIDGenerator{},
	})

	measurementService := measurementapp.NewService(measurementapp.Dependencies{
		Measurements: postgres.NewMeasurementRepository(db),
		IDs:          ids.UUIDGenerator{},
	})

	notificationService := notifyapp.NewService(notifyapp.Dependencies{
		Messages: postgres.NewNotificationRepository(db),
	})

	checkoutService := checkoutapp.NewService(checkoutapp.Dependencies{
		Storefront:    postgres.NewStorefrontRepository(db),
		Businesses:    postgres.NewBusinessChargeRepository(db),
		Orders:        postgres.NewOrderRepository(db),
		Bookings:      postgres.NewBookingRepository(db),
		Promotions:    promotionRepository,
		Affiliates:    growthRepository,
		Referrals:     growthRepository,
		DeliveryZones: deliveryZoneRepository,
		Availability:  availabilityService,
		Payments:      paymentService,
		IDs:           ids.UUIDGenerator{},
		Logger:        logger,
	})

	customerAuthService := customerauthapp.NewService(customerauthapp.Dependencies{
		Repo:          postgres.NewCustomerAuthRepository(db),
		Tokens:        jwtIssuer,
		OTP:           authadapter.NewCustomerOTPGenerator(),
		Delivery:      buildCustomerOTPDelivery(cfg, logger),
		EmailDelivery: buildCustomerEmailOTPDelivery(cfg, logger),
		IDs:           ids.UUIDGenerator{},
		Clock:         clock.SystemClock{},
		Logger:        logger,
	})

	// Marketing waitlist: store every public lead, and email the team when Resend
	// + a recipient are configured. NewResendSender returns nil with no key, and
	// the service then skips the email step (best-effort) without failing inserts.
	marketingWaitlistService := marketingapp.NewService(marketingapp.Dependencies{
		Repo:    postgres.NewMarketingWaitlistRepository(db),
		Emails:  emailadapter.NewResendSender(cfg.ResendAPIKey, cfg.ResendFromEmail),
		IDs:     ids.UUIDGenerator{},
		EmailTo: cfg.MarketingWaitlistEmailTo,
		Logger:  logger,
	})

	aiSearchService := buildAISearchService(cfg, logger, db)
	aiAssistService := buildAIAssistService(cfg, logger, db, paymentProvider)
	whatsAppBotService := buildWhatsAppBotService(cfg, logger, db, checkoutService)

	router := httpadapter.NewRouter(logger, db.Ping,
		httpadapter.SecurityOptions{
			Production:     strings.EqualFold(cfg.Environment, "production"),
			AllowedOrigins: cfg.CORSAllowedOrigins,
			RateLimitRPS:   cfg.RateLimitRPS,
		},
		adminauthhttp.NewHandler(adminAuthService, adminAuthenticator),
		marketinghttp.NewHandler(marketingWaitlistService, adminAuthenticator),
		authhttp.NewHandler(authService, authenticator),
		customerauthhttp.NewHandler(customerAuthService, jwtIssuer),
		aisearchhttp.NewHandler(aiSearchService, jwtIssuer, cfg.JWTSigningKey),
		aiassisthttp.NewHandler(aiAssistService, authenticator),
		aiassisthttp.NewAdminHandler(aiAssistService, adminAuthenticator),
		whatsapphttp.NewHandler(whatsAppBotService, cfg.WhatsAppVerifyToken, cfg.WhatsAppAppSecret, logger),
		paymentshttp.NewHandler(paymentService, authenticator),
		cataloguehttp.NewHandler(catalogueService, authenticator),
		mediahttp.NewHandler(mediaService, authenticator),
		orderhttp.NewHandler(orderService, authenticator),
		checkouthttp.NewHandler(checkoutService),
		growthhttp.NewHandler(growthService),
		availabilityhttp.NewHandler(availabilityService, authenticator),
		bookinghttp.NewHandler(bookingService, authenticator),
		deliveryhttp.NewHandler(deliveryService, authenticator),
		measurementhttp.NewHandler(measurementService, authenticator),
		notificationhttp.NewHandler(notificationService, authenticator),
	)

	return App{
		httpServer: &http.Server{
			Addr:              cfg.HTTPAddr,
			Handler:           router,
			ReadHeaderTimeout: 5 * time.Second,
		},
		db: db,
	}, nil
}

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
	if cfg.AnthropicAPIKey == "" {
		logger.Warn("anthropic api key not set; AI assistant will return input text unchanged")
	}
	return aiassistapp.NewService(aiassistapp.Dependencies{
		Assistant:  aiadapter.NewClaudeAssistant(cfg.AnthropicAPIKey, cfg.AnthropicQueryModel),
		Addons:     postgres.NewBusinessAddonRepository(db),
		Payments:   payments,
		IDs:        ids.UUIDGenerator{},
		Clock:      clock.SystemClock{},
		PriceMinor: int64(cfg.AIAssistantAddonPriceMinor),
		Currency:   "GHS",
	})
}

// buildWhatsAppBotService wires the inbound WhatsApp bot's conversation engine.
// Replies go through the Cloud API when WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_ACCESS_TOKEN are set, else a logging sender (dev fallback) so the
// engine is fully exercisable locally.
func buildWhatsAppBotService(cfg config.Config, logger *slog.Logger, db *pgxpool.Pool, checkout botcatalogueadapter.CheckoutPlacer) whatsappbotapp.Service {
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
			logger.Warn("WHATSAPP_OTP_TEMPLATE_NAME not set; OTPs send as free-form text, which WhatsApp only delivers inside a 24h session — set an approved AUTHENTICATION template for cold sign-ups")
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

func (a App) HTTPServer() *http.Server {
	return a.httpServer
}

func (a App) Close() {
	if a.db != nil {
		a.db.Close()
	}
}

// validateProductionConfig fails fast when APP_ENV=production but the process is
// still configured with insecure dev defaults or stub providers. These fallbacks
// are deliberate conveniences for local/dev (a fake Paystack, an unsigned media
// store, a default signing key); shipping them to production would mean fake
// payment confirmations, tamperable uploads, and forgeable sessions.
func validateProductionConfig(cfg config.Config) error {
	if !strings.EqualFold(strings.TrimSpace(cfg.Environment), "production") {
		return nil
	}

	var problems []string
	if cfg.JWTSigningKey == "" || cfg.JWTSigningKey == "change-me-for-local-development" {
		problems = append(problems, "JWT_SIGNING_KEY must be a strong, non-default secret")
	}
	if cfg.MFAEncryptionKey == "" {
		problems = append(problems, "MFA_ENCRYPTION_KEY must be set (do not silently reuse the JWT signing key for MFA secrets)")
	}
	if cfg.PaystackSecretKey == "" {
		problems = append(problems, "PAYSTACK_SECRET_KEY must be set (the dev payment provider returns fake confirmations)")
	}
	if cfg.CloudinaryURL == "" {
		problems = append(problems, "CLOUDINARY_URL must be set (the dev media store issues unsigned upload signatures)")
	}
	if cfg.DatabaseURL == "" || strings.Contains(cfg.DatabaseURL, "xtiitch_app:xtiitch_app@localhost") {
		problems = append(problems, "DATABASE_URL must point at the production database, not the local default")
	}
	if strings.Contains(cfg.DatabaseURL, "sslmode=disable") {
		problems = append(problems, "DATABASE_URL must not disable TLS (sslmode=disable) in production")
	}
	// If the WhatsApp bot is enabled (verify token set), inbound webhooks must be
	// signature-verified — otherwise anyone could POST forged messages.
	if cfg.WhatsAppVerifyToken != "" && cfg.WhatsAppAppSecret == "" {
		problems = append(problems, "WHATSAPP_APP_SECRET must be set when the WhatsApp bot is enabled (inbound webhooks must be signature-verified)")
	}

	if len(problems) == 0 {
		return nil
	}
	return fmt.Errorf("refusing to start: insecure production configuration:\n  - %s", strings.Join(problems, "\n  - "))
}

type adminBootstrapUserConfig struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

func adminBootstrapCommands(cfg config.Config) ([]adminauthapp.BootstrapAdminCommand, error) {
	commands := make([]adminauthapp.BootstrapAdminCommand, 0, 1)
	if cfg.AdminBootstrapEmail != "" || cfg.AdminBootstrapPassword != "" {
		commands = append(commands, adminauthapp.BootstrapAdminCommand{
			Email:       cfg.AdminBootstrapEmail,
			DisplayName: cfg.AdminBootstrapDisplayName,
			Password:    cfg.AdminBootstrapPassword,
			Role:        admindomain.Role(cfg.AdminBootstrapRole),
		})
	}

	rawExtraUsers := strings.TrimSpace(cfg.AdminBootstrapExtraUsers)
	if rawExtraUsers == "" {
		return commands, nil
	}

	var extraUsers []adminBootstrapUserConfig
	if err := json.Unmarshal([]byte(rawExtraUsers), &extraUsers); err != nil {
		return nil, fmt.Errorf("parse ADMIN_BOOTSTRAP_EXTRA_USERS_JSON: %w", err)
	}

	for index, user := range extraUsers {
		if strings.TrimSpace(user.Email) == "" || strings.TrimSpace(user.Password) == "" {
			return nil, fmt.Errorf("ADMIN_BOOTSTRAP_EXTRA_USERS_JSON[%d] is missing email or password", index)
		}

		role := admindomain.Role(strings.TrimSpace(user.Role))
		if role == "" {
			role = admindomain.RoleOperator
		}

		displayName := strings.TrimSpace(user.DisplayName)
		if displayName == "" {
			displayName = defaultAdminDisplayName(role)
		}

		commands = append(commands, adminauthapp.BootstrapAdminCommand{
			Email:       user.Email,
			DisplayName: displayName,
			Password:    user.Password,
			Role:        role,
		})
	}

	return commands, nil
}

func adminLaunchReadinessConfig(cfg config.Config) adminauthapp.AdminLaunchReadinessConfig {
	notificationTransport := strings.TrimSpace(cfg.NotificationTransport)
	if notificationTransport == "" {
		notificationTransport = "log"
	}
	return adminauthapp.AdminLaunchReadinessConfig{
		Environment: strings.TrimSpace(cfg.Environment),
		AdminBootstrapOwnerConfigured: strings.TrimSpace(cfg.AdminBootstrapEmail) != "" &&
			strings.TrimSpace(cfg.AdminBootstrapPassword) != "",
		CloudinaryConfigured:      strings.TrimSpace(cfg.CloudinaryURL) != "",
		ExpoAccessTokenConfigured: strings.TrimSpace(cfg.ExpoAccessToken) != "",
		GrowthPolicyConfirmed:     cfg.GrowthPolicyConfirmed,
		JWTSigningKeyDefault: strings.TrimSpace(cfg.JWTSigningKey) == "" ||
			strings.TrimSpace(cfg.JWTSigningKey) == "change-me-for-local-development",
		LegalReviewConfirmed: cfg.LegalReviewConfirmed,
		MarketingWaitlistEmailReady: strings.TrimSpace(cfg.ResendAPIKey) != "" &&
			strings.TrimSpace(cfg.ResendFromEmail) != "" &&
			strings.TrimSpace(cfg.MarketingWaitlistEmailTo) != "",
		MarketingWaitlistWebhookReady: strings.TrimSpace(cfg.MarketingWaitlistWebhook) != "" &&
			strings.TrimSpace(cfg.MarketingWaitlistSecret) != "",
		NotificationHTTPReady: strings.EqualFold(notificationTransport, "http") &&
			strings.TrimSpace(cfg.NotificationHTTPURL) != "" &&
			strings.TrimSpace(cfg.NotificationHTTPAuthValue) != "",
		NotificationWhatsAppReady: strings.EqualFold(notificationTransport, "whatsapp_cloud") &&
			strings.TrimSpace(cfg.WhatsAppPhoneNumberID) != "" &&
			strings.TrimSpace(cfg.WhatsAppAccessToken) != "" &&
			strings.TrimSpace(cfg.WhatsAppVerifyToken) != "" &&
			strings.TrimSpace(cfg.WhatsAppAppSecret) != "",
		NotificationTransport:     strings.ToLower(notificationTransport),
		PaystackSecretConfigured:  strings.TrimSpace(cfg.PaystackSecretKey) != "",
		PaystackWebhookConfigured: strings.TrimSpace(cfg.PaystackWebhookKey) != "",
		ResendConfigured: strings.TrimSpace(cfg.ResendAPIKey) != "" &&
			strings.TrimSpace(cfg.ResendFromEmail) != "",
		SonarHostConfigured:         strings.TrimSpace(cfg.SonarHostURL) != "",
		SonarOrganizationConfigured: strings.TrimSpace(cfg.SonarOrganization) != "",
		SonarTokenConfigured:        strings.TrimSpace(cfg.SonarToken) != "",
	}
}

func defaultAdminDisplayName(role admindomain.Role) string {
	switch role {
	case admindomain.RoleSupport:
		return "Xtiitch Support"
	case admindomain.RoleOperator:
		return "Xtiitch Operator"
	default:
		return "Xtiitch Owner"
	}
}
