package common

import (
	"errors"
	"regexp"
	"strings"
)

// ErrInvalidPhone marks a value no accepted Ghana-phone form can be coerced
// from. Callers with their own sentinel (ErrInvalidPhone in the auth packages,
// ErrInvalidPayoutNumber in payments) map this to theirs at the boundary.
var ErrInvalidPhone = errors.New("invalid phone number")

var nonDigit = regexp.MustCompile(`\D`)

// NormalizeGhanaPhone coerces a Ghana mobile number to canonical E.164 digits
// 233XXXXXXXXX (12 digits) — the single storage and lookup form for customer
// identity (§5.3.4: one customer account, everywhere). It accepts the
// canonical form, the local 0XXXXXXXXX form, and a bare 9-digit local number,
// and ignores spaces, dashes, a leading '+' and other non-digit separators.
// Everything else is rejected.
func NormalizeGhanaPhone(raw string) (string, error) {
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
