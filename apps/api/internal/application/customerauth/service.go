package customerauth

import (
	"context"
	"errors"
	"log/slog"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

const (
	otpTTL           = 5 * time.Minute
	maxOTPAttempts   = 5
	customerTokenTTL = 30 * 24 * time.Hour
)

var (
	ErrInvalidPhone    = errors.New("invalid phone number")
	ErrInvalidEmail    = errors.New("invalid email address")
	ErrInvalidCode     = errors.New("invalid verification code")
	ErrCodeExpired     = errors.New("verification code expired or not requested")
	ErrTooManyAttempts = errors.New("too many attempts; request a new code")
	// ErrOTPDeliveryFailed means the code was minted + stored but the SMS/email
	// provider rejected the send, so the caller never got it. Surfaced as a clear
	// delivery_failed (not an opaque internal_error) so the UI can say "couldn't
	// send the code, try again"; the underlying provider error is logged.
	ErrOTPDeliveryFailed = errors.New("could not deliver the verification code")
)

type Service struct {
	repo          ports.CustomerAuthRepository
	tokens        ports.CustomerTokenIssuer
	otp           ports.OTPGenerator
	delivery      ports.CustomerOTPDelivery
	emailDelivery ports.CustomerEmailOTPDelivery
	ids           ports.IDGenerator
	clock         ports.Clock
	logger        *slog.Logger
}

type Dependencies struct {
	Repo          ports.CustomerAuthRepository
	Tokens        ports.CustomerTokenIssuer
	OTP           ports.OTPGenerator
	Delivery      ports.CustomerOTPDelivery
	EmailDelivery ports.CustomerEmailOTPDelivery
	IDs           ports.IDGenerator
	Clock         ports.Clock
	Logger        *slog.Logger
}

func NewService(deps Dependencies) Service {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return Service{
		repo:          deps.Repo,
		tokens:        deps.Tokens,
		otp:           deps.OTP,
		delivery:      deps.Delivery,
		emailDelivery: deps.EmailDelivery,
		ids:           deps.IDs,
		clock:         deps.Clock,
		logger:        logger,
	}
}

// RequestOTP issues a one-time code to a phone over WhatsApp. It always behaves
// the same whether or not a customer already exists, to avoid leaking who is
// registered.
func (s Service) RequestOTP(ctx context.Context, rawPhone string) error {
	phone, err := normalizeGhanaPhone(rawPhone)
	if err != nil {
		s.logger.Warn("customer OTP request rejected: invalid phone", slog.String("error", err.Error()))
		return err
	}
	code, err := s.otp.NewCode()
	if err != nil {
		s.logger.Error("customer OTP code generation failed", slog.String("phone", maskPhone(phone)), slog.String("error", err.Error()))
		return err
	}
	now := s.clock.Now()
	if err := s.repo.CreateOTPChallenge(ctx, ports.CreateOTPChallengeInput{
		ChallengeID: s.ids.NewID(),
		Channel:     ports.CustomerOTPChannelWhatsApp,
		Phone:       phone,
		CodeHash:    s.otp.HashCode(code),
		ExpiresAt:   now.Add(otpTTL),
	}); err != nil {
		s.logger.Error("customer OTP challenge persist failed", slog.String("phone", maskPhone(phone)), slog.String("error", err.Error()))
		return err
	}
	s.logger.Info("customer OTP requested (phone)", slog.String("phone", maskPhone(phone)))
	if err := s.delivery.SendOTP(ctx, phone, code); err != nil {
		s.logger.Error("customer OTP delivery failed", slog.String("phone", maskPhone(phone)), slog.String("error", err.Error()))
		return ErrOTPDeliveryFailed
	}
	s.logger.Info("customer OTP delivery accepted", slog.String("phone", maskPhone(phone)))
	return nil
}

// RequestEmailOTP issues a one-time code to an email address. Like RequestOTP it
// is opaque about whether the address maps to an existing customer.
func (s Service) RequestEmailOTP(ctx context.Context, rawEmail string) error {
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		s.logger.Warn("customer email OTP request rejected: invalid email", slog.String("error", err.Error()))
		return err
	}
	if s.emailDelivery == nil {
		// Email channel not configured. Stay opaque to the caller (like a
		// non-registered identifier), but log it so an operator can see why no
		// email is going out rather than it failing silently.
		s.logger.Warn("customer email OTP requested but email delivery is not configured", slog.String("email", maskEmail(email)))
		return nil
	}
	code, err := s.otp.NewCode()
	if err != nil {
		s.logger.Error("customer email OTP code generation failed", slog.String("email", maskEmail(email)), slog.String("error", err.Error()))
		return err
	}
	now := s.clock.Now()
	if err := s.repo.CreateOTPChallenge(ctx, ports.CreateOTPChallengeInput{
		ChallengeID: s.ids.NewID(),
		Channel:     ports.CustomerOTPChannelEmail,
		Email:       email,
		CodeHash:    s.otp.HashCode(code),
		ExpiresAt:   now.Add(otpTTL),
	}); err != nil {
		s.logger.Error("customer email OTP challenge persist failed", slog.String("email", maskEmail(email)), slog.String("error", err.Error()))
		return err
	}
	s.logger.Info("customer OTP requested over email", slog.String("email", maskEmail(email)))
	if err := s.emailDelivery.SendEmailOTP(ctx, email, code); err != nil {
		s.logger.Error("customer email OTP delivery failed", slog.String("email", maskEmail(email)), slog.String("error", err.Error()))
		return ErrOTPDeliveryFailed
	}
	s.logger.Info("customer email OTP delivery accepted", slog.String("email", maskEmail(email)))
	return nil
}

