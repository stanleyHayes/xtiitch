package adminauthhttp

type planCreateRequest struct {
	Code            string          `json:"code"`
	Name            string          `json:"name"`
	MonthlyFeeMinor int64           `json:"monthly_fee_minor"`
	YearlyFeeMinor  int64           `json:"yearly_fee_minor"`
	CommissionBPS   int             `json:"commission_bps"`
	DesignLimit     *int            `json:"design_limit"`
	Features        map[string]bool `json:"features"`
}

type planUpdateRequest struct {
	Name            string          `json:"name"`
	MonthlyFeeMinor int64           `json:"monthly_fee_minor"`
	YearlyFeeMinor  int64           `json:"yearly_fee_minor"`
	CommissionBPS   int             `json:"commission_bps"`
	DesignLimit     *int            `json:"design_limit"`
	Features        map[string]bool `json:"features"`
	IsActive        bool            `json:"is_active"`
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
	PlanID                  string          `json:"plan_id"`
	Code                    string          `json:"code"`
	Name                    string          `json:"name"`
	MonthlyFeeMinor         int64           `json:"monthly_fee_minor"`
	YearlyFeeMinor          int64           `json:"yearly_fee_minor"`
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
	Values      []planEntitlementValueResponse `json:"values"`
	CreatedAt   string                         `json:"created_at"`
	UpdatedAt   string                         `json:"updated_at"`
}

type planEntitlementValueResponse struct {
	PlanID     string `json:"plan_id"`
	PlanCode   string `json:"plan_code"`
	Enabled    bool   `json:"enabled"`
	LimitValue *int   `json:"limit_value,omitempty"`
	UpdatedAt  string `json:"updated_at"`
}
