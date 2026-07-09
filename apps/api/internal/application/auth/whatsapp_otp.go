package authapp

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	businessOTPTTL         = 5 * time.Minute
	maxBusinessOTPAttempts = 5
)

var (
	// ErrWhatsAppOTPUnavailable is returned when WhatsApp one-time-code auth is
	// not wired (missing dependencies).
	ErrWhatsAppOTPUnavailable = errors.New("whatsapp sign-in is not available")
	ErrInvalidPhone           = errors.New("invalid whatsapp number")
	ErrInvalidCode            = errors.New("invalid verification code")
	ErrCodeExpired            = errors.New("verification code expired or not requested")
	ErrTooManyAttempts        = errors.New("too many attempts; request a new code")
	// ErrOTPDeliveryFailed means the code was stored but the SMS/WhatsApp provider
	// rejected the send. Surfaced as a clear delivery_failed rather than an opaque
	// internal_error; the underlying provider error is logged.
	ErrOTPDeliveryFailed = errors.New("could not deliver the verification code")
)

// RequestSignInOTP sends a sign-in code to the WhatsApp number of the owner of a
// store handle. It is opaque about whether the handle+number pair maps to an
// active owner (only sends when it does) so it never reveals who is registered.
func (s Service) RequestSignInOTP(ctx context.Context, handle string, rawWhatsApp string) error {
	if !s.whatsAppOTPEnabled() {
		return ErrWhatsAppOTPUnavailable
	}
	number, err := normalizeGhanaPhone(rawWhatsApp)
	if err != nil {
		return err
	}
	credentials, err := s.whatsAppAuth.FindBusinessUserByHandleAndWhatsApp(ctx, normalizeHandle(handle), number)
	if err != nil || !credentials.IsActive {
		// Stay opaque to the caller: report success without sending when no active
		// owner matches. Log it (masked) so an operator can tell an intentional
		// no-op apart from a real delivery failure.
		s.logger.Info("business sign-in OTP: no active owner matched, not sending",
			slog.String("handle", normalizeHandle(handle)),
			slog.String("whatsapp", maskWhatsApp(number)),
			slog.Bool("lookup_error", err != nil))
		return nil
	}
	return s.deliverBusinessOTP(ctx, number)
}

// RequestRegistrationOTP sends a verification code to a WhatsApp number a signup
// form collected, before the account exists. Opaque and side-effect free beyond
// the code send.
func (s Service) RequestRegistrationOTP(ctx context.Context, rawWhatsApp string) error {
	if !s.whatsAppOTPEnabled() {
		return ErrWhatsAppOTPUnavailable
	}
	number, err := normalizeGhanaPhone(rawWhatsApp)
	if err != nil {
		return err
	}
	return s.deliverBusinessOTP(ctx, number)
}

// VerifySignInOTPCommand carries a WhatsApp sign-in attempt.
type VerifySignInOTPCommand struct {
	BusinessHandle string
	WhatsAppNumber string
	Code           string
	UserAgent      string
	IPAddress      string
}

// VerifySignInOTP verifies a WhatsApp code and, on success, issues a session for
// the matching store owner. WhatsApp OTP replaces the password as the first
// factor; it does NOT bypass a second factor, so an MFA-enrolled account still
// returns a challenge to complete via VerifyMFALogin (same as password login).
func (s Service) VerifySignInOTP(ctx context.Context, cmd VerifySignInOTPCommand) (AuthResult, error) {
	if !s.whatsAppOTPEnabled() {
		return AuthResult{}, ErrWhatsAppOTPUnavailable
	}
	handle := normalizeHandle(cmd.BusinessHandle)
	number, err := normalizeGhanaPhone(cmd.WhatsAppNumber)
	if err != nil || handle == "" {
		return AuthResult{}, ErrInvalidPhone
	}

	if err := s.verifyBusinessOTP(ctx, number, cmd.Code); err != nil {
		return AuthResult{}, err
	}

	credentials, err := s.whatsAppAuth.FindBusinessUserByHandleAndWhatsApp(ctx, handle, number)
	if err != nil || !credentials.IsActive {
		return AuthResult{}, authdomain.ErrInvalidCredentials
	}

	if s.mfaEnabled() {
		scope := common.TenantScope{BusinessID: credentials.BusinessID}
		enrollment, err := s.mfa.Get(ctx, scope, credentials.UserID)
		if err == nil && enrollment.Enabled {
			now := s.clock.Now()
			challenge, err := s.mfaChallenges.IssueMFAChallengeToken(ctx, ports.MFAChallengeInput{
				Subject:    credentials.UserID,
				BusinessID: credentials.BusinessID,
				Role:       credentials.Role,
				IssuedAt:   now,
				ExpiresAt:  now.Add(mfaChallengeTTL),
			})
			if err != nil {
				return AuthResult{}, err
			}
			return AuthResult{
				BusinessID:        credentials.BusinessID,
				BusinessUserID:    credentials.UserID,
				MFARequired:       true,
				MFAChallengeToken: challenge,
			}, nil
		}
		if err != nil && !errors.Is(err, ports.ErrNotFound) {
			return AuthResult{}, err
		}
	}

	return s.issueSession(ctx, issueSessionInput{
		BusinessID:     credentials.BusinessID,
		BusinessUserID: credentials.UserID,
		Role:           credentials.Role,
		UserAgent:      cmd.UserAgent,
		IPAddress:      cmd.IPAddress,
	})
}

