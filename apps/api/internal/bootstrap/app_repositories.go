package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/platform/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

// validateProductionConfig fails fast when APP_ENV=production but the process is
// still configured with insecure dev defaults or stub providers. These fallbacks
// are deliberate conveniences for local/dev (a fake Paystack, an unsigned media
// store, a default signing key); shipping them to production would mean fake
// payment confirmations, tamperable uploads, and forgeable sessions.
// checkRoleEnforcesRLS warns (or, under STRICT_DB_ROLE_RLS, refuses to start) when
// the connected Postgres role can bypass row-level security (superuser or
// BYPASSRLS) in a non-local environment. FORCE RLS does not apply to such roles, so
// this surfaces the "prod pointed at the DB owner/superuser → all tenant isolation
// void" failure mode. It defaults to a warning so it can never take down a deploy
// that is presently configured that way; set STRICT_DB_ROLE_RLS=true to hard-fail.
func checkRoleEnforcesRLS(ctx context.Context, db *pgxpool.Pool, environment string, logger *slog.Logger) error {
	switch strings.ToLower(strings.TrimSpace(environment)) {
	case "local", "development", "dev", "test", "ci", "":
		return nil
	}
	var role string
	var isSuperuser, bypassRLS bool
	if err := db.QueryRow(ctx, `
		select current_user,
			(select rolsuper from pg_roles where rolname = current_user),
			(select rolbypassrls from pg_roles where rolname = current_user)
	`).Scan(&role, &isSuperuser, &bypassRLS); err != nil {
		// Do not block startup on an inability to introspect the role; just warn.
		logger.Warn("could not verify the database role enforces RLS", slog.String("error", err.Error()))
		return nil
	}
	if !isSuperuser && !bypassRLS {
		return nil
	}
	strict := strings.EqualFold(strings.TrimSpace(os.Getenv("STRICT_DB_ROLE_RLS")), "true")
	if strict {
		return fmt.Errorf(
			"refusing to start: database role %q can BYPASS row-level security (superuser=%v, bypassrls=%v) "+
				"— tenant isolation would be void; connect as a NOBYPASSRLS app role",
			role, isSuperuser, bypassRLS,
		)
	}
	logger.Error("SECURITY: database role can BYPASS row-level security — "+
		"tenant isolation depends on FORCE RLS which does not apply to this role; "+
		"use a dedicated NOBYPASSRLS app role (set STRICT_DB_ROLE_RLS=true to enforce)",
		slog.String("db_role", role),
		slog.Bool("is_superuser", isSuperuser),
		slog.Bool("bypassrls", bypassRLS),
	)
	return nil
}

func validateProductionConfig(cfg config.Config) error {
	// Apply the guard to ANY non-local environment, not just the exact string
	// "production": otherwise a typo ("prod"), a "staging" deploy, or an unset
	// APP_ENV would silently ship the insecure dev defaults (e.g. the public default
	// JWT signing key → forgeable admin/tenant tokens). Only recognized local/dev/
	// test values opt out.
	switch strings.ToLower(strings.TrimSpace(cfg.Environment)) {
	case "local", "development", "dev", "test", "ci", "":
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
		problems = append(problems,
			"WHATSAPP_APP_SECRET must be set when the WhatsApp bot is enabled "+
				"(inbound webhooks must be signature-verified)",
		)
	}

	if len(problems) == 0 {
		return nil
	}
	return fmt.Errorf("refusing to start: insecure production configuration:\n  - %s", strings.Join(problems, "\n  - "))
}
