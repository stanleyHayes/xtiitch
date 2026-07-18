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

type ListSubscriptionDiscountCodesCommand struct {
	ActorRole admindomain.Role
}

type CreateSubscriptionDiscountCodeCommand struct {
	ActorUserID         common.ID
	ActorRole           admindomain.Role
	Code                string
	DiscountType        string
	DiscountValue       int
	EligiblePlans       []string
	EligibleCadences    []string
	FirstPurchaseOnly   bool
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
	Active              bool
	OwnerName           string
	BatchLabel          string
	Stackable           bool
	UserAgent           string
	IPAddress           string
}

type UpdateSubscriptionDiscountCodeCommand struct {
	ActorUserID         common.ID
	ActorRole           admindomain.Role
	DiscountCodeID      common.ID
	Code                string
	DiscountType        string
	DiscountValue       int
	EligiblePlans       []string
	EligibleCadences    []string
	FirstPurchaseOnly   bool
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
	Active              bool
	OwnerName           string
	BatchLabel          string
	Stackable           bool
	UserAgent           string
	IPAddress           string
}

type ArchiveSubscriptionDiscountCodeCommand struct {
	ActorUserID    common.ID
	ActorRole      admindomain.Role
	DiscountCodeID common.ID
	Reason         string
	UserAgent      string
	IPAddress      string
}

func (s Service) ListSubscriptionDiscountCodes(
	ctx context.Context,
	cmd ListSubscriptionDiscountCodesCommand,
) ([]ports.AdminSubscriptionDiscountCodeRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminSubscriptionDiscountCodes(ctx)
}

func (s Service) CreateSubscriptionDiscountCode(
	ctx context.Context,
	cmd CreateSubscriptionDiscountCodeCommand,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrForbidden
	}
	input, err := normalizeCreateSubscriptionDiscountCodeInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	record, err := s.businesses.CreateAdminSubscriptionDiscountCode(ctx, input)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	if err := s.recordAudit(ctx, subscriptionDiscountAuditInput(
		cmd.ActorUserID,
		cmd.ActorRole,
		"Created subscription discount code",
		record,
		admindomain.AuditSeverityInfo,
		cmd.IPAddress,
		cmd.UserAgent,
	)); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateSubscriptionDiscountCode(
	ctx context.Context,
	cmd UpdateSubscriptionDiscountCodeCommand,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.DiscountCodeID.IsZero() {
		return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrForbidden
	}
	input, err := normalizeUpdateSubscriptionDiscountCodeInput(cmd)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	record, err := s.businesses.UpdateAdminSubscriptionDiscountCode(ctx, input)
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	if err := s.recordAudit(ctx, subscriptionDiscountAuditInput(
		cmd.ActorUserID,
		cmd.ActorRole,
		"Updated subscription discount code",
		record,
		admindomain.AuditSeverityInfo,
		cmd.IPAddress,
		cmd.UserAgent,
	)); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveSubscriptionDiscountCode(
	ctx context.Context,
	cmd ArchiveSubscriptionDiscountCodeCommand,
) (ports.AdminSubscriptionDiscountCodeRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.DiscountCodeID.IsZero() {
		return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageSubscriptions); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminSubscriptionDiscountCode(ctx, ports.ArchiveAdminSubscriptionDiscountCodeInput{
		DiscountCodeID: cmd.DiscountCodeID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}
	metadata := subscriptionDiscountAuditMetadata(record)
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Subscription discount code archived."
	}
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived subscription discount code",
		TargetType:  "subscription_discount_code",
		TargetID:    record.DiscountCodeID.String(),
		TargetLabel: record.Code,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminSubscriptionDiscountCodeRecord{}, err
	}

	return record, nil
}
func normalizeCreateSubscriptionDiscountCodeInput(
	cmd CreateSubscriptionDiscountCodeCommand,
	discountCodeID common.ID,
) (ports.CreateAdminSubscriptionDiscountCodeInput, error) {
	normalized, err := normalizeSubscriptionDiscountCodeFields(subscriptionDiscountCodeFields{
		Code:                cmd.Code,
		DiscountType:        cmd.DiscountType,
		DiscountValue:       cmd.DiscountValue,
		EligiblePlans:       cmd.EligiblePlans,
		EligibleCadences:    cmd.EligibleCadences,
		FirstPurchaseOnly:   cmd.FirstPurchaseOnly,
		MaxRedemptionsTotal: cmd.MaxRedemptionsTotal,
		MaxPerAccount:       cmd.MaxPerAccount,
		ValidFrom:           cmd.ValidFrom,
		ValidUntil:          cmd.ValidUntil,
		Active:              cmd.Active,
		OwnerName:           cmd.OwnerName,
		BatchLabel:          cmd.BatchLabel,
		Stackable:           cmd.Stackable,
	})
	if err != nil {
		return ports.CreateAdminSubscriptionDiscountCodeInput{}, err
	}
	return ports.CreateAdminSubscriptionDiscountCodeInput{
		DiscountCodeID:      discountCodeID,
		Code:                normalized.Code,
		DiscountType:        normalized.DiscountType,
		DiscountValue:       normalized.DiscountValue,
		EligiblePlans:       normalized.EligiblePlans,
		EligibleCadences:    normalized.EligibleCadences,
		FirstPurchaseOnly:   normalized.FirstPurchaseOnly,
		MaxRedemptionsTotal: normalized.MaxRedemptionsTotal,
		MaxPerAccount:       normalized.MaxPerAccount,
		ValidFrom:           normalized.ValidFrom,
		ValidUntil:          normalized.ValidUntil,
		Active:              normalized.Active,
		OwnerName:           normalized.OwnerName,
		BatchLabel:          normalized.BatchLabel,
		Stackable:           normalized.Stackable,
		ActorAdminUser:      cmd.ActorUserID,
	}, nil
}

