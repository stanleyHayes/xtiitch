package paymentsapp

import (
	"context"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/money"
)

// VATRateReader reports the live, admin-editable VAT rate (§4.1) from the
// platform settings. It is satisfied by the postgres platform-settings reader;
// declared here, in the consumer, to keep the dependency narrow (same shape as
// MoMoOTP). The rate applies to the Xtiitch fee on store sales (§4.2).
type VATRateReader interface {
	VATRateBps(ctx context.Context) (int, error)
}

// resolveVATRateBps returns the live VAT rate at charge time, so an admin
// change takes effect without a restart (§4.1). When no reader is wired — or
// the read fails — it falls back to the configured seed (the
// XTIITCH_SUBSCRIPTION_VAT_RATE_BPS env value), which is a fallback default
// only, never the runtime source.
func (s Service) resolveVATRateBps(ctx context.Context) int {
	if s.vatRates != nil {
		if rateBps, err := s.vatRates.VATRateBps(ctx); err == nil {
			return rateBps
		}
	}
	return s.vatRateBps
}

// QuoteStoreSaleCommand prices one store basket WITHOUT raising a charge: one
// amount per design in LineAmountsMinor (the per-design fee base, §4.3) and any
// uncommissioned basket amounts (a delivery fee) in UncostedMinor. It backs the
// public read-only checkout-quote endpoint, so the storefront renders exactly
// the breakdown the later charge will use (§4.5).
type QuoteStoreSaleCommand struct {
	Scope                   common.TenantScope
	LineAmountsMinor        []int64
	UncostedMinor           int64
	CommissionMinorOverride *int64
}

// QuoteStoreSale computes the §4.2–§4.6 fee/tax/pass-down breakdown for a store
// basket from the store's plan rate, its three pass-down tick boxes (§4.4) and
// the live VAT rate (§4.1). It is the same computation InitiateCharge charges,
// so quote and charge can never disagree.
func (s Service) QuoteStoreSale(ctx context.Context, cmd QuoteStoreSaleCommand) (money.StoreSaleQuote, error) {
	if cmd.Scope.BusinessID.IsZero() {
		return money.StoreSaleQuote{}, ErrInvalidCharge
	}
	for _, lineMinor := range cmd.LineAmountsMinor {
		if lineMinor <= 0 {
			return money.StoreSaleQuote{}, ErrInvalidCharge
		}
	}
	if cmd.UncostedMinor < 0 {
		return money.StoreSaleQuote{}, ErrInvalidCharge
	}
	if cmd.CommissionMinorOverride != nil && *cmd.CommissionMinorOverride < 0 {
		return money.StoreSaleQuote{}, ErrInvalidCharge
	}

	info, err := s.businesses.GetChargeContext(ctx, cmd.Scope)
	if err != nil {
		return money.StoreSaleQuote{}, err
	}
	return s.quoteStoreSale(ctx, cmd.LineAmountsMinor, cmd.UncostedMinor, cmd.CommissionMinorOverride, info), nil
}

// quoteStoreSale is the shared quote behind QuoteStoreSale and InitiateCharge:
// per-design capped fees + per-design VAT at the live rate, one Paystack fee on
// the total (grossed up when passed down), and the store's three pass-down tick
// boxes deciding which parts ride the customer's checkout lines (§4.2–§4.6).
func (s Service) quoteStoreSale(
	ctx context.Context,
	lineAmountsMinor []int64,
	uncostedMinor int64,
	commissionOverride *int64,
	info ports.BusinessChargeContext,
) money.StoreSaleQuote {
	return money.QuoteStoreSale(money.StoreSaleQuoteInput{
		LineAmountsMinor:        lineAmountsMinor,
		UncostedMinor:           uncostedMinor,
		CommissionBps:           info.CommissionBps,
		VATBps:                  s.resolveVATRateBps(ctx),
		PaystackBps:             money.PaystackFeeRateBps,
		CommissionOverrideMinor: commissionOverride,
		PassDown: money.PassDownFlags{
			XtiitchFee:  info.FeePassXtiitchFee,
			Tax:         info.FeePassTax,
			PaystackFee: info.FeePassPaystackFee,
		},
	})
}
