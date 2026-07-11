package bootstrap

import (
	"strings"
	"testing"

	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"
)

func TestAdminBootstrapCommandsIncludesPrimaryAndExtraUsers(t *testing.T) {
	commands, err := adminBootstrapCommands(config.Config{
		AdminBootstrapEmail:       "owner@xtiitch.com",
		AdminBootstrapDisplayName: "Xtiitch Owner",
		AdminBootstrapPassword:    "AdminPass123!",
		AdminBootstrapRole:        "owner",
		AdminBootstrapExtraUsers: `[{
			"email": "operator@xtiitch.com",
			"password": "AdminPass123!"
		}, {
			"email": "support@xtiitch.com",
			"display_name": "Care Desk",
			"password": "AdminPass123!",
			"role": "support"
		}]`,
	})
	if err != nil {
		t.Fatalf("bootstrap commands: %v", err)
	}
	if len(commands) != 3 {
		t.Fatalf("expected 3 commands, got %d", len(commands))
	}
	if commands[0].Email != "owner@xtiitch.com" || commands[0].Role != admindomain.RoleOwner {
		t.Fatalf("unexpected primary command: %+v", commands[0])
	}
	if commands[1].Email != "operator@xtiitch.com" ||
		commands[1].DisplayName != "Xtiitch Operator" ||
		commands[1].Role != admindomain.RoleOperator {
		t.Fatalf("unexpected defaulted operator command: %+v", commands[1])
	}
	if commands[2].Email != "support@xtiitch.com" ||
		commands[2].DisplayName != "Care Desk" ||
		commands[2].Role != admindomain.RoleSupport {
		t.Fatalf("unexpected support command: %+v", commands[2])
	}
}

func TestAdminBootstrapCommandsRejectsMalformedExtraUsers(t *testing.T) {
	_, err := adminBootstrapCommands(config.Config{
		AdminBootstrapExtraUsers: `[`,
	})
	if err == nil || !strings.Contains(err.Error(), "ADMIN_BOOTSTRAP_EXTRA_USERS_JSON") {
		t.Fatalf("expected parse error, got %v", err)
	}
}

func TestAdminBootstrapCommandsRejectsIncompleteExtraUser(t *testing.T) {
	_, err := adminBootstrapCommands(config.Config{
		AdminBootstrapExtraUsers: `[{"email":"operator@xtiitch.com"}]`,
	})
	if err == nil || !strings.Contains(err.Error(), "missing email or password") {
		t.Fatalf("expected missing field error, got %v", err)
	}
}

func TestValidateProductionConfig(t *testing.T) {
	//nolint:gosec // test config contains placeholder credentials
	secure := config.Config{
		Environment:       "production",
		JWTSigningKey:     "a-strong-production-secret",
		MFAEncryptionKey:  "a-separate-mfa-secret",
		PaystackSecretKey: "sk_live_example",
		CloudinaryURL:     "cloudinary://key:secret@cloud",
		DatabaseURL:       "postgres://app:strong@db.internal:5432/xtiitch?sslmode=require",
	}

	if err := validateProductionConfig(secure); err != nil {
		t.Fatalf("secure production config should pass, got: %v", err)
	}

	// Non-production never blocks, even with empty defaults.
	if err := validateProductionConfig(config.Config{Environment: "development"}); err != nil {
		t.Fatalf("development config should never block startup, got: %v", err)
	}

	// Production with dev defaults must fail and name each problem.
	//nolint:gosec // test config contains placeholder credentials
	insecure := config.Config{
		Environment:   "production",
		JWTSigningKey: "change-me-for-local-development",
		DatabaseURL:   "postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable",
	}
	err := validateProductionConfig(insecure)
	if err == nil {
		t.Fatal("insecure production config should be refused")
	}
	for _, want := range []string{
		"JWT_SIGNING_KEY", "MFA_ENCRYPTION_KEY", "PAYSTACK_SECRET_KEY",
		"CLOUDINARY_URL", "DATABASE_URL", "sslmode=disable",
	} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("expected error to mention %q, got: %v", want, err)
		}
	}
}