func normalizeUpdateSubscriptionDiscountCodeInput(
	cmd UpdateSubscriptionDiscountCodeCommand,
) (ports.UpdateAdminSubscriptionDiscountCodeInput, error) {
	normalized, err := normalizeSubscriptionDiscountCodeFields(subscriptionDiscountCodeFields{
		Code:                cmd.Code,
		DiscountType:        cmd.DiscountType,
		DiscountValue:       cmd.DiscountValue,
		EligiblePlans:       cmd.EligiblePlans,
		EligibleCadences:    cmd.EligibleCadences,
		FirstPurchaseOnly:   cmd.FirstPurchaseOnly,
		MaxRedemptionsTotal: cmd.MaxRedemptionsTotal,
		MaxPerAccount:       cmd.MaxPerAccount,
		ValidFrom:           cmd.ValidFrom,
		ValidUntil:          cmd.ValidUntil,
		Active:              cmd.Active,
		OwnerName:           cmd.OwnerName,
		BatchLabel:          cmd.BatchLabel,
		Stackable:           cmd.Stackable,
	})
	if err != nil {
		return ports.UpdateAdminSubscriptionDiscountCodeInput{}, err
	}
	return ports.UpdateAdminSubscriptionDiscountCodeInput{
		DiscountCodeID:      cmd.DiscountCodeID,
		Code:                normalized.Code,
		DiscountType:        normalized.DiscountType,
		DiscountValue:       normalized.DiscountValue,
		EligiblePlans:       normalized.EligiblePlans,
		EligibleCadences:    normalized.EligibleCadences,
		FirstPurchaseOnly:   normalized.FirstPurchaseOnly,
		MaxRedemptionsTotal: normalized.MaxRedemptionsTotal,
		MaxPerAccount:       normalized.MaxPerAccount,
		ValidFrom:           normalized.ValidFrom,
		ValidUntil:          normalized.ValidUntil,
		Active:              normalized.Active,
		OwnerName:           normalized.OwnerName,
		BatchLabel:          normalized.BatchLabel,
		Stackable:           normalized.Stackable,
		ActorAdminUser:      cmd.ActorUserID,
	}, nil
}

