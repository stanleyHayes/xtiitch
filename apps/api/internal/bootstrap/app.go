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
	authhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/auth"
	availabilityhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/availability"
	bookinghttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/booking"
	cataloguehttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/catalogue"
	checkouthttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/checkout"
	deliveryhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/delivery"
	growthhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/growth"
	measurementhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/measurement"
	mediahttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/media"
	notificationhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/notification"
	orderhttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/order"
	paymentshttp "github.com/xcreativs/xtiitch/apps/api/internal/adapters/inbound/http/payments"
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
	deliveryapp "github.com/xcreativs/xtiitch/apps/api/internal/application/delivery"
	growthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/growth"
	measurementapp "github.com/xcreativs/xtiitch/apps/api/internal/application/measurement"
	mediaapp "github.com/xcreativs/xtiitch/apps/api/internal/application/media"
	notifyapp "github.com/xcreativs/xtiitch/apps/api/internal/application/notification"
	orderapp "github.com/xcreativs/xtiitch/apps/api/internal/application/order"
	paymentsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/payments"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
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

	authService := authapp.NewService(authapp.Dependencies{
		Businesses:    postgres.NewBusinessIdentityRepository(db),
		Sessions:      postgres.NewAuthSessionRepository(db),
		Passwords:     authadapter.NewBcryptPasswordHasher(0),
		AccessTokens:  jwtIssuer,
		RefreshTokens: authadapter.NewRefreshTokenIssuer(),
		Emails:        emailadapter.NewResendSender(cfg.ResendAPIKey, cfg.ResendFromEmail),
		DashboardURL:  cfg.BusinessDashboardBaseURL,
		IDs:           ids.UUIDGenerator{},
		Clock:         clock.SystemClock{},
		MFA:           postgres.NewMFARepository(db),
		MFASecrets:    totpManager,
		MFAChallenges: jwtIssuer,
		MFAVerifier:   jwtIssuer,
	})

	authenticator := authhttp.NewAuthenticator(jwtIssuer)
	adminAuthRepository := postgres.NewAdminAuthRepository(db)
	var paymentProvider ports.PaymentProvider
	if cfg.PaystackSecretKey != "" {
		paymentProvider = paystack.NewClient(cfg.PaystackSecretKey, cfg.PaystackWebhookKey)
	} else {
		// No live key: deterministic dev provider with real webhook-signature
		// verification, so the money path runs locally and in tests.
		logger.Warn("paystack secret key not set; using dev payment provider")
		paymentProvider = paystack.NewDevProvider(cfg.PaystackWebhookKey)
	}

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

	deliveryService := deliveryapp.NewService(deliveryapp.Dependencies{
		Handovers: postgres.NewDeliveryRepository(db),
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
		Storefront:   postgres.NewStorefrontRepository(db),
		Businesses:   postgres.NewBusinessChargeRepository(db),
		Orders:       postgres.NewOrderRepository(db),
		Bookings:     postgres.NewBookingRepository(db),
		Promotions:   promotionRepository,
		Affiliates:   growthRepository,
		Referrals:    growthRepository,
		Availability: availabilityService,
		Payments:     paymentService,
		IDs:          ids.UUIDGenerator{},
		Logger:       logger,
	})

	router := httpadapter.NewRouter(logger, db.Ping,
		httpadapter.SecurityOptions{
			Production:     strings.EqualFold(cfg.Environment, "production"),
			AllowedOrigins: cfg.CORSAllowedOrigins,
			RateLimitRPS:   cfg.RateLimitRPS,
		},
		adminauthhttp.NewHandler(adminAuthService, adminAuthenticator),
		authhttp.NewHandler(authService, authenticator),
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
