package adminauthhttp

import (
	"time"
)

type subscriptionUpdateRequest struct {
	Status                  string `json:"status"`
	BillingMode             string `json:"billing_mode"`
	ProviderCustomerRef     string `json:"provider_customer_ref"`
	ProviderSubscriptionRef string `json:"provider_subscription_ref"`
	Reason                  string `json:"reason"`
}

type subscriptionInvoiceIssueRequest struct {
	ProviderInvoiceRef string     `json:"provider_invoice_ref"`
	PaymentURL         string     `json:"payment_url"`
	DueAt              *time.Time `json:"due_at"`
	Reason             string     `json:"reason"`
}

type subscriptionInvoiceDecisionRequest struct {
	Reason string `json:"reason"`
}

type subscriptionBillingSweepRequest struct {
	Reason string `json:"reason"`
}

type subscriptionAuthorizationInitRequest struct {
	CallbackURL string `json:"callback_url"`
	Reason      string `json:"reason"`
}

type subscriptionAuthorizationVerifyRequest struct {
	Reference string `json:"reference"`
	Reason    string `json:"reason"`
}

type subscriptionResponse struct {
	SubscriptionID  string `json:"subscription_id,omitempty"`
	BusinessID      string `json:"business_id"`
	BusinessName    string `json:"business_name"`
	Handle          string `json:"handle"`
	OwnerName       string `json:"owner_name"`
	OwnerPhone      string `json:"owner_phone"`
	OwnerEmail      string `json:"owner_email"`
	OwnerWhatsApp   string `json:"owner_whatsapp"`
	PlanCode        string `json:"plan_code"`
	PlanName        string `json:"plan_name"`
	MonthlyFeeMinor int64  `json:"monthly_fee_minor"`
	CommissionBPS   int    `json:"commission_bps"`
	DesignLimit     *int   `json:"design_limit,omitempty"`
	DesignCount     int    `json:"design_count"`
	Status          string `json:"status"`
	BillingMode     string `json:"billing_mode"`
	// BillingCadence is how often this subscription RENEWS ('quarterly'/'yearly',
	// or '' when the owner has not chosen yet). Distinct from BillingMode, which is
	// HOW it is collected (manual / payment_link / recurring). The CRM lists and
	// filters by cadence (Pricing Book §6.2), so it must not read billing_mode for
	// it — they answer different questions.
	BillingCadence          string                        `json:"billing_cadence"`
	Provider                string                        `json:"provider"`
	ProviderCustomerRef     string                        `json:"provider_customer_ref"`
	ProviderSubscriptionRef string                        `json:"provider_subscription_ref"`
	CurrentPeriodStart      string                        `json:"current_period_start"`
	CurrentPeriodEnd        string                        `json:"current_period_end"`
	TrialEndsAt             string                        `json:"trial_ends_at,omitempty"`
	GraceEndsAt             string                        `json:"grace_ends_at,omitempty"`
	CancelAtPeriodEnd       bool                          `json:"cancel_at_period_end"`
	CanceledAt              string                        `json:"canceled_at,omitempty"`
	FailedPaymentCount      int                           `json:"failed_payment_count"`
	LastInvoiceRef          string                        `json:"last_invoice_ref"`
	LastPaymentAt           string                        `json:"last_payment_at,omitempty"`
	NextBillingAt           string                        `json:"next_billing_at,omitempty"`
	SignupAt                string                        `json:"signup_at"`
	RenewalAt               string                        `json:"renewal_at,omitempty"`
	StoreLink               string                        `json:"store_link"`
	DiscountCode            string                        `json:"discount_code"`
	DiscountInstitution     string                        `json:"discount_institution"`
	LastActiveAt            string                        `json:"last_active_at"`
	Orders                  int                           `json:"orders"`
	GMVMinor                int64                         `json:"gmv_minor"`
	CommissionMinor         int64                         `json:"commission_minor"`
	UpdatedAt               string                        `json:"updated_at"`
	Events                  []subscriptionEventResponse   `json:"events"`
	Invoices                []subscriptionInvoiceResponse `json:"invoices"`
}

type subscriptionInvoiceResponse struct {
	InvoiceID          string `json:"invoice_id"`
	SubscriptionID     string `json:"subscription_id"`
	InvoiceRef         string `json:"invoice_ref"`
	Status             string `json:"status"`
	BillingMode        string `json:"billing_mode"`
	Provider           string `json:"provider"`
	ProviderInvoiceRef string `json:"provider_invoice_ref"`
	PaymentURL         string `json:"payment_url"`
	AmountMinor        int64  `json:"amount_minor"`
	Currency           string `json:"currency"`
	PeriodStart        string `json:"period_start"`
	PeriodEnd          string `json:"period_end"`
	DueAt              string `json:"due_at"`
	PaidAt             string `json:"paid_at,omitempty"`
	FailedAt           string `json:"failed_at,omitempty"`
	FailureReason      string `json:"failure_reason"`
	CreatedAt          string `json:"created_at"`
	UpdatedAt          string `json:"updated_at"`
}

type subscriptionBillingSweepResponse struct {
	OverdueInvoicesFailed int    `json:"overdue_invoices_failed"`
	SubscriptionsCanceled int    `json:"subscriptions_canceled"`
	BusinessesTouched     int    `json:"businesses_touched"`
	RanAt                 string `json:"ran_at"`
}

type subscriptionRecurringSweepResponse struct {
	DueSubscriptions             int    `json:"due_subscriptions"`
	ChargesAttempted             int    `json:"charges_attempted"`
	ChargesPaid                  int    `json:"charges_paid"`
	ChargesPending               int    `json:"charges_pending"`
	ChargesFailed                int    `json:"charges_failed"`
	ChargesSkipped               int    `json:"charges_skipped"`
	SubscriptionsAwaitingCadence int    `json:"subscriptions_awaiting_cadence"`
	RanAt                        string `json:"ran_at"`
}

type subscriptionReminderSweepResponse struct {
	SubscriptionsEvaluated int    `json:"subscriptions_evaluated"`
	RemindersEnqueued      int    `json:"reminders_enqueued"`
	EmailsSent             int    `json:"emails_sent"`
	EmailsFailed           int    `json:"emails_failed"`
	RanAt                  string `json:"ran_at"`
}

type subscriptionAuthorizationLinkResponse struct {
	BusinessID   string `json:"business_id"`
	BusinessName string `json:"business_name"`
	OwnerEmail   string `json:"owner_email"`
	RedirectURL  string `json:"redirect_url"`
	AccessCode   string `json:"access_code"`
	Reference    string `json:"reference"`
}

type subscriptionEventResponse struct {
	SubscriptionEventID string `json:"subscription_event_id"`
	EventType           string `json:"event_type"`
	Summary             string `json:"summary"`
	ActorEmail          string `json:"actor_email"`
	CreatedAt           string `json:"created_at"`
}
