package ports

import (
	"context"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessAffiliateRepository interface {
	ListBusinessAffiliateProgrammes(
		ctx context.Context,
		scope common.TenantScope,
	) ([]BusinessAffiliateProgrammeRecord, error)
	CreateBusinessAffiliateProgramme(
		ctx context.Context,
		scope common.TenantScope,
		input BusinessAffiliateProgrammeInput,
	) (BusinessAffiliateProgrammeRecord, error)
	UpdateBusinessAffiliateProgramme(
		ctx context.Context,
		scope common.TenantScope,
		input BusinessAffiliateProgrammeInput,
	) (BusinessAffiliateProgrammeRecord, error)
	ListBusinessAffiliates(
		ctx context.Context,
		scope common.TenantScope,
	) ([]BusinessAffiliateRecord, error)
	CreateBusinessAffiliate(
		ctx context.Context,
		scope common.TenantScope,
		input BusinessAffiliateInput,
	) (BusinessAffiliateRecord, error)
	UpdateBusinessAffiliate(
		ctx context.Context,
		scope common.TenantScope,
		input BusinessAffiliateInput,
	) (BusinessAffiliateRecord, error)
	PauseBusinessAffiliate(
		ctx context.Context,
		scope common.TenantScope,
		affiliateID common.ID,
		actorBusinessUserID common.ID,
	) (BusinessAffiliateRecord, error)
	ListBusinessAffiliateAttribution(
		ctx context.Context,
		scope common.TenantScope,
	) ([]BusinessAffiliateAttributionRecord, error)
}

type BusinessAffiliateProgrammeRecord struct {
	AffiliateProgrammeID              common.ID
	BusinessID                        common.ID
	Name                              string
	Description                       string
	Status                            string
	DefaultPurchaseCommissionBPS      int
	DefaultFirstPaidPlanCommissionBPS int
	CookieWindowDays                  int
	HoldDays                          int
	PayoutMode                        string
	MinimumPayoutMinor                int64
	AllowedTargetScope                string
	AffiliateCount                    int64
	CreatedAt                         time.Time
	UpdatedAt                         time.Time
}

type BusinessAffiliateProgrammeInput struct {
	AffiliateProgrammeID              common.ID
	BusinessID                        common.ID
	Name                              string
	Description                       string
	Status                            string
	DefaultPurchaseCommissionBPS      int
	DefaultFirstPaidPlanCommissionBPS int
	CookieWindowDays                  int
	HoldDays                          int
	PayoutMode                        string
	MinimumPayoutMinor                int64
	AllowedTargetScope                string
	ActorBusinessUserID               common.ID
}

type BusinessAffiliateRecord struct {
	AffiliateID                common.ID
	AffiliateProgrammeID       common.ID
	ProgrammeName              string
	Code                       string
	DisplayName                string
	ContactName                string
	Email                      string
	Phone                      string
	PurchaseCommissionBPS      int
	FirstPaidPlanCommissionBPS int
	CookieWindowDays           int
	Status                     string
	TargetScope                string
	TargetRefID                *common.ID
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
}

type BusinessAffiliateInput struct {
	AffiliateID                common.ID
	AffiliateProgrammeID       common.ID
	BusinessID                 common.ID
	Code                       string
	DisplayName                string
	ContactName                string
	Email                      string
	Phone                      string
	PurchaseCommissionBPS      int
	FirstPaidPlanCommissionBPS int
	CookieWindowDays           int
	Status                     string
	TargetScope                string
	TargetRefID                *common.ID
	ActorBusinessUserID        common.ID
}

type BusinessAffiliateAttributionRecord struct {
	AffiliateID     common.ID
	Code            string
	DisplayName     string
	ClickCount      int64
	SignupCount     int64
	ConversionCount int64
	GrossMinor      int64
	CommissionMinor int64
	LastActivityAt  *time.Time
}
