package adminauth

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListReferralProgrammesCommand struct {
	ActorRole admindomain.Role
}

type CreateReferralProgrammeCommand struct {
	ActorUserID             common.ID
	ActorRole               admindomain.Role
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	UserAgent               string
	IPAddress               string
}

type UpdateReferralProgrammeCommand struct {
	ActorUserID             common.ID
	ActorRole               admindomain.Role
	ProgrammeID             common.ID
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
	UserAgent               string
	IPAddress               string
}

type ArchiveReferralProgrammeCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	ProgrammeID common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type CreateReferralCodeCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	ProgrammeID common.ID
	BusinessID  *common.ID
	OwnerType   string
	Code        string
	Status      string
	UserAgent   string
	IPAddress   string
}

type IssueReferralRewardsCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Limit       int
	UserAgent   string
	IPAddress   string
}

func (s Service) ListReferralProgrammes(
	ctx context.Context,
	cmd ListReferralProgrammesCommand,
) ([]ports.AdminReferralProgrammeRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminReferralProgrammes(ctx)
}

func (s Service) CreateReferralProgramme(
	ctx context.Context,
	cmd CreateReferralProgrammeCommand,
) (ports.AdminReferralProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateReferralProgrammeInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := s.businesses.CreateAdminReferralProgramme(ctx, input)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created referral programme",
		TargetType:  "referral_programme",
		TargetID:    record.ProgrammeID.String(),
		TargetLabel: record.Title,
		Summary:     referralProgrammeAuditSummary(record),
		Severity:    referralProgrammeAuditSeverity(record.Status),
		Metadata:    referralProgrammeAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateReferralProgramme(
	ctx context.Context,
	cmd UpdateReferralProgrammeCommand,
) (ports.AdminReferralProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ProgrammeID.IsZero() {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdateReferralProgrammeInput(cmd)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	record, err := s.businesses.UpdateAdminReferralProgramme(ctx, input)
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated referral programme",
		TargetType:  "referral_programme",
		TargetID:    record.ProgrammeID.String(),
		TargetLabel: record.Title,
		Summary:     referralProgrammeAuditSummary(record),
		Severity:    referralProgrammeAuditSeverity(record.Status),
		Metadata:    referralProgrammeAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveReferralProgramme(
	ctx context.Context,
	cmd ArchiveReferralProgrammeCommand,
) (ports.AdminReferralProgrammeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ProgrammeID.IsZero() {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralProgrammeRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminReferralProgramme(ctx, ports.ArchiveAdminReferralProgrammeInput{
		ProgrammeID:    cmd.ProgrammeID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Referral programme archived."
	}

	metadata := referralProgrammeAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived referral programme",
		TargetType:  "referral_programme",
		TargetID:    record.ProgrammeID.String(),
		TargetLabel: record.Title,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralProgrammeRecord{}, err
	}

	return record, nil
}

func (s Service) CreateReferralCode(
	ctx context.Context,
	cmd CreateReferralCodeCommand,
) (ports.AdminReferralCodeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ProgrammeID.IsZero() {
		return ports.AdminReferralCodeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralCodeRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateReferralCodeInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	record, err := s.businesses.CreateAdminReferralCode(ctx, input)
	if err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Issued referral code",
		TargetType:  "referral_code",
		TargetID:    record.ReferralCodeID.String(),
		TargetLabel: record.Code,
		Summary: "Issued " + record.OwnerType + " referral code " +
			record.Code + " for " + fallbackString(record.OwnerLabel, "platform growth") + ".",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"referral_programme_id": record.ProgrammeID.String(),
			"business_id":           optionalIDMetadata(record.BusinessID),
			"owner_type":            record.OwnerType,
			"owner_business_id":     optionalIDMetadata(record.OwnerBusinessID),
			"owner_customer_id":     optionalIDMetadata(record.OwnerCustomerID),
			"code":                  record.Code,
			"status":                record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralCodeRecord{}, err
	}

	return record, nil
}

func (s Service) IssueReferralRewards(
	ctx context.Context,
	cmd IssueReferralRewardsCommand,
) (ports.AdminReferralRewardIssueRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminReferralRewardIssueRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminReferralRewardIssueRecord{}, authdomain.ErrForbidden
	}

	limit := cmd.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 500 {
		limit = 500
	}

	record, err := s.businesses.IssueAdminReferralRewards(ctx, ports.IssueAdminReferralRewardsInput{
		ActorAdminUser: cmd.ActorUserID,
		Limit:          limit,
	})
	if err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Issued referral rewards",
		TargetType:  "referral_rewards",
		TargetID:    "batch",
		TargetLabel: "Referral rewards",
		Summary: "Issued " + intString(record.RewardCount) +
			" referral rewards across " + intString(record.ReferralCount) + " referrals.",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"referral_count":          intString(record.ReferralCount),
			"reward_count":            intString(record.RewardCount),
			"voucher_count":           intString(record.VoucherCount),
			"commission_rebate_count": intString(record.CommissionRebateCount),
			"total_reward_minor":      intString64(record.TotalRewardMinor),
			"limit":                   intString(limit),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminReferralRewardIssueRecord{}, err
	}

	return record, nil
}
func normalizeCreateReferralProgrammeInput(
	cmd CreateReferralProgrammeCommand,
	programmeID common.ID,
) (ports.CreateAdminReferralProgrammeInput, error) {
	normalized, err := normalizeReferralProgrammeFields(referralProgrammeFields{
		Title:                   cmd.Title,
		CodePrefix:              cmd.CodePrefix,
		Audience:                cmd.Audience,
		ReferrerRewardKind:      cmd.ReferrerRewardKind,
		RefereeRewardKind:       cmd.RefereeRewardKind,
		RewardType:              cmd.RewardType,
		RewardValue:             cmd.RewardValue,
		MaxRewardMinor:          cmd.MaxRewardMinor,
		QualifyingOrderMinMinor: cmd.QualifyingOrderMinMinor,
		RewardHoldDays:          cmd.RewardHoldDays,
		Status:                  cmd.Status,
		StartsAt:                cmd.StartsAt,
		EndsAt:                  cmd.EndsAt,
		Notes:                   cmd.Notes,
	})
	if err != nil {
		return ports.CreateAdminReferralProgrammeInput{}, err
	}
	return ports.CreateAdminReferralProgrammeInput{
		ProgrammeID:             programmeID,
		Title:                   normalized.Title,
		CodePrefix:              normalized.CodePrefix,
		Audience:                normalized.Audience,
		ReferrerRewardKind:      normalized.ReferrerRewardKind,
		RefereeRewardKind:       normalized.RefereeRewardKind,
		RewardType:              normalized.RewardType,
		RewardValue:             normalized.RewardValue,
		MaxRewardMinor:          normalized.MaxRewardMinor,
		QualifyingOrderMinMinor: normalized.QualifyingOrderMinMinor,
		RewardHoldDays:          normalized.RewardHoldDays,
		Status:                  normalized.Status,
		StartsAt:                normalized.StartsAt,
		EndsAt:                  normalized.EndsAt,
		Notes:                   normalized.Notes,
		ActorAdminUser:          cmd.ActorUserID,
	}, nil
}

func normalizeUpdateReferralProgrammeInput(cmd UpdateReferralProgrammeCommand) (ports.UpdateAdminReferralProgrammeInput, error) {
	normalized, err := normalizeReferralProgrammeFields(referralProgrammeFields{
		Title:                   cmd.Title,
		CodePrefix:              cmd.CodePrefix,
		Audience:                cmd.Audience,
		ReferrerRewardKind:      cmd.ReferrerRewardKind,
		RefereeRewardKind:       cmd.RefereeRewardKind,
		RewardType:              cmd.RewardType,
		RewardValue:             cmd.RewardValue,
		MaxRewardMinor:          cmd.MaxRewardMinor,
		QualifyingOrderMinMinor: cmd.QualifyingOrderMinMinor,
		RewardHoldDays:          cmd.RewardHoldDays,
		Status:                  cmd.Status,
		StartsAt:                cmd.StartsAt,
		EndsAt:                  cmd.EndsAt,
		Notes:                   cmd.Notes,
	})
	if err != nil {
		return ports.UpdateAdminReferralProgrammeInput{}, err
	}
	return ports.UpdateAdminReferralProgrammeInput{
		ProgrammeID:             cmd.ProgrammeID,
		Title:                   normalized.Title,
		CodePrefix:              normalized.CodePrefix,
		Audience:                normalized.Audience,
		ReferrerRewardKind:      normalized.ReferrerRewardKind,
		RefereeRewardKind:       normalized.RefereeRewardKind,
		RewardType:              normalized.RewardType,
		RewardValue:             normalized.RewardValue,
		MaxRewardMinor:          normalized.MaxRewardMinor,
		QualifyingOrderMinMinor: normalized.QualifyingOrderMinMinor,
		RewardHoldDays:          normalized.RewardHoldDays,
		Status:                  normalized.Status,
		StartsAt:                normalized.StartsAt,
		EndsAt:                  normalized.EndsAt,
		Notes:                   normalized.Notes,
		ActorAdminUser:          cmd.ActorUserID,
	}, nil
}

type referralProgrammeFields struct {
	Title                   string
	CodePrefix              string
	Audience                string
	ReferrerRewardKind      string
	RefereeRewardKind       string
	RewardType              string
	RewardValue             int64
	MaxRewardMinor          *int64
	QualifyingOrderMinMinor int64
	RewardHoldDays          int
	Status                  string
	StartsAt                *time.Time
	EndsAt                  *time.Time
	Notes                   string
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func normalizeReferralProgrammeFields(input referralProgrammeFields) (referralProgrammeFields, error) {
	title := normalizePromotionTitle(input.Title)
	if title == "" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	codePrefix := normalizePromotionCode(input.CodePrefix)
	if !validReferralCodePrefix(codePrefix) {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	audience := normalizePromotionOption(input.Audience, "customers")
	if audience != "customers" && audience != "businesses" && audience != "mixed" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	referrerRewardKind := normalizePromotionOption(input.ReferrerRewardKind, "voucher")
	if referrerRewardKind != "voucher" &&
		referrerRewardKind != "commission_rebate" &&
		referrerRewardKind != "none" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	refereeRewardKind := normalizePromotionOption(input.RefereeRewardKind, "voucher")
	if refereeRewardKind != "voucher" && refereeRewardKind != "none" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if referrerRewardKind == "none" && refereeRewardKind == "none" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	rewardType := normalizePromotionOption(input.RewardType, "fixed")
	if rewardType != "percentage" && rewardType != "fixed" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if rewardType == "percentage" {
		if input.RewardValue <= 0 || input.RewardValue > 10000 || input.MaxRewardMinor == nil || *input.MaxRewardMinor <= 0 {
			return referralProgrammeFields{}, authdomain.ErrInvalidInput
		}
	} else if input.RewardValue <= 0 || (input.MaxRewardMinor != nil && *input.MaxRewardMinor <= 0) {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	rewardHoldDays := input.RewardHoldDays
	if rewardHoldDays == 0 {
		rewardHoldDays = 14
	}
	status := normalizePromotionOption(input.Status, "draft")
	if status != "draft" && status != "active" && status != "paused" {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if input.QualifyingOrderMinMinor < 0 || rewardHoldDays < 0 || rewardHoldDays > 180 {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	if input.StartsAt != nil && input.EndsAt != nil && !input.EndsAt.After(*input.StartsAt) {
		return referralProgrammeFields{}, authdomain.ErrInvalidInput
	}
	return referralProgrammeFields{
		Title:                   title,
		CodePrefix:              codePrefix,
		Audience:                audience,
		ReferrerRewardKind:      referrerRewardKind,
		RefereeRewardKind:       refereeRewardKind,
		RewardType:              rewardType,
		RewardValue:             input.RewardValue,
		MaxRewardMinor:          copyOptionalInt64(input.MaxRewardMinor),
		QualifyingOrderMinMinor: input.QualifyingOrderMinMinor,
		RewardHoldDays:          rewardHoldDays,
		Status:                  status,
		StartsAt:                copyOptionalTime(input.StartsAt),
		EndsAt:                  copyOptionalTime(input.EndsAt),
		Notes:                   normalizeOperatorNote(input.Notes),
	}, nil
}

func validReferralCodePrefix(value string) bool {
	return validPromotionCode(value) && len(value) <= 24
}

func normalizeCreateReferralCodeInput(
	cmd CreateReferralCodeCommand,
	referralCodeID common.ID,
) (ports.CreateAdminReferralCodeInput, error) {
	ownerType := strings.TrimSpace(cmd.OwnerType)
	if ownerType == "" {
		ownerType = "platform"
	}
	if ownerType != "platform" && ownerType != "business" {
		return ports.CreateAdminReferralCodeInput{}, authdomain.ErrInvalidInput
	}

	var businessID *common.ID
	if ownerType == "business" {
		if cmd.BusinessID == nil || cmd.BusinessID.IsZero() {
			return ports.CreateAdminReferralCodeInput{}, authdomain.ErrInvalidInput
		}
		id := *cmd.BusinessID
		businessID = &id
	}

	code := normalizePromotionCode(cmd.Code)
	if !validReferralCode(code) {
		return ports.CreateAdminReferralCodeInput{}, authdomain.ErrInvalidInput
	}
	status := normalizePromotionOption(cmd.Status, "active")
	if status != "active" && status != "paused" {
		return ports.CreateAdminReferralCodeInput{}, authdomain.ErrInvalidInput
	}

	return ports.CreateAdminReferralCodeInput{
		ReferralCodeID: referralCodeID,
		ProgrammeID:    cmd.ProgrammeID,
		BusinessID:     businessID,
		OwnerType:      ownerType,
		Code:           code,
		Status:         status,
		ActorAdminUser: cmd.ActorUserID,
	}, nil
}

func validReferralCode(value string) bool {
	return len(value) >= 3 && len(value) <= 32 && validPromotionCode(value)
}

func referralProgrammeAuditSummary(record ports.AdminReferralProgrammeRecord) string {
	return record.Title + " uses prefix " + record.CodePrefix +
		" for " + record.Audience + "."
}

func referralProgrammeAuditMetadata(record ports.AdminReferralProgrammeRecord) map[string]string {
	metadata := map[string]string{
		"programme_id":               record.ProgrammeID.String(),
		"code_prefix":                record.CodePrefix,
		"audience":                   record.Audience,
		"referrer_reward_kind":       record.ReferrerRewardKind,
		"referee_reward_kind":        record.RefereeRewardKind,
		"reward_type":                record.RewardType,
		"reward_value":               strconv.FormatInt(record.RewardValue, 10),
		"qualifying_order_min_minor": strconv.FormatInt(record.QualifyingOrderMinMinor, 10),
		"reward_hold_days":           strconv.Itoa(record.RewardHoldDays),
		"status":                     record.Status,
	}
	if record.MaxRewardMinor != nil {
		metadata["max_reward_minor"] = strconv.FormatInt(*record.MaxRewardMinor, 10)
	}
	return metadata
}

func referralProgrammeAuditSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "active":
		return admindomain.AuditSeverityInfo
	default:
		return admindomain.AuditSeverityWarning
	}
}
