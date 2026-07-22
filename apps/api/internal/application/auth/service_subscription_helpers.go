package authapp

import (
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
)

// parseUpgradeReferenceSuffix reads current cadence_due_nonce references and
// the legacy due_nonce shape so checkouts opened just before deployment remain
// verifiable.
func parseUpgradeReferenceSuffix(parts []string, fallbackCadence string) (string, int64, error) {
	if len(parts) != 2 && len(parts) != 3 {
		return "", 0, authdomain.ErrInvalidInput
	}
	cadence := fallbackCadence
	dueIndex, nonceIndex := 0, 1
	if len(parts) == 3 {
		cadence = parts[0]
		dueIndex, nonceIndex = 1, 2
	}
	normalizedCadence, err := normalizeBillingCadence(cadence)
	if err != nil {
		return "", 0, err
	}
	dueMinor, err := strconv.ParseInt(parts[dueIndex], 10, 64)
	if err != nil || dueMinor <= 0 {
		return "", 0, authdomain.ErrInvalidInput
	}
	if _, err := strconv.ParseInt(parts[nonceIndex], 10, 64); err != nil {
		return "", 0, authdomain.ErrInvalidInput
	}
	return normalizedCadence, dueMinor, nil
}

func normalizeBillingCadence(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "quarterly":
		return "quarterly", nil
	case "yearly":
		return "yearly", nil
	default:
		return "", authdomain.ErrInvalidInput
	}
}

// activationChargeMinor returns the stored intro or renewal amount for the
// selected cadence; Pricing Book figures are never computed live.
func activationChargeMinor(sub ports.BusinessSubscriptionRecord, cadence string) int64 {
	switch cadence {
	case "quarterly":
		if sub.FirstPurchaseConsumed {
			return int64(sub.QuarterlyRenewalMinor)
		}
		return int64(sub.QuarterlyFirstMinor)
	case "yearly":
		if sub.FirstPurchaseConsumed {
			return int64(sub.YearlyRenewalMinor)
		}
		return int64(sub.YearlyFirstMinor)
	default:
		return 0
	}
}

func normalizeAuthorizationChannel(channel string) string {
	return strings.ToLower(strings.TrimSpace(channel))
}

func containsFold(values []string, target string) bool {
	trimmedTarget := strings.TrimSpace(target)
	for _, value := range values {
		if strings.EqualFold(strings.TrimSpace(value), trimmedTarget) {
			return true
		}
	}
	return false
}