type CustomerAuthResult struct {
	CustomerID  common.ID
	Phone       string
	Email       string
	AccessToken string
	ExpiresAt   time.Time
}

// VerifyOTP checks a phone (WhatsApp) code and, on success, resolves/creates the
// customer and issues a customer session token.
func (s Service) VerifyOTP(ctx context.Context, rawPhone string, code string) (CustomerAuthResult, error) {
	phone, err := normalizeGhanaPhone(rawPhone)
	if err != nil {
		return CustomerAuthResult{}, err
	}

	if _, err := s.verifyChallenge(ctx, ports.CustomerOTPChannelWhatsApp, phone, code); err != nil {
		return CustomerAuthResult{}, err
	}

	customerID, err := s.repo.UpsertVerifiedCustomerByPhone(ctx, s.ids.NewID(), phone)
	if err != nil {
		return CustomerAuthResult{}, err
	}
	return s.issueCustomerToken(ctx, customerID, phone, "")
}

// VerifyEmailOTP checks an email code and, on success, resolves/creates the
// customer (by email, no phone) and issues a customer session token.
func (s Service) VerifyEmailOTP(ctx context.Context, rawEmail string, code string) (CustomerAuthResult, error) {
	email, err := normalizeEmail(rawEmail)
	if err != nil {
		return CustomerAuthResult{}, err
	}

	if _, err := s.verifyChallenge(ctx, ports.CustomerOTPChannelEmail, email, code); err != nil {
		return CustomerAuthResult{}, err
	}

	customerID, err := s.repo.UpsertVerifiedCustomerByEmail(ctx, s.ids.NewID(), email)
	if err != nil {
		return CustomerAuthResult{}, err
	}
	return s.issueCustomerToken(ctx, customerID, "", email)
}

// verifyChallenge resolves the active challenge for a channel + identifier,
// enforces the attempt cap, checks the code, and consumes the challenge on a
// match. Shared by the phone and email verify paths.
func (s Service) verifyChallenge(ctx context.Context, channel ports.CustomerOTPChannel, identifier string, code string) (ports.OTPChallengeRecord, error) {
	now := s.clock.Now()
	challenge, err := s.repo.LatestActiveOTPChallenge(ctx, channel, identifier, now)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return ports.OTPChallengeRecord{}, ErrCodeExpired
		}
		return ports.OTPChallengeRecord{}, err
	}
	if challenge.Attempts >= maxOTPAttempts {
		return ports.OTPChallengeRecord{}, ErrTooManyAttempts
	}
	if s.otp.HashCode(code) != challenge.CodeHash {
		if incErr := s.repo.IncrementOTPAttempts(ctx, challenge.ChallengeID); incErr != nil {
			s.logger.Error("failed to increment customer OTP attempts", slog.String("error", incErr.Error()))
		}
		return ports.OTPChallengeRecord{}, ErrInvalidCode
	}
	if err := s.repo.ConsumeOTPChallenge(ctx, challenge.ChallengeID); err != nil {
		return ports.OTPChallengeRecord{}, err
	}
	return challenge, nil
}

