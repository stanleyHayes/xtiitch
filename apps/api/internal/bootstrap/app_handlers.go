package bootstrap

import (
	"encoding/json"
	"fmt"
	"strings"

	adminauthapp "github.com/xcreativs/xtiitch/apps/api/internal/application/adminauth"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
)

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
