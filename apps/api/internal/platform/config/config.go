package config

import "os"

type Config struct {
	AdminBootstrapDisplayName string
	AdminBootstrapEmail       string
	AdminBootstrapExtraUsers  string
	AdminBootstrapPassword    string
	AdminBootstrapRole        string
	CloudinaryURL             string
	DatabaseURL               string
	Environment               string
	ExpoAccessToken           string
	HTTPAddr                  string
	JWTAudience               string
	JWTIssuer                 string
	JWTSigningKey             string
	MarketingWaitlistEmailTo  string
	MarketingWaitlistWebhook  string
	MarketingWaitlistSecret   string
	NotificationHTTPAuthValue string
	NotificationHTTPURL       string
	NotificationTransport     string
	PaystackSecretKey         string
	PaystackWebhookKey        string
	RedisURL                  string
	ResendAPIKey              string
	ResendFromEmail           string
	SonarHostURL              string
	WorkerQueueName           string
}

func Load() Config {
	return Config{
		AdminBootstrapDisplayName: getenv("ADMIN_BOOTSTRAP_DISPLAY_NAME", ""),
		AdminBootstrapEmail:       getenv("ADMIN_BOOTSTRAP_EMAIL", ""),
		AdminBootstrapExtraUsers:  getenv("ADMIN_BOOTSTRAP_EXTRA_USERS_JSON", ""),
		AdminBootstrapPassword:    getenv("ADMIN_BOOTSTRAP_PASSWORD", ""),
		AdminBootstrapRole:        getenv("ADMIN_BOOTSTRAP_ROLE", "owner"),
		CloudinaryURL:             getenv("CLOUDINARY_URL", ""),
		// The API connects as the non-superuser application role so row-level
		// security is enforced. Migrations run separately as the owner.
		DatabaseURL:              getenv("DATABASE_URL", "postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable"),
		Environment:              getenv("APP_ENV", "development"),
		ExpoAccessToken:          getenv("EXPO_ACCESS_TOKEN", ""),
		HTTPAddr:                 getenv("API_HTTP_ADDR", ":8080"),
		JWTAudience:              getenv("JWT_AUDIENCE", "xtiitch-clients"),
		JWTIssuer:                getenv("JWT_ISSUER", "xtiitch-api"),
		JWTSigningKey:            getenv("JWT_SIGNING_KEY", "change-me-for-local-development"),
		MarketingWaitlistEmailTo: getenv("MARKETING_WAITLIST_EMAIL_TO", ""),
		MarketingWaitlistWebhook: getenv("MARKETING_WAITLIST_WEBHOOK_URL", ""),
		MarketingWaitlistSecret:  getenv("MARKETING_WAITLIST_WEBHOOK_SECRET", ""),
		NotificationHTTPAuthValue: getenv(
			"NOTIFICATION_HTTP_AUTH_VALUE",
			"",
		),
		NotificationHTTPURL:   getenv("NOTIFICATION_HTTP_URL", ""),
		NotificationTransport: getenv("NOTIFICATION_TRANSPORT", "log"),
		PaystackSecretKey:     getenv("PAYSTACK_SECRET_KEY", ""),
		PaystackWebhookKey:    getenv("PAYSTACK_WEBHOOK_SECRET", ""),
		RedisURL:              getenv("REDIS_URL", "redis://localhost:6379/0"),
		ResendAPIKey:          getenv("RESEND_API_KEY", ""),
		ResendFromEmail:       getenv("RESEND_FROM_EMAIL", ""),
		SonarHostURL:          getenv("SONAR_HOST_URL", ""),
		WorkerQueueName:       getenv("WORKER_QUEUE_NAME", "xtiitch.default"),
	}
}

func getenv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}