// issueCustomerToken mints the customer session token. Email-only customers have
// an empty phone (and vice versa); both are carried in the result.
func (s Service) issueCustomerToken(ctx context.Context, customerID common.ID, phone string, email string) (CustomerAuthResult, error) {
	now := s.clock.Now()
	expiresAt := now.Add(customerTokenTTL)
	token, err := s.tokens.IssueCustomerAccessToken(ctx, ports.CustomerAccessTokenInput{
		CustomerID: customerID,
		Phone:      phone,
		IssuedAt:   now,
		ExpiresAt:  expiresAt,
	})
	if err != nil {
		return CustomerAuthResult{}, err
	}
	return CustomerAuthResult{
		CustomerID:  customerID,
		Phone:       phone,
		Email:       email,
		AccessToken: token,
		ExpiresAt:   expiresAt,
	}, nil
}

// ListOrders returns the signed-in customer's order history across all shops.
func (s Service) ListOrders(ctx context.Context, customerID common.ID) ([]ports.CustomerOrderSummary, error) {
	return s.repo.ListCustomerOrders(ctx, customerID)
}

// GetProfile returns the customer's editable identity (name, email, phone).
func (s Service) GetProfile(ctx context.Context, customerID common.ID) (ports.CustomerProfile, error) {
	return s.repo.GetCustomerProfile(ctx, customerID)
}

// UpdateProfile edits the customer's display name and email. Phone is immutable
// (it's the verified login).
func (s Service) UpdateProfile(ctx context.Context, customerID common.ID, displayName string, email string) (ports.CustomerProfile, error) {
	return s.repo.UpdateCustomerProfile(ctx, customerID, strings.TrimSpace(displayName), strings.TrimSpace(email))
}

// normalizeEmail lowercases and trims, and validates a basic x@y.z shape. It
// mirrors the business-side email normalisation (net/mail parsing) so the same
// addresses are accepted across the app.
func normalizeEmail(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", ErrInvalidEmail
	}
	address := strings.ToLower(parsed.Address)
	// mail.ParseAddress accepts addresses without a dotted domain (e.g. a@b);
	// require a dot in the domain for a basic x@y.z shape.
	at := strings.LastIndex(address, "@")
	if at < 1 || !strings.Contains(address[at+1:], ".") {
		return "", ErrInvalidEmail
	}
	return address, nil
}

var nonDigit = regexp.MustCompile(`\D`)

// normalizeGhanaPhone coerces local formats to canonical E.164 digits (233…),
// matching how WhatsApp recipients are stored.
func normalizeGhanaPhone(raw string) (string, error) {
	digits := nonDigit.ReplaceAllString(strings.TrimSpace(raw), "")
	switch {
	case strings.HasPrefix(digits, "233") && len(digits) == 12:
		// already canonical
	case strings.HasPrefix(digits, "0") && len(digits) == 10:
		digits = "233" + digits[1:]
	case len(digits) == 9:
		digits = "233" + digits
	default:
		return "", ErrInvalidPhone
	}
	return digits, nil
}

// maskPhone redacts the middle of a phone number for logs — enough to correlate
// a request without writing a full PII number to log storage (e.g. 233****789).
func maskPhone(phone string) string {
	if len(phone) <= 6 {
		return "***"
	}
	return phone[:3] + "****" + phone[len(phone)-3:]
}

// maskEmail keeps the domain and the first character of the local part for logs
// (e.g. a***@example.com) so an operator can correlate without logging full PII.
func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return "***"
	}
	local := email[:at]
	if len(local) <= 1 {
		return "*" + email[at:]
	}
	return local[:1] + "***" + email[at:]
}
