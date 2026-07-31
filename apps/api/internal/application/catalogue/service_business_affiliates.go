package catalogueapp

import (
	"context"
	"net/mail"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type BusinessAffiliateProgrammeCommand struct {
	Scope                             common.TenantScope
	ActorUserID                       common.ID
	ActorRole                         business.UserRole
	AffiliateProgrammeID              common.ID
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
}

type BusinessAffiliateCommand struct {
	Scope                      common.TenantScope
	ActorUserID                common.ID
	ActorRole                  business.UserRole
	AffiliateID                common.ID
	AffiliateProgrammeID       common.ID
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
}

func (s Service) ListBusinessAffiliateProgrammes(
	ctx context.Context,
	scope common.TenantScope,
	role business.UserRole,
) ([]ports.BusinessAffiliateProgrammeRecord, error) {
	if err := authorizeCatalogueManagement(scope, role); err != nil {
		return nil, err
	}
	if s.affiliates == nil {
		return nil, ErrInvalidInput
	}
	return s.affiliates.ListBusinessAffiliateProgrammes(ctx, scope)
}

func (s Service) CreateBusinessAffiliateProgramme(
	ctx context.Context,
	cmd BusinessAffiliateProgrammeCommand,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	if err := authorizeBusinessAffiliateCommand(cmd.Scope, cmd.ActorUserID, cmd.ActorRole); err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	input, err := normalizeBusinessAffiliateProgramme(cmd, s.ids.NewID())
	if err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	return s.affiliates.CreateBusinessAffiliateProgramme(ctx, cmd.Scope, input)
}

func (s Service) UpdateBusinessAffiliateProgramme(
	ctx context.Context,
	cmd BusinessAffiliateProgrammeCommand,
) (ports.BusinessAffiliateProgrammeRecord, error) {
	if err := authorizeBusinessAffiliateCommand(cmd.Scope, cmd.ActorUserID, cmd.ActorRole); err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	if cmd.AffiliateProgrammeID.IsZero() {
		return ports.BusinessAffiliateProgrammeRecord{}, ErrInvalidInput
	}
	input, err := normalizeBusinessAffiliateProgramme(cmd, cmd.AffiliateProgrammeID)
	if err != nil {
		return ports.BusinessAffiliateProgrammeRecord{}, err
	}
	return s.affiliates.UpdateBusinessAffiliateProgramme(ctx, cmd.Scope, input)
}

func (s Service) ListBusinessAffiliates(
	ctx context.Context,
	scope common.TenantScope,
	role business.UserRole,
) ([]ports.BusinessAffiliateRecord, error) {
	if err := authorizeCatalogueManagement(scope, role); err != nil {
		return nil, err
	}
	if s.affiliates == nil {
		return nil, ErrInvalidInput
	}
	return s.affiliates.ListBusinessAffiliates(ctx, scope)
}

func (s Service) CreateBusinessAffiliate(
	ctx context.Context,
	cmd BusinessAffiliateCommand,
) (ports.BusinessAffiliateRecord, error) {
	if err := authorizeBusinessAffiliateCommand(cmd.Scope, cmd.ActorUserID, cmd.ActorRole); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	input, err := normalizeBusinessAffiliate(cmd, s.ids.NewID())
	if err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	return s.affiliates.CreateBusinessAffiliate(ctx, cmd.Scope, input)
}

func (s Service) UpdateBusinessAffiliate(
	ctx context.Context,
	cmd BusinessAffiliateCommand,
) (ports.BusinessAffiliateRecord, error) {
	if err := authorizeBusinessAffiliateCommand(cmd.Scope, cmd.ActorUserID, cmd.ActorRole); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	if cmd.AffiliateID.IsZero() {
		return ports.BusinessAffiliateRecord{}, ErrInvalidInput
	}
	input, err := normalizeBusinessAffiliate(cmd, cmd.AffiliateID)
	if err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	return s.affiliates.UpdateBusinessAffiliate(ctx, cmd.Scope, input)
}

func (s Service) PauseBusinessAffiliate(
	ctx context.Context,
	scope common.TenantScope,
	actorUserID common.ID,
	role business.UserRole,
	affiliateID common.ID,
) (ports.BusinessAffiliateRecord, error) {
	if err := authorizeBusinessAffiliateCommand(scope, actorUserID, role); err != nil {
		return ports.BusinessAffiliateRecord{}, err
	}
	if affiliateID.IsZero() {
		return ports.BusinessAffiliateRecord{}, ErrInvalidInput
	}
	return s.affiliates.PauseBusinessAffiliate(
		ctx,
		scope,
		affiliateID,
		actorUserID,
	)
}

func (s Service) ListBusinessAffiliateAttribution(
	ctx context.Context,
	scope common.TenantScope,
	role business.UserRole,
) ([]ports.BusinessAffiliateAttributionRecord, error) {
	if err := authorizeCatalogueManagement(scope, role); err != nil {
		return nil, err
	}
	if s.affiliates == nil {
		return nil, ErrInvalidInput
	}
	return s.affiliates.ListBusinessAffiliateAttribution(ctx, scope)
}

func authorizeBusinessAffiliateCommand(
	scope common.TenantScope,
	actorUserID common.ID,
	role business.UserRole,
) error {
	if actorUserID.IsZero() {
		return ErrInvalidInput
	}
	return authorizeCatalogueManagement(scope, role)
}

func normalizeBusinessAffiliateProgramme(
	cmd BusinessAffiliateProgrammeCommand,
	programmeID common.ID,
) (ports.BusinessAffiliateProgrammeInput, error) {
	name := strings.Join(strings.Fields(cmd.Name), " ")
	status := strings.TrimSpace(cmd.Status)
	payoutMode := strings.TrimSpace(cmd.PayoutMode)
	targetScope := strings.TrimSpace(cmd.AllowedTargetScope)
	if name == "" ||
		!validBusinessProgrammeStatus(status) ||
		!validBusinessPayoutMode(payoutMode) ||
		!validBusinessAffiliateTargetScope(targetScope) ||
		cmd.DefaultPurchaseCommissionBPS < 0 ||
		cmd.DefaultPurchaseCommissionBPS > 10000 ||
		cmd.DefaultFirstPaidPlanCommissionBPS < 0 ||
		cmd.DefaultFirstPaidPlanCommissionBPS > 10000 ||
		cmd.CookieWindowDays < 1 || cmd.CookieWindowDays > 365 ||
		cmd.HoldDays < 0 || cmd.HoldDays > 365 ||
		cmd.MinimumPayoutMinor < 0 {
		return ports.BusinessAffiliateProgrammeInput{}, ErrInvalidInput
	}
	return ports.BusinessAffiliateProgrammeInput{
		AffiliateProgrammeID: programmeID, BusinessID: cmd.Scope.BusinessID,
		Name: name, Description: strings.TrimSpace(cmd.Description), Status: status,
		DefaultPurchaseCommissionBPS:      cmd.DefaultPurchaseCommissionBPS,
		DefaultFirstPaidPlanCommissionBPS: cmd.DefaultFirstPaidPlanCommissionBPS,
		CookieWindowDays:                  cmd.CookieWindowDays, HoldDays: cmd.HoldDays,
		PayoutMode: payoutMode, MinimumPayoutMinor: cmd.MinimumPayoutMinor,
		AllowedTargetScope: targetScope, ActorBusinessUserID: cmd.ActorUserID,
	}, nil
}

func normalizeBusinessAffiliate(
	cmd BusinessAffiliateCommand,
	affiliateID common.ID,
) (ports.BusinessAffiliateInput, error) {
	code := strings.ToUpper(strings.TrimSpace(cmd.Code))
	displayName := strings.Join(strings.Fields(cmd.DisplayName), " ")
	email := strings.ToLower(strings.TrimSpace(cmd.Email))
	status := strings.TrimSpace(cmd.Status)
	targetScope := strings.TrimSpace(cmd.TargetScope)
	if cmd.AffiliateProgrammeID.IsZero() ||
		!businessPromotionCodePattern.MatchString(code) ||
		displayName == "" || !validAffiliateEmail(email) ||
		(status != "active" && status != "paused") ||
		!validBusinessAffiliateTargetScope(targetScope) ||
		(targetScope == "store" && cmd.TargetRefID != nil) ||
		(targetScope != "store" && (cmd.TargetRefID == nil || cmd.TargetRefID.IsZero())) ||
		cmd.PurchaseCommissionBPS < 0 || cmd.PurchaseCommissionBPS > 10000 ||
		cmd.FirstPaidPlanCommissionBPS < 0 ||
		cmd.FirstPaidPlanCommissionBPS > 10000 ||
		cmd.CookieWindowDays < 1 || cmd.CookieWindowDays > 365 {
		return ports.BusinessAffiliateInput{}, ErrInvalidInput
	}
	return ports.BusinessAffiliateInput{
		AffiliateID: affiliateID, AffiliateProgrammeID: cmd.AffiliateProgrammeID,
		BusinessID: cmd.Scope.BusinessID, Code: code, DisplayName: displayName,
		ContactName: strings.Join(strings.Fields(cmd.ContactName), " "),
		Email:       email, Phone: strings.TrimSpace(cmd.Phone),
		PurchaseCommissionBPS:      cmd.PurchaseCommissionBPS,
		FirstPaidPlanCommissionBPS: cmd.FirstPaidPlanCommissionBPS,
		CookieWindowDays:           cmd.CookieWindowDays, Status: status,
		TargetScope: targetScope, TargetRefID: cmd.TargetRefID,
		ActorBusinessUserID: cmd.ActorUserID,
	}, nil
}

func validAffiliateEmail(value string) bool {
	if value == "" {
		return true
	}
	address, err := mail.ParseAddress(value)
	return err == nil && strings.EqualFold(address.Address, value)
}

func validBusinessProgrammeStatus(value string) bool {
	return value == "draft" || value == "active" ||
		value == "paused" || value == "archived"
}

func validBusinessPayoutMode(value string) bool {
	return value == "manual" || value == "voucher" ||
		value == "paystack_transfer" || value == "paystack_split"
}

func validBusinessAffiliateTargetScope(value string) bool {
	return value == "store" || value == "collection" ||
		value == "design" || value == "product"
}
