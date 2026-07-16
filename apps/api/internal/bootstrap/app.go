package bootstrap

import (
	"context"
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
	authadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/cloudinary"
	emailadapter "github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/email"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/paystack"
	"github.com/xcreativs/xtiitch/apps/api/internal/adapters/outbound/postgres"
	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
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
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/clock"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/ids"

	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	httpServer *http.Server
	db         *pgxpool.Pool
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
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
	// Tenant isolation depends ENTIRELY on FORCE ROW LEVEL SECURITY, which Postgres
	// silently bypasses for a superuser or a role with BYPASSRLS. If prod is ever
	// pointed at the DB owner/superuser, every tenant policy is void. Warn LOUDLY at
	// boot when the connected role can bypass RLS in a non-local environment. By
	// default this is a warning (not a hard fail) so it cannot take down a deploy
	// that is currently (mis)configured that way; set STRICT_DB_ROLE_RLS=true to make
	// it refuse to start once the dedicated NOBYPASSRLS app role is confirmed.
	if err := checkRoleEnforcesRLS(ctx, db, cfg.Environment, logger); err != nil {
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
		// Paystack signs webhooks with HMAC-SHA512 using the SECRET KEY, so when no
		// separate PAYSTACK_WEBHOOK_SECRET is configured, fall back to the secret
		// key — otherwise every webhook signature check fails and no charge ever
		// settles.
		webhookKey := cfg.PaystackWebhookKey
		if webhookKey == "" {
			webhookKey = cfg.PaystackSecretKey
		}
		paymentProvider = paystack.NewClient(cfg.PaystackSecretKey, webhookKey)
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
		// Sends and checks the code that proves a payout mobile-money number
		// before payout details are saved (Testing Report §3.1). The auth service
		// owns the OTP rules; payments borrows them rather than copying them.
		OTP: authService,
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

	production := strings.EqualFold(cfg.Environment, "production")
	// In production the API sits behind Render's single reverse proxy, so the
	// genuine client IP is the last X-Forwarded-For hop; locally there is no
	// trusted proxy, so trust none and use the direct connection address.
	trustedProxyHops := 0
	if production {
		trustedProxyHops = 1
	}
	router := httpadapter.NewRouter(logger, db.Ping,
		httpadapter.SecurityOptions{
			Production:       production,
			AllowedOrigins:   cfg.CORSAllowedOrigins,
			RateLimitRPS:     cfg.RateLimitRPS,
			TrustedProxyHops: trustedProxyHops,
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
func (a App) HTTPServer() *http.Server {
	return a.httpServer
}

func (a App) Close() {
	if a.db != nil {
		a.db.Close()
	}
}
