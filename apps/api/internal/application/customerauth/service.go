package customerauth

import (
	"context"
	"errors"
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
	ErrInvalidCode     = errors.New("invalid verification code")
	ErrCodeExpired     = errors.New("verification code expired or not requested")
	ErrTooManyAttempts = errors.New("too many attempts; request a new code")
)

type Service struct {
	repo     ports.CustomerAuthRepository
	tokens   ports.CustomerTokenIssuer
	otp      ports.OTPGenerator
	delivery ports.CustomerOTPDelivery
	ids      ports.IDGenerator
	clock    ports.Clock
}

type Dependencies struct {
	Repo     ports.CustomerAuthRepository
	Tokens   ports.CustomerTokenIssuer
	OTP      ports.OTPGenerator
	Delivery ports.CustomerOTPDelivery
	IDs      ports.IDGenerator
	Clock    ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{
		repo:     deps.Repo,
		tokens:   deps.Tokens,
		otp:      deps.OTP,
		delivery: deps.Delivery,
		ids:      deps.IDs,
		clock:    deps.Clock,
	}
}

// RequestOTP issues a one-time code to a phone. It always behaves the same
// whether or not a customer already exists, to avoid leaking who is registered.
func (s Service) RequestOTP(ctx context.Context, rawPhone string) error {
	phone, err := normalizeGhanaPhone(rawPhone)
	if err != nil {
		return err
	}
	code, err := s.otp.NewCode()
	if err != nil {
		return err
	}
	now := s.clock.Now()
	if err := s.repo.CreateOTPChallenge(ctx, ports.CreateOTPChallengeInput{
		ChallengeID: s.ids.NewID(),
		Phone:       phone,
		CodeHash:    s.otp.HashCode(code),
		ExpiresAt:   now.Add(otpTTL),
	}); err != nil {
		return err
	}
	return s.delivery.SendOTP(ctx, phone, code)
}

type CustomerAuthResult struct {
	CustomerID  common.ID
	Phone       string
	AccessToken string
	ExpiresAt   time.Time
}

// VerifyOTP checks the code and, on success, resolves/creates the customer and
// issues a customer session token.
func (s Service) VerifyOTP(ctx context.Context, rawPhone string, code string) (CustomerAuthResult, error) {
	phone, err := normalizeGhanaPhone(rawPhone)
	if err != nil {
		return CustomerAuthResult{}, err
	}
	now := s.clock.Now()

	challenge, err := s.repo.LatestActiveOTPChallenge(ctx, phone, now)
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return CustomerAuthResult{}, ErrCodeExpired
		}
		return CustomerAuthResult{}, err
	}
	if challenge.Attempts >= maxOTPAttempts {
		return CustomerAuthResult{}, ErrTooManyAttempts
	}
	if s.otp.HashCode(code) != challenge.CodeHash {
		_ = s.repo.IncrementOTPAttempts(ctx, challenge.ChallengeID)
		return CustomerAuthResult{}, ErrInvalidCode
	}
	if err := s.repo.ConsumeOTPChallenge(ctx, challenge.ChallengeID); err != nil {
		return CustomerAuthResult{}, err
	}

	customerID, err := s.repo.UpsertVerifiedCustomerByPhone(ctx, s.ids.NewID(), phone)
	if err != nil {
		return CustomerAuthResult{}, err
	}

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
		AccessToken: token,
		ExpiresAt:   expiresAt,
	}, nil
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
