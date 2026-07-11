package authapp

import (
	"log/slog"
	"net/mail"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
)

type Service struct {
	businesses    ports.BusinessIdentityRepository
	payments      ports.PaymentProvider
	sessions      ports.AuthSessionRepository
	passwords     ports.PasswordHasher
	accessTokens  ports.TokenIssuer
	refreshTokens ports.RefreshTokenIssuer
	emails        ports.EmailSender
	resets        ports.PasswordResetRepository
	dashboardURL  string
	ids           ports.IDGenerator
	clock         ports.Clock
	mfa           ports.MFARepository
	mfaSecrets    ports.MFASecrets
	mfaChallenges ports.MFAChallengeIssuer
	mfaVerifier   ports.MFAChallengeVerifier
	// WhatsApp one-time-code sign-in is optional (like MFA): when any is nil the
	// WhatsApp auth endpoints are disabled and password login is unaffected.
	whatsAppAuth ports.BusinessWhatsAppAuthRepository
	otpGen       ports.OTPGenerator
	whatsAppOTP  ports.CustomerOTPDelivery
	// discounts backs optional subscription discount-code redemption at checkout.
	// When nil, no code is accepted (a supplied code is rejected, never silently
	// ignored) and the plain intro/renewal charge path is unaffected.
	discounts ports.SubscriptionDiscountRepository
	// vatRateBps / vatInclusive apply VAT to subscription charges (activation,
	// renewal, upgrade proration). 0 disables VAT (behaviour unchanged); see
	// money.ApplyVAT. inclusive=false adds VAT on top of the listed price.
	vatRateBps   int
	vatInclusive bool
	// logger records auth-flow events (OTP send/verify, best-effort side effects)
	// so failures are visible instead of silently swallowed.
	logger *slog.Logger
}

type Dependencies struct {
	Businesses    ports.BusinessIdentityRepository
	Payments      ports.PaymentProvider
	Sessions      ports.AuthSessionRepository
	Passwords     ports.PasswordHasher
	AccessTokens  ports.TokenIssuer
	RefreshTokens ports.RefreshTokenIssuer
	Emails        ports.EmailSender
	Resets        ports.PasswordResetRepository
	DashboardURL  string
	IDs           ports.IDGenerator
	Clock         ports.Clock
	// MFA dependencies are optional: when any is nil, MFA enrolment/verification
	// is disabled and login always issues a session directly.
	MFA           ports.MFARepository
	MFASecrets    ports.MFASecrets
	MFAChallenges ports.MFAChallengeIssuer
	MFAVerifier   ports.MFAChallengeVerifier
	// Optional WhatsApp one-time-code sign-in dependencies.
	WhatsAppAuth ports.BusinessWhatsAppAuthRepository
	OTPGen       ports.OTPGenerator
	WhatsAppOTP  ports.CustomerOTPDelivery
	// Optional subscription discount-code redemption at checkout. When nil, codes
	// are unavailable and a supplied code is rejected.
	Discounts ports.SubscriptionDiscountRepository
	// VAT applied to subscription charges. VATRateBps 0 (default) disables it;
	// VATInclusive=false adds it at checkout, true treats listed prices as inclusive.
	VATRateBps   int
	VATInclusive bool
	// Logger records auth-flow events; when nil, slog.Default() is used.
	Logger *slog.Logger
}

func NewService(deps Dependencies) Service {
	logger := deps.Logger
	if logger == nil {
		logger = slog.Default()
	}
	return Service{
		businesses:    deps.Businesses,
		payments:      deps.Payments,
		sessions:      deps.Sessions,
		passwords:     deps.Passwords,
		accessTokens:  deps.AccessTokens,
		refreshTokens: deps.RefreshTokens,
		emails:        deps.Emails,
		resets:        deps.Resets,
		dashboardURL:  strings.TrimRight(strings.TrimSpace(deps.DashboardURL), "/"),
		ids:           deps.IDs,
		clock:         deps.Clock,
		mfa:           deps.MFA,
		mfaSecrets:    deps.MFASecrets,
		mfaChallenges: deps.MFAChallenges,
		mfaVerifier:   deps.MFAVerifier,
		whatsAppAuth:  deps.WhatsAppAuth,
		otpGen:        deps.OTPGen,
		whatsAppOTP:   deps.WhatsAppOTP,
		discounts:     deps.Discounts,
		vatRateBps:    deps.VATRateBps,
		vatInclusive:  deps.VATInclusive,
		logger:        logger,
	}
}

func normalizeEmail(value string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}

	return strings.ToLower(parsed.Address), nil
}
