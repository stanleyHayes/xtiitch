package authhttp

type publicPlanResponse struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	MonthlyFeeMinor int    `json:"monthly_fee_minor"`
	YearlyFeeMinor  int    `json:"yearly_fee_minor"`
	CommissionBps   int    `json:"commission_bps"`
	DesignLimit     *int   `json:"design_limit,omitempty"`
	// Pricing Book cadence figures (minor units): the first paid subscription
	// bills the *first* figure, every renewal bills the *renewal* figure.
	QuarterlyFirstMinor   int `json:"quarterly_first_minor"`
	QuarterlyRenewalMinor int `json:"quarterly_renewal_minor"`
	YearlyFirstMinor      int `json:"yearly_first_minor"`
	YearlyRenewalMinor    int `json:"yearly_renewal_minor"`
	// VAT applied to subscription charges (Pricing Book tax decision flag). The
	// same policy applies to every plan and cadence: vat_rate_bps 0 means no VAT;
	// vat_inclusive=false means VAT is added on top of the figures above at
	// checkout, true means the figures already include it.
	VATRateBps   int  `json:"vat_rate_bps"`
	VATInclusive bool `json:"vat_inclusive"`
}

type subscriptionAuthorizationLinkRequest struct {
	CallbackURL string `json:"callback_url"`
	// PlanCode is the target plan being activated/upgraded to; when set and it
	// differs from the current plan it is parked as payment-pending (the plan
	// switch itself only happens once Paystack verifies the payment).
	PlanCode string `json:"plan_code"`
	// BillingCadence is the owner's chosen cadence: 'quarterly' or 'yearly'.
	BillingCadence string `json:"billing_cadence"`
	// Code is an optional subscription discount code applied at checkout.
	Code string `json:"code"`
}

type subscriptionAuthorizationLinkResponse struct {
	BusinessID   string `json:"business_id"`
	BusinessName string `json:"business_name"`
	OwnerEmail   string `json:"owner_email"`
	RedirectURL  string `json:"redirect_url"`
	AccessCode   string `json:"access_code"`
	Reference    string `json:"reference"`
	// Activated is true when the plan went live immediately with no Paystack
	// checkout (a free_period/full discount, or a period already paid). The
	// dashboard then shows success instead of redirecting to a payment page.
	Activated bool `json:"activated"`
}

type subscriptionAuthorizationVerifyRequest struct {
	Reference string `json:"reference"`
}

type subscriptionAuthorizationVerifyResponse struct {
	SubscriptionID          string `json:"subscription_id"`
	BusinessID              string `json:"business_id"`
	Status                  string `json:"status"`
	BillingMode             string `json:"billing_mode"`
	ProviderCustomerRef     string `json:"provider_customer_ref"`
	ProviderSubscriptionRef string `json:"provider_subscription_ref"`
}

// subscriptionActivationResponse is the dashboard activation banner/page payload:
// whether the paid plan has activated (paid its first invoice), its status, plan
// code/name, and the first-purchase amount due to activate.
type subscriptionActivationResponse struct {
	Activated      bool   `json:"activated"`
	Status         string `json:"status"`
	PlanCode       string `json:"plan_code"`
	PlanName       string `json:"plan_name"`
	AmountDueMinor int    `json:"amount_due_minor"`
}

type changeSubscriptionPlanRequest struct {
	PlanCode string `json:"plan_code"`
}

type changeSubscriptionPlanResponse struct {
	PlanCode string `json:"plan_code"`
	// Immediate is true for an applied upgrade, false for a downgrade scheduled at
	// the next renewal.
	Immediate bool `json:"immediate"`
	// ProratedChargeMinor is what was charged now for the remainder of the current
	// period (upgrade); 0 for a downgrade or a zero-difference upgrade.
	ProratedChargeMinor int64 `json:"prorated_charge_minor"`
	// EffectiveAt is when the new plan takes effect (now for an upgrade, the period
	// end for a scheduled downgrade), RFC3339.
	EffectiveAt string `json:"effective_at"`
}
