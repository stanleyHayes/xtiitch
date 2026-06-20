package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AdminBootstrapDisplayName string
	AdminBootstrapEmail       string
	AdminBootstrapExtraUsers  string
	AdminBootstrapPassword    string
	AdminBootstrapRole        string
	BusinessDashboardBaseURL  string
	CloudinaryURL             string
	// CORSAllowedOrigins is the browser CORS allow-list (go-chi/cors "*"
	// wildcards supported). RateLimitRPS caps sustained requests/sec per client
	// IP (<=0 disables).
	CORSAllowedOrigins    []string
	RateLimitRPS          int
	DatabaseURL           string
	Environment           string
	ExpoAccessToken       string
	GrowthPolicyConfirmed bool
	HTTPAddr              string
	JWTAudience           string
	JWTIssuer             string
	JWTSigningKey         string
	LegalReviewConfirmed  bool
	// MFAIssuer is the label authenticator apps show for TOTP entries.
	// MFAEncryptionKey encrypts stored TOTP secrets at rest; when empty it falls
	// back to the JWT signing key so local dev works without extra config.
	MFAIssuer                 string
	MFAEncryptionKey          string
	MarketingWaitlistEmailTo  string
	MarketingWaitlistWebhook  string
	MarketingWaitlistSecret   string
	NotificationHTTPAuthValue string
	NotificationHTTPURL       string
	NotificationTransport     string
	// OpenAIAPIKey enables the hosted embedding model for AI search; when empty a
	// deterministic dev embedder is used so search works locally with no key.
	// OpenAIEmbeddingModel overrides the embedding model name.
	OpenAIAPIKey         string
	OpenAIEmbeddingModel string
	PaystackSecretKey    string
	PaystackWebhookKey   string
	RedisURL             string
	ResendAPIKey         string
	ResendFromEmail      string
	SonarHostURL         string
	SonarOrganization    string
	SonarToken           string
	WorkerQueueName      string
}

func Load() Config {
	return Config{
		AdminBootstrapDisplayName: getenv("ADMIN_BOOTSTRAP_DISPLAY_NAME", ""),
		AdminBootstrapEmail:       getenv("ADMIN_BOOTSTRAP_EMAIL", ""),
		AdminBootstrapExtraUsers:  getenv("ADMIN_BOOTSTRAP_EXTRA_USERS_JSON", ""),
		AdminBootstrapPassword:    getenv("ADMIN_BOOTSTRAP_PASSWORD", ""),
		AdminBootstrapRole:        getenv("ADMIN_BOOTSTRAP_ROLE", "owner"),
		BusinessDashboardBaseURL:  getenv("BUSINESS_DASHBOARD_BASE_URL", "http://localhost:3401"),
		CloudinaryURL:             getenv("CLOUDINARY_URL", ""),
		CORSAllowedOrigins: getenvList(
			"CORS_ALLOWED_ORIGINS",
			"http://localhost:3000,http://localhost:3001,http://localhost:3100,http://localhost:3401,http://localhost:3403,http://localhost:3333,http://*.localhost:3100,https://*.xtiitch.com,https://xtiitch.com",
		),
		RateLimitRPS: getenvInt("RATE_LIMIT_RPS", 100),
		// The API connects as the non-superuser application role so row-level
		// security is enforced. Migrations run separately as the owner.
		DatabaseURL:              getenv("DATABASE_URL", "postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable"),
		Environment:              getenv("APP_ENV", "development"),
		ExpoAccessToken:          getenv("EXPO_ACCESS_TOKEN", ""),
		GrowthPolicyConfirmed:    getenvBool("XTIITCH_GROWTH_POLICY_CONFIRMED"),
		HTTPAddr:                 getenv("API_HTTP_ADDR", ":8080"),
		JWTAudience:              getenv("JWT_AUDIENCE", "xtiitch-clients"),
		JWTIssuer:                getenv("JWT_ISSUER", "xtiitch-api"),
		JWTSigningKey:            getenv("JWT_SIGNING_KEY", "change-me-for-local-development"),
		LegalReviewConfirmed:     getenvBool("XTIITCH_LEGAL_REVIEW_CONFIRMED"),
		MFAIssuer:                getenv("MFA_ISSUER", "Xtiitch"),
		MFAEncryptionKey:         getenv("MFA_ENCRYPTION_KEY", ""),
		MarketingWaitlistEmailTo: getenv("MARKETING_WAITLIST_EMAIL_TO", ""),
		MarketingWaitlistWebhook: getenv("MARKETING_WAITLIST_WEBHOOK_URL", ""),
		MarketingWaitlistSecret:  getenv("MARKETING_WAITLIST_WEBHOOK_SECRET", ""),
		NotificationHTTPAuthValue: getenv(
			"NOTIFICATION_HTTP_AUTH_VALUE",
			"",
		),
		NotificationHTTPURL:   getenv("NOTIFICATION_HTTP_URL", ""),
		NotificationTransport: getenv("NOTIFICATION_TRANSPORT", "log"),
		OpenAIAPIKey:          getenv("OPENAI_API_KEY", ""),
		OpenAIEmbeddingModel:  getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
		PaystackSecretKey:     getenv("PAYSTACK_SECRET_KEY", ""),
		PaystackWebhookKey:    getenv("PAYSTACK_WEBHOOK_SECRET", ""),
		RedisURL:              getenv("REDIS_URL", "redis://localhost:6379/0"),
		ResendAPIKey:          getenv("RESEND_API_KEY", ""),
		ResendFromEmail:       getenv("RESEND_FROM_EMAIL", ""),
		SonarHostURL:          getenv("SONAR_HOST_URL", ""),
		SonarOrganization:     getenv("SONAR_ORGANIZATION", ""),
		SonarToken:            getenv("SONAR_TOKEN", ""),
		WorkerQueueName:       getenv("WORKER_QUEUE_NAME", "xtiitch.default"),
	}
}

func getenv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func getenvInt(key string, fallback int) int {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}

	return fallback
}

func getenvList(key string, fallback string) []string {
	parts := strings.Split(getenv(key, fallback), ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}

	return out
}

func getenvBool(key string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}
