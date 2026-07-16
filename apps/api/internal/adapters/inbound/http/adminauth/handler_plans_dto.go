package adminauthhttp

// planCadenceRequest carries the figures that are actually charged (per quarter
// / per year, first cycle vs renewal). Monthly is a reference rate only.
type planCadenceRequest struct {
	QuarterlyFirstMinor   int64 `json:"quarterly_first_minor"`
	QuarterlyRenewalMinor int64 `json:"quarterly_renewal_minor"`
	YearlyFirstMinor      int64 `json:"yearly_first_minor"`
	YearlyRenewalMinor    int64 `json:"yearly_renewal_minor"`
}

type planCreateRequest struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	MonthlyFeeMinor int64  `json:"monthly_fee_minor"`
	YearlyFeeMinor  int64  `json:"yearly_fee_minor"`
	planCadenceRequest
	CommissionBPS int             `json:"commission_bps"`
	DesignLimit   *int            `json:"design_limit"`
	Features      map[string]bool `json:"features"`
}

type planUpdateRequest struct {
	Name            string `json:"name"`
	MonthlyFeeMinor int64  `json:"monthly_fee_minor"`
	YearlyFeeMinor  int64  `json:"yearly_fee_minor"`
	planCadenceRequest
	CommissionBPS int             `json:"commission_bps"`
	DesignLimit   *int            `json:"design_limit"`
	Features      map[string]bool `json:"features"`
	IsActive      bool            `json:"is_active"`
}

type planArchiveRequest struct {
	Reason string `json:"reason"`
}

type planEntitlementValueRequest struct {
	PlanID     string `json:"plan_id"`
	FeatureKey string `json:"feature_key"`
	Enabled    bool   `json:"enabled"`
	LimitValue *int   `json:"limit_value"`
}

type planEntitlementUpdateRequest struct {
	Values []planEntitlementValueRequest `json:"values"`
}

type planResponse struct {
	PlanID          string `json:"plan_id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	MonthlyFeeMinor int64  `json:"monthly_fee_minor"`
	YearlyFeeMinor  int64  `json:"yearly_fee_minor"`
	planCadenceRequest
	CommissionBPS           int             `json:"commission_bps"`
	DesignLimit             *int            `json:"design_limit,omitempty"`
	Features                map[string]bool `json:"features"`
	IsActive                bool            `json:"is_active"`
	BusinessCount           int             `json:"business_count"`
	ActiveSubscriptionCount int             `json:"active_subscription_count"`
	EstimatedMRRMinor       int64           `json:"estimated_mrr_minor"`
	CreatedAt               string          `json:"created_at"`
	UpdatedAt               string          `json:"updated_at"`
}

type planEntitlementFeatureResponse struct {
	FeatureKey  string                         `json:"feature_key"`
	Label       string                         `json:"label"`
	Description string                         `json:"description"`
	Category    string                         `json:"category"`
	ValueType   string                         `json:"value_type"`
	Unit        string                         `json:"unit"`
	SortOrder   int                            `json:"sort_order"`
	IsActive    bool                           `json:"is_active"`
	// Enforced is false for keys the API stores and lets you edit but does not
	// gate on, so the console can label them instead of implying they work.
	Enforced  bool                           `json:"enforced"`
	Values    []planEntitlementValueResponse `json:"values"`
	CreatedAt string                         `json:"created_at"`
	UpdatedAt string                         `json:"updated_at"`
}

type planEntitlementValueResponse struct {
	PlanID     string `json:"plan_id"`
	PlanCode   string `json:"plan_code"`
	Enabled    bool   `json:"enabled"`
	LimitValue *int   `json:"limit_value,omitempty"`
	UpdatedAt  string `json:"updated_at"`
}
