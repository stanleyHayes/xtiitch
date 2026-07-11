package adminauthhttp

import (
	"time"
)

type referralProgrammeUpsertRequest struct {
	Title                   string     `json:"title"`
	CodePrefix              string     `json:"code_prefix"`
	Audience                string     `json:"audience"`
	ReferrerRewardKind      string     `json:"referrer_reward_kind"`
	RefereeRewardKind       string     `json:"referee_reward_kind"`
	RewardType              string     `json:"reward_type"`
	RewardValue             int64      `json:"reward_value"`
	MaxRewardMinor          *int64     `json:"max_reward_minor"`
	QualifyingOrderMinMinor int64      `json:"qualifying_order_min_minor"`
	RewardHoldDays          int        `json:"reward_hold_days"`
	Status                  string     `json:"status"`
	StartsAt                *time.Time `json:"starts_at"`
	EndsAt                  *time.Time `json:"ends_at"`
	Notes                   string     `json:"notes"`
}

type referralProgrammeArchiveRequest struct {
	Reason string `json:"reason"`
}

type referralCodeCreateRequest struct {
	BusinessID string `json:"business_id"`
	OwnerType  string `json:"owner_type"`
	Code       string `json:"code"`
	Status     string `json:"status"`
}

type referralRewardIssueRequest struct {
	Limit int `json:"limit"`
}

type supportTicketUpdateRequest struct {
	Status     string `json:"status"`
	Assignment string `json:"assignment"`
	Note       string `json:"note"`
}

type referralRewardIssueResponse struct {
	ReferralCount         int    `json:"referral_count"`
	RewardCount           int    `json:"reward_count"`
	VoucherCount          int    `json:"voucher_count"`
	CommissionRebateCount int    `json:"commission_rebate_count"`
	TotalRewardMinor      int64  `json:"total_reward_minor"`
	IssuedAt              string `json:"issued_at"`
}

type referralProgrammeResponse struct {
	ProgrammeID             string                 `json:"programme_id"`
	Title                   string                 `json:"title"`
	CodePrefix              string                 `json:"code_prefix"`
	Audience                string                 `json:"audience"`
	ReferrerRewardKind      string                 `json:"referrer_reward_kind"`
	RefereeRewardKind       string                 `json:"referee_reward_kind"`
	RewardType              string                 `json:"reward_type"`
	RewardValue             int64                  `json:"reward_value"`
	MaxRewardMinor          *int64                 `json:"max_reward_minor,omitempty"`
	QualifyingOrderMinMinor int64                  `json:"qualifying_order_min_minor"`
	RewardHoldDays          int                    `json:"reward_hold_days"`
	Status                  string                 `json:"status"`
	StartsAt                string                 `json:"starts_at,omitempty"`
	EndsAt                  string                 `json:"ends_at,omitempty"`
	Notes                   string                 `json:"notes"`
	Codes                   []referralCodeResponse `json:"codes"`
	CreatedAt               string                 `json:"created_at"`
	UpdatedAt               string                 `json:"updated_at"`
}

type referralCodeResponse struct {
	ReferralCodeID  string `json:"referral_code_id"`
	ProgrammeID     string `json:"programme_id"`
	BusinessID      string `json:"business_id,omitempty"`
	BusinessName    string `json:"business_name"`
	BusinessHandle  string `json:"business_handle"`
	OwnerType       string `json:"owner_type"`
	OwnerBusinessID string `json:"owner_business_id,omitempty"`
	OwnerCustomerID string `json:"owner_customer_id,omitempty"`
	OwnerLabel      string `json:"owner_label"`
	Code            string `json:"code"`
	Status          string `json:"status"`
	ReferralCount   int    `json:"referral_count"`
	QualifiedCount  int    `json:"qualified_count"`
	RewardedCount   int    `json:"rewarded_count"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

type supportTicketResponse struct {
	TicketKey           string `json:"ticket_key"`
	BusinessID          string `json:"business_id"`
	Subject             string `json:"subject"`
	Business            string `json:"business"`
	Priority            string `json:"priority"`
	Summary             string `json:"summary"`
	Category            string `json:"category"`
	Status              string `json:"status"`
	AssignedAdminUserID string `json:"assigned_admin_user_id,omitempty"`
	AssignedAdminEmail  string `json:"assigned_admin_email,omitempty"`
	AssignedAdminName   string `json:"assigned_admin_name,omitempty"`
	CreatedAt           string `json:"created_at"`
	UpdatedAt           string `json:"updated_at"`
}
