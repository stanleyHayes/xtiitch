package adminauth

import (
	"context"
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListPlansCommand struct {
	ActorRole admindomain.Role
}

type CreatePlanCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	Code            string
	Name            string
	MonthlyFeeMinor int64
	YearlyFeeMinor  int64
	CommissionBPS   int
	DesignLimit     *int
	Features        map[string]bool
	UserAgent       string
	IPAddress       string
}

type UpdatePlanCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	PlanID          common.ID
	Name            string
	MonthlyFeeMinor int64
	YearlyFeeMinor  int64
	CommissionBPS   int
	DesignLimit     *int
	Features        map[string]bool
	IsActive        bool
	UserAgent       string
	IPAddress       string
}

type ArchivePlanCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	PlanID      common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type ListPlanEntitlementsCommand struct {
	ActorRole admindomain.Role
}

type UpdatePlanEntitlementsCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Values      []ports.AdminPlanEntitlementValueInput
	UserAgent   string
	IPAddress   string
}

func (s Service) ListPlans(
	ctx context.Context,
	cmd ListPlansCommand,
) ([]ports.AdminPlanRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPlans(ctx)
}

func (s Service) CreatePlan(
	ctx context.Context,
	cmd CreatePlanCommand,
) (ports.AdminPlanRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlanRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreatePlanInput(cmd)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := s.businesses.CreateAdminPlan(ctx, input)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created plan package",
		TargetType:  "plan",
		TargetID:    record.PlanID.String(),
		TargetLabel: record.Name,
		Summary:     planAuditSummary(record),
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"code":              record.Code,
			"monthly_fee_minor": strconv.FormatInt(record.MonthlyFeeMinor, 10),
			"yearly_fee_minor":  strconv.FormatInt(record.YearlyFeeMinor, 10),
			"commission_bps":    strconv.Itoa(record.CommissionBPS),
			"is_active":         boolString(record.IsActive),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (s Service) UpdatePlan(
	ctx context.Context,
	cmd UpdatePlanCommand,
) (ports.AdminPlanRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PlanID.IsZero() {
		return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlanRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdatePlanInput(cmd)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	record, err := s.businesses.UpdateAdminPlan(ctx, input)
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated plan package",
		TargetType:  "plan",
		TargetID:    record.PlanID.String(),
		TargetLabel: record.Name,
		Summary:     planAuditSummary(record),
		Severity:    planAuditSeverity(record.IsActive),
		Metadata: map[string]string{
			"code":              record.Code,
			"monthly_fee_minor": strconv.FormatInt(record.MonthlyFeeMinor, 10),
			"yearly_fee_minor":  strconv.FormatInt(record.YearlyFeeMinor, 10),
			"commission_bps":    strconv.Itoa(record.CommissionBPS),
			"is_active":         boolString(record.IsActive),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (s Service) ArchivePlan(
	ctx context.Context,
	cmd ArchivePlanCommand,
) (ports.AdminPlanRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PlanID.IsZero() {
		return ports.AdminPlanRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return ports.AdminPlanRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPlanRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminPlan(ctx, ports.ArchiveAdminPlanInput{
		PlanID: cmd.PlanID,
	})
	if err != nil {
		return ports.AdminPlanRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Plan package archived."
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived plan package",
		TargetType:  "plan",
		TargetID:    record.PlanID.String(),
		TargetLabel: record.Name,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata: map[string]string{
			"code":      record.Code,
			"is_active": boolString(record.IsActive),
			"reason":    reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminPlanRecord{}, err
	}

	return record, nil
}

func (s Service) ListPlanEntitlements(
	ctx context.Context,
	cmd ListPlanEntitlementsCommand,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPlanEntitlements(ctx)
}

func (s Service) UpdatePlanEntitlements(
	ctx context.Context,
	cmd UpdatePlanEntitlementsCommand,
) ([]ports.AdminPlanEntitlementFeatureRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return nil, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePlans); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}
	values, err := normalizePlanEntitlementValues(cmd.Values)
	if err != nil {
		return nil, err
	}

	records, err := s.businesses.UpdateAdminPlanEntitlements(ctx, ports.UpdateAdminPlanEntitlementsInput{
		ActorAdminUser: cmd.ActorUserID,
		Values:         values,
	})
	if err != nil {
		return nil, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated plan entitlements",
		TargetType:  "plan_entitlements",
		TargetID:    "matrix",
		TargetLabel: "Plan entitlement matrix",
		Summary:     "Updated " + strconv.Itoa(len(values)) + " plan entitlement values.",
		Severity:    admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"value_count": strconv.Itoa(len(values)),
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return nil, err
	}

	return records, nil
}

func normalizeCreatePlanInput(cmd CreatePlanCommand) (ports.CreateAdminPlanInput, error) {
	code := normalizePlanCode(cmd.Code)
	if !validPlanCode(code) {
		return ports.CreateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	name := normalizePlanName(cmd.Name)
	if name == "" {
		return ports.CreateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	if !validPlanEconomics(cmd.MonthlyFeeMinor, cmd.YearlyFeeMinor, cmd.CommissionBPS, cmd.DesignLimit) {
		return ports.CreateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	return ports.CreateAdminPlanInput{
		Code:            code,
		Name:            name,
		MonthlyFeeMinor: cmd.MonthlyFeeMinor,
		YearlyFeeMinor:  cmd.YearlyFeeMinor,
		CommissionBPS:   cmd.CommissionBPS,
		DesignLimit:     copyOptionalInt(cmd.DesignLimit),
		Features:        business.SanitizeFeatures(cmd.Features),
	}, nil
}

func normalizeUpdatePlanInput(cmd UpdatePlanCommand) (ports.UpdateAdminPlanInput, error) {
	name := normalizePlanName(cmd.Name)
	if name == "" {
		return ports.UpdateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	if !validPlanEconomics(cmd.MonthlyFeeMinor, cmd.YearlyFeeMinor, cmd.CommissionBPS, cmd.DesignLimit) {
		return ports.UpdateAdminPlanInput{}, authdomain.ErrInvalidInput
	}
	return ports.UpdateAdminPlanInput{
		PlanID:          cmd.PlanID,
		Name:            name,
		MonthlyFeeMinor: cmd.MonthlyFeeMinor,
		YearlyFeeMinor:  cmd.YearlyFeeMinor,
		CommissionBPS:   cmd.CommissionBPS,
		DesignLimit:     copyOptionalInt(cmd.DesignLimit),
		Features:        business.SanitizeFeatures(cmd.Features),
		IsActive:        cmd.IsActive,
	}, nil
}

func normalizePlanEntitlementValues(
	values []ports.AdminPlanEntitlementValueInput,
) ([]ports.AdminPlanEntitlementValueInput, error) {
	if len(values) == 0 {
		return nil, authdomain.ErrInvalidInput
	}
	seen := map[string]struct{}{}
	out := make([]ports.AdminPlanEntitlementValueInput, 0, len(values))
	for _, value := range values {
		key := normalizePlanEntitlementKey(value.FeatureKey)
		if value.PlanID.IsZero() || !validPlanEntitlementKey(key) {
			return nil, authdomain.ErrInvalidInput
		}
		limitValue := copyOptionalInt(value.LimitValue)
		if limitValue != nil && *limitValue < 0 {
			return nil, authdomain.ErrInvalidInput
		}
		seenKey := value.PlanID.String() + ":" + key
		if _, ok := seen[seenKey]; ok {
			continue
		}
		seen[seenKey] = struct{}{}
		out = append(out, ports.AdminPlanEntitlementValueInput{
			PlanID:     value.PlanID,
			FeatureKey: key,
			Enabled:    value.Enabled,
			LimitValue: limitValue,
		})
	}
	if len(out) == 0 {
		return nil, authdomain.ErrInvalidInput
	}
	return out, nil
}

func normalizePlanEntitlementKey(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func validPlanEntitlementKey(value string) bool {
	if len(value) < 2 || len(value) > 80 {
		return false
	}
	for index, char := range value {
		valid := (char >= 'a' && char <= 'z') ||
			(char >= '0' && char <= '9') ||
			char == '_'
		if !valid {
			return false
		}
		if index == 0 && (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return false
		}
	}
	last := value[len(value)-1]
	return (last >= 'a' && last <= 'z') || (last >= '0' && last <= '9')
}

func normalizePlanCode(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizePlanName(value string) string {
	name := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(name)
	if len(runes) > 80 {
		return string(runes[:80])
	}
	return name
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func validPlanCode(value string) bool {
	if len(value) < 2 || len(value) > 32 {
		return false
	}
	for index, char := range value {
		valid := (char >= 'a' && char <= 'z') ||
			(char >= '0' && char <= '9') ||
			char == '-' ||
			char == '_'
		if !valid {
			return false
		}
		if index == 0 && (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return false
		}
	}
	last := value[len(value)-1]
	return (last >= 'a' && last <= 'z') || (last >= '0' && last <= '9')
}

func validPlanEconomics(monthlyFeeMinor int64, yearlyFeeMinor int64, commissionBPS int, designLimit *int) bool {
	if monthlyFeeMinor < 0 || yearlyFeeMinor < 0 || commissionBPS < 0 || commissionBPS > 10000 {
		return false
	}
	if designLimit != nil && *designLimit < 0 {
		return false
	}
	return true
}

func planAuditSummary(record ports.AdminPlanRecord) string {
	fee := "free"
	if record.MonthlyFeeMinor > 0 {
		fee = "GHS " + strconv.FormatFloat(float64(record.MonthlyFeeMinor)/100, 'f', 2, 64) + "/month"
	}
	if record.YearlyFeeMinor > 0 {
		fee += " or GHS " + strconv.FormatFloat(float64(record.YearlyFeeMinor)/100, 'f', 2, 64) + "/year"
	}
	return record.Code + " package set to " + fee +
		" and " + strconv.FormatFloat(float64(record.CommissionBPS)/100, 'f', 2, 64) +
		"% commission."
}

func planAuditSeverity(active bool) admindomain.AuditSeverity {
	if active {
		return admindomain.AuditSeverityInfo
	}
	return admindomain.AuditSeverityWarning
}
