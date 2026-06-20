package auth

import "errors"

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidInput       = errors.New("invalid auth input")
	ErrForbidden          = errors.New("forbidden")

	// ErrResetCodeInvalid covers a wrong, expired, already-used, or
	// too-many-attempts password-reset code. Deliberately one error so the
	// response never reveals which of those it was.
	ErrResetCodeInvalid = errors.New("invalid or expired reset code")

	// MFA (opt-in authenticator-app two-factor).
	ErrMFAAlreadyEnabled = errors.New("mfa already enabled")
	ErrMFANotEnrolled    = errors.New("mfa enrolment not started")
	ErrMFANotEnabled     = errors.New("mfa not enabled")
	ErrInvalidMFACode    = errors.New("invalid mfa code")
)
