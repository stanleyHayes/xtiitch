package adminauth

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// VATRateReader reports the live, admin-editable VAT rate (§4.1) from the
// platform settings. It is satisfied by the postgres platform-settings reader;
// declared here, in the consumer, to keep the dependency narrow (same shape as
// PlanChangeApplier). An admin change takes effect at the next charge without a
// restart.
type VATRateReader interface {
	VATRateBps(ctx context.Context) (int, error)
}

// resolveVATRateBps returns the live VAT rate for subscription charges, falling
// back to the configured seed (the XTIITCH_SUBSCRIPTION_VAT_RATE_BPS env value)
// when no reader is wired or the read fails.
func (s Service) resolveVATRateBps(ctx context.Context) int {
	if s.vatRates != nil {
		if rateBps, err := s.vatRates.VATRateBps(ctx); err == nil {
			return rateBps
		}
	}
	return s.vatRateBps
}

// subscriptionChargeTotal prices a subscription charge the admin side raises or
// books (operator authorization link, recurring renewal sweep, re-pay
// reminders): the package figure + VAT on the package at the live rate + a
// "Transaction fee" grossed up over package + VAT, so XCreativs nets package +
// VAT exactly after Paystack takes 1.95% of the total (§4.1, §4.6). It mirrors
// the activation path in auth.Service, so every subscription charge agrees.
func (s Service) subscriptionChargeTotal(ctx context.Context, baseMinor int64) int64 {
	return money.QuoteSubscriptionCharge(baseMinor, s.resolveVATRateBps(ctx), s.vatInclusive, money.PaystackFeeRateBps).TotalChargeMinor
}