type subscriptionDiscountCodeFields struct {
	Code                string
	DiscountType        string
	DiscountValue       int
	EligiblePlans       []string
	EligibleCadences    []string
	FirstPurchaseOnly   bool
	MaxRedemptionsTotal *int
	MaxPerAccount       int
	ValidFrom           *time.Time
	ValidUntil          *time.Time
	Active              bool
	OwnerName           string
	BatchLabel          string
	Stackable           bool
}

func normalizeSubscriptionDiscountCodeFields(
	input subscriptionDiscountCodeFields,
) (subscriptionDiscountCodeFields, error) {
	code := normalizeSubscriptionDiscountCode(input.Code)
	if !validSubscriptionDiscountCode(code) {
		return subscriptionDiscountCodeFields{}, authdomain.ErrInvalidInput
	}
	discountType := normalizePromotionOption(input.DiscountType, "percentage")
	if discountType != "free_period" && discountType != "percentage" && discountType != "fixed" {
		return subscriptionDiscountCodeFields{}, authdomain.ErrInvalidInput
	}
	if !validSubscriptionDiscountValue(discountType, input.DiscountValue) {
		return subscriptionDiscountCodeFields{}, authdomain.ErrInvalidInput
	}
	eligiblePlans, err := normalizeEligiblePlanCodes(input.EligiblePlans)
	if err != nil {
		return subscriptionDiscountCodeFields{}, err
	}
	eligibleCadences, err := normalizeEligibleCadences(input.EligibleCadences)
	if err != nil {
		return subscriptionDiscountCodeFields{}, err
	}
	maxPerAccount := input.MaxPerAccount
	if maxPerAccount == 0 {
		maxPerAccount = 1
	}
	if maxPerAccount < 0 {
		return subscriptionDiscountCodeFields{}, authdomain.ErrInvalidInput
	}
	maxRedemptionsTotal := copyOptionalInt(input.MaxRedemptionsTotal)
	if maxRedemptionsTotal != nil && *maxRedemptionsTotal <= 0 {
		return subscriptionDiscountCodeFields{}, authdomain.ErrInvalidInput
	}
	if input.ValidFrom != nil && input.ValidUntil != nil && !input.ValidUntil.After(*input.ValidFrom) {
		return subscriptionDiscountCodeFields{}, authdomain.ErrInvalidInput
	}
	return subscriptionDiscountCodeFields{
		Code:                code,
		DiscountType:        discountType,
		DiscountValue:       input.DiscountValue,
		EligiblePlans:       eligiblePlans,
		EligibleCadences:    eligibleCadences,
		FirstPurchaseOnly:   input.FirstPurchaseOnly,
		MaxRedemptionsTotal: maxRedemptionsTotal,
		MaxPerAccount:       maxPerAccount,
		ValidFrom:           copyOptionalTime(input.ValidFrom),
		ValidUntil:          copyOptionalTime(input.ValidUntil),
		Active:              input.Active,
		OwnerName:           normalizeShortAdminText(input.OwnerName, 120),
		BatchLabel:          normalizeShortAdminText(input.BatchLabel, 120),
		Stackable:           false,
	}, nil
}

func normalizeSubscriptionDiscountCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func validSubscriptionDiscountCode(value string) bool {
	if len(value) < 3 || len(value) > 32 {
		return false
	}
	for index, char := range value {
		valid := (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') ||
			char == '-' ||
			char == '_'
		if !valid {
			return false
		}
		if index == 0 && (char < 'A' || char > 'Z') && (char < '0' || char > '9') {
			return false
		}
	}
	last := value[len(value)-1]
	return (last >= 'A' && last <= 'Z') || (last >= '0' && last <= '9')
}

// validSubscriptionDiscountValue checks a discount's value against the units its
// TYPE implies: percentage is whole percent (1-100), free_period is months, fixed
// is pesewas. The column is discount_value, not discount_value_bps -- this
// codebase names basis points explicitly where it means them (plans.commission_bps).
//
// The percentage ceiling used to be 10000, a basis-points bound, while the charge
// maths read the value as whole percent. Nothing rejected 2000, and 2000 percent
// off clamps to the full renewal: every percentage code gave the plan away free.
func validSubscriptionDiscountValue(discountType string, value int) bool {
	switch discountType {
	case "percentage":
		return value > 0 && value <= 100
	case "free_period":
		return value > 0 && value <= 36
	case "fixed":
		return value > 0
	default:
		return false
	}
}

func normalizeEligiblePlanCodes(values []string) ([]string, error) {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		code := normalizePlanCode(value)
		if code == "" {
			continue
		}
		if !validPlanCode(code) {
			return nil, authdomain.ErrInvalidInput
		}
		if _, ok := seen[code]; ok {
			continue
		}
		seen[code] = struct{}{}
		out = append(out, code)
	}
	return out, nil
}

func normalizeEligibleCadences(values []string) ([]string, error) {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		cadence := strings.ToLower(strings.TrimSpace(value))
		if cadence == "" {
			continue
		}
		switch cadence {
		// Monthly billing was abolished by migration 000091 (quarterly/yearly
		// only), so it is no longer a cadence a code may be restricted TO. Stored
		// legacy values are unaffected: the redemption path only matches against
		// what is stored, it does not re-validate it.
		case "quarterly", "yearly":
		default:
			return nil, authdomain.ErrInvalidInput
		}
		if _, ok := seen[cadence]; ok {
			continue
		}
		seen[cadence] = struct{}{}
		out = append(out, cadence)
	}
	return out, nil
}

func normalizeShortAdminText(value string, limit int) string {
	text := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(text)
	if len(runes) > limit {
		return string(runes[:limit])
	}
	return text
}

func subscriptionDiscountAuditInput(
	actorUserID common.ID,
	actorRole admindomain.Role,
	action string,
	record ports.AdminSubscriptionDiscountCodeRecord,
	severity admindomain.AuditSeverity,
	ipAddress string,
	userAgent string,
) auditInput {
	return auditInput{
		ActorUserID: actorUserID,
		ActorRole:   actorRole,
		Action:      action,
		TargetType:  "subscription_discount_code",
		TargetID:    record.DiscountCodeID.String(),
		TargetLabel: record.Code,
		Summary:     subscriptionDiscountAuditSummary(record),
		Severity:    severity,
		Metadata:    subscriptionDiscountAuditMetadata(record),
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}
}

func subscriptionDiscountAuditSummary(record ports.AdminSubscriptionDiscountCodeRecord) string {
	return record.Code + " " + record.DiscountType + " subscription code is " +
		boolCSVText(record.Active, "active", "inactive") + " with " +
		strconv.Itoa(record.RedemptionCount) + " redemptions."
}

func subscriptionDiscountAuditMetadata(record ports.AdminSubscriptionDiscountCodeRecord) map[string]string {
	return map[string]string{
		"code":                  record.Code,
		"discount_type":         record.DiscountType,
		"discount_value":        strconv.Itoa(record.DiscountValue),
		"active":                boolString(record.Active),
		"owner_name":            record.OwnerName,
		"batch_label":           record.BatchLabel,
		"redemption_count":      strconv.Itoa(record.RedemptionCount),
		"discount_minor":        strconv.FormatInt(record.DiscountMinor, 10),
		"first_purchase_only":   boolString(record.FirstPurchaseOnly),
		"max_per_account":       strconv.Itoa(record.MaxPerAccount),
		"max_redemptions_total": optionalIntString(record.MaxRedemptionsTotal),
	}
}

func boolCSVText(value bool, trueText string, falseText string) string {
	if value {
		return trueText
	}
	return falseText
}

func optionalIntString(value *int) string {
	if value == nil {
		return ""
	}
	return strconv.Itoa(*value)
}