// deliverBusinessOTP mints, stores (hashed), and sends a one-time code.
func (s Service) deliverBusinessOTP(ctx context.Context, number string) error {
	code, err := s.otpGen.NewCode()
	if err != nil {
		return err
	}
	now := s.clock.Now()
	if err := s.whatsAppAuth.CreateSignInOTPChallenge(ctx, ports.CreateSignInOTPChallengeInput{
		ChallengeID:    s.ids.NewID(),
		WhatsAppNumber: number,
		CodeHash:       s.otpGen.HashCode(code),
		ExpiresAt:      now.Add(businessOTPTTL),
	}); err != nil {
		s.logger.Error("business OTP challenge persist failed", slog.String("whatsapp", maskWhatsApp(number)), slog.String("error", err.Error()))
		return err
	}
	s.logger.Info("business OTP requested (phone)", slog.String("whatsapp", maskWhatsApp(number)))
	if err := s.whatsAppOTP.SendOTP(ctx, number, code); err != nil {
		s.logger.Error("business OTP delivery failed", slog.String("whatsapp", maskWhatsApp(number)), slog.String("error", err.Error()))
		return ErrOTPDeliveryFailed
	}
	s.logger.Info("business OTP delivery accepted", slog.String("whatsapp", maskWhatsApp(number)))
	return nil
}

// maskWhatsApp redacts the middle of a WhatsApp number for logs (e.g. 233****789)
// so an operator can correlate a request without logging full PII.
func maskWhatsApp(number string) string {
	if len(number) <= 6 {
		return "***"
	}
	return number[:3] + "****" + number[len(number)-3:]
}

// verifyBusinessOTP resolves the active challenge for a number, enforces the
// attempt cap, checks the code, and consumes the challenge on a match.
func (s Service) verifyBusinessOTP(ctx context.Context, number string, code string) error {
	now := s.clock.Now()
	challenge, err := s.whatsAppAuth.LatestActiveSignInOTPChallenge(ctx, number, now)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return ErrCodeExpired
		}
		return err
	}
	if challenge.Attempts >= maxBusinessOTPAttempts {
		return ErrTooManyAttempts
	}
	if s.otpGen.HashCode(strings.TrimSpace(code)) != challenge.CodeHash {
		if incErr := s.whatsAppAuth.IncrementSignInOTPAttempts(ctx, challenge.ChallengeID); incErr != nil {
			s.logger.Error("failed to increment business sign-in OTP attempts", slog.String("error", incErr.Error()))
		}
		return ErrInvalidCode
	}
	if err := s.whatsAppAuth.ConsumeSignInOTPChallenge(ctx, challenge.ChallengeID); err != nil {
		return err
	}
	return nil
}

// normalizeGhanaPhone coerces a Ghana mobile number to canonical 233XXXXXXXXX
// (12 digits): accepts 0XXXXXXXXX, +233XXXXXXXXX / 233XXXXXXXXX, or a bare
// 9-digit local number. Keeps storage and lookup consistent.
func normalizeGhanaPhone(raw string) (string, error) {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	switch {
	case len(digits) == 12 && strings.HasPrefix(digits, "233"):
		// already canonical
	case len(digits) == 10 && strings.HasPrefix(digits, "0"):
		digits = "233" + digits[1:]
	case len(digits) == 9:
		digits = "233" + digits
	default:
		return "", ErrInvalidPhone
	}
	if len(digits) != 12 || !strings.HasPrefix(digits, "233") {
		return "", ErrInvalidPhone
	}
	return digits, nil
}
