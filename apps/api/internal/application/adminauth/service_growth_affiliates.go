package adminauth

import (
	"context"
	"net/url"
	"strconv"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type ListAffiliatesCommand struct {
	ActorRole admindomain.Role
}

type ListAffiliateAttributionCommand struct {
	ActorRole admindomain.Role
}

type UpdateAffiliateConversionStatusCommand struct {
	ActorUserID  common.ID
	ActorRole    admindomain.Role
	ConversionID common.ID
	Status       string
	Reason       string
	UserAgent    string
	IPAddress    string
}

type CreateAffiliatePayoutCommand struct {
	ActorUserID     common.ID
	ActorRole       admindomain.Role
	AffiliateID     common.ID
	PayoutReference string
	Notes           string
	UserAgent       string
	IPAddress       string
}

type CreateAffiliateCommand struct {
	ActorUserID      common.ID
	ActorRole        admindomain.Role
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	UserAgent        string
	IPAddress        string
}

type UpdateAffiliateCommand struct {
	ActorUserID      common.ID
	ActorRole        admindomain.Role
	AffiliateID      common.ID
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
	UserAgent        string
	IPAddress        string
}

type ArchiveAffiliateCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	AffiliateID common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

func (s Service) ListAffiliates(
	ctx context.Context,
	cmd ListAffiliatesCommand,
) ([]ports.AdminAffiliateRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminAffiliates(ctx)
}

func (s Service) ListAffiliateAttribution(
	ctx context.Context,
	cmd ListAffiliateAttributionCommand,
) ([]ports.AdminAffiliateAttributionRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminAffiliateAttribution(ctx)
}

func (s Service) UpdateAffiliateConversionStatus(
	ctx context.Context,
	cmd UpdateAffiliateConversionStatusCommand,
) (ports.AdminAffiliateConversionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ConversionID.IsZero() {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrForbidden
	}

	status := strings.TrimSpace(cmd.Status)
	if status != "approved" && status != "settled" && status != "reversed" {
		return ports.AdminAffiliateConversionRecord{}, authdomain.ErrInvalidInput
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Operator marked affiliate conversion " + status + "."
	}

	record, err := s.businesses.UpdateAdminAffiliateConversionStatus(ctx, ports.UpdateAdminAffiliateConversionStatusInput{
		ConversionID:   cmd.ConversionID,
		Status:         status,
		Reason:         reason,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	action := "Marked affiliate conversion " + status
	severity := admindomain.AuditSeverityInfo
	if status == "reversed" {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "affiliate_conversion",
		TargetID:    record.ConversionID.String(),
		TargetLabel: fallbackString(record.BusinessName, record.OrderID.String()),
		Summary:     action + ". Reason: " + reason,
		Severity:    severity,
		Metadata: map[string]string{
			"affiliate_id":     record.AffiliateID.String(),
			"business_id":      record.BusinessID.String(),
			"order_id":         record.OrderID.String(),
			"status":           record.Status,
			"commission_minor": intString64(record.CommissionMinor),
			"reason":           reason,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateConversionRecord{}, err
	}

	return record, nil
}

func (s Service) CreateAffiliatePayout(
	ctx context.Context,
	cmd CreateAffiliatePayoutCommand,
) (ports.AdminAffiliatePayoutRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateID.IsZero() {
		return ports.AdminAffiliatePayoutRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliatePayoutRecord{}, authdomain.ErrForbidden
	}

	notes := normalizeOperatorNote(cmd.Notes)
	if notes == "" {
		notes = "Operator reconciled approved affiliate payout."
	}
	reference := normalizeOperatorNote(cmd.PayoutReference)

	record, err := s.businesses.CreateAdminAffiliatePayout(ctx, ports.CreateAdminAffiliatePayoutInput{
		PayoutBatchID:   s.ids.NewID(),
		AffiliateID:     cmd.AffiliateID,
		PayoutReference: reference,
		Notes:           notes,
		ActorAdminUser:  cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Reconciled affiliate payout",
		TargetType:  "affiliate_payout",
		TargetID:    record.PayoutBatchID.String(),
		TargetLabel: fallbackString(record.DisplayName, record.AffiliateID.String()),
		Summary: "Settled " + intString(record.ConversionCount) +
			" approved affiliate conversions for " + moneySummary(record.CommissionMinor) + ".",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"affiliate_id":     record.AffiliateID.String(),
			"conversion_count": intString(record.ConversionCount),
			"commission_minor": intString64(record.CommissionMinor),
			"payout_reference": record.PayoutReference,
			"payout_mode":      record.PayoutMode,
			"status":           record.Status,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliatePayoutRecord{}, err
	}

	return record, nil
}

func (s Service) CreateAffiliate(
	ctx context.Context,
	cmd CreateAffiliateCommand,
) (ports.AdminAffiliateRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateAffiliateInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := s.businesses.CreateAdminAffiliate(ctx, input)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created affiliate programme partner",
		TargetType:  "affiliate",
		TargetID:    record.AffiliateID.String(),
		TargetLabel: record.DisplayName,
		Summary:     affiliateAuditSummary(record),
		Severity:    affiliateAuditSeverity(record.Status),
		Metadata:    affiliateAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateAffiliate(
	ctx context.Context,
	cmd UpdateAffiliateCommand,
) (ports.AdminAffiliateRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateID.IsZero() {
		return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdateAffiliateInput(cmd)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	record, err := s.businesses.UpdateAdminAffiliate(ctx, input)
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated affiliate programme partner",
		TargetType:  "affiliate",
		TargetID:    record.AffiliateID.String(),
		TargetLabel: record.DisplayName,
		Summary:     affiliateAuditSummary(record),
		Severity:    affiliateAuditSeverity(record.Status),
		Metadata:    affiliateAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveAffiliate(
	ctx context.Context,
	cmd ArchiveAffiliateCommand,
) (ports.AdminAffiliateRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.AffiliateID.IsZero() {
		return ports.AdminAffiliateRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminAffiliate(ctx, ports.ArchiveAdminAffiliateInput{
		AffiliateID:    cmd.AffiliateID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAffiliateRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Affiliate programme partner archived."
	}

	metadata := affiliateAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived affiliate programme partner",
		TargetType:  "affiliate",
		TargetID:    record.AffiliateID.String(),
		TargetLabel: record.DisplayName,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateRecord{}, err
	}

	return record, nil
}
func normalizeCreateAffiliateInput(
	cmd CreateAffiliateCommand,
	affiliateID common.ID,
) (ports.CreateAdminAffiliateInput, error) {
	normalized, err := normalizeAffiliateFields(affiliateFields{
		EntityType:       cmd.EntityType,
		Code:             cmd.Code,
		DisplayName:      cmd.DisplayName,
		ContactName:      cmd.ContactName,
		Email:            cmd.Email,
		Phone:            cmd.Phone,
		WebsiteURL:       cmd.WebsiteURL,
		CommissionModel:  cmd.CommissionModel,
		CommissionRate:   cmd.CommissionRate,
		CookieWindowDays: cmd.CookieWindowDays,
		PayoutMode:       cmd.PayoutMode,
		PayoutReference:  cmd.PayoutReference,
		Status:           cmd.Status,
		Notes:            cmd.Notes,
	})
	if err != nil {
		return ports.CreateAdminAffiliateInput{}, err
	}
	return ports.CreateAdminAffiliateInput{
		AffiliateID:      affiliateID,
		EntityType:       normalized.EntityType,
		Code:             normalized.Code,
		DisplayName:      normalized.DisplayName,
		ContactName:      normalized.ContactName,
		Email:            normalized.Email,
		Phone:            normalized.Phone,
		WebsiteURL:       normalized.WebsiteURL,
		CommissionModel:  normalized.CommissionModel,
		CommissionRate:   normalized.CommissionRate,
		CookieWindowDays: normalized.CookieWindowDays,
		PayoutMode:       normalized.PayoutMode,
		PayoutReference:  normalized.PayoutReference,
		Status:           normalized.Status,
		Notes:            normalized.Notes,
		ActorAdminUser:   cmd.ActorUserID,
	}, nil
}

func normalizeUpdateAffiliateInput(cmd UpdateAffiliateCommand) (ports.UpdateAdminAffiliateInput, error) {
	normalized, err := normalizeAffiliateFields(affiliateFields{
		EntityType:       cmd.EntityType,
		Code:             cmd.Code,
		DisplayName:      cmd.DisplayName,
		ContactName:      cmd.ContactName,
		Email:            cmd.Email,
		Phone:            cmd.Phone,
		WebsiteURL:       cmd.WebsiteURL,
		CommissionModel:  cmd.CommissionModel,
		CommissionRate:   cmd.CommissionRate,
		CookieWindowDays: cmd.CookieWindowDays,
		PayoutMode:       cmd.PayoutMode,
		PayoutReference:  cmd.PayoutReference,
		Status:           cmd.Status,
		Notes:            cmd.Notes,
	})
	if err != nil {
		return ports.UpdateAdminAffiliateInput{}, err
	}
	return ports.UpdateAdminAffiliateInput{
		AffiliateID:      cmd.AffiliateID,
		EntityType:       normalized.EntityType,
		Code:             normalized.Code,
		DisplayName:      normalized.DisplayName,
		ContactName:      normalized.ContactName,
		Email:            normalized.Email,
		Phone:            normalized.Phone,
		WebsiteURL:       normalized.WebsiteURL,
		CommissionModel:  normalized.CommissionModel,
		CommissionRate:   normalized.CommissionRate,
		CookieWindowDays: normalized.CookieWindowDays,
		PayoutMode:       normalized.PayoutMode,
		PayoutReference:  normalized.PayoutReference,
		Status:           normalized.Status,
		Notes:            normalized.Notes,
		ActorAdminUser:   cmd.ActorUserID,
	}, nil
}

type affiliateFields struct {
	EntityType       string
	Code             string
	DisplayName      string
	ContactName      string
	Email            string
	Phone            string
	WebsiteURL       string
	CommissionModel  string
	CommissionRate   int64
	CookieWindowDays int
	PayoutMode       string
	PayoutReference  string
	Status           string
	Notes            string
}

func normalizeAffiliateFields(input affiliateFields) (affiliateFields, error) {
	entityType := normalizePromotionOption(input.EntityType, "person")
	if entityType != "person" && entityType != "business" && entityType != "agency" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	code := normalizePromotionCode(input.Code)
	if !validPromotionCode(code) {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	displayName := normalizePromotionTitle(input.DisplayName)
	if displayName == "" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	email := strings.TrimSpace(input.Email)
	if email != "" {
		normalized, err := normalizeEmail(email)
		if err != nil {
			return affiliateFields{}, authdomain.ErrInvalidInput
		}
		email = normalized
	}
	websiteURL, err := normalizeAffiliateURL(input.WebsiteURL)
	if err != nil {
		return affiliateFields{}, err
	}
	commissionModel := normalizePromotionOption(input.CommissionModel, "percentage")
	if commissionModel != "percentage" && commissionModel != "flat" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	if input.CommissionRate <= 0 ||
		(commissionModel == "percentage" && input.CommissionRate > 10000) {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	cookieWindowDays := input.CookieWindowDays
	if cookieWindowDays == 0 {
		cookieWindowDays = 30
	}
	if cookieWindowDays < 1 || cookieWindowDays > 365 {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	payoutMode := normalizePromotionOption(input.PayoutMode, "voucher")
	if payoutMode != "paystack_split" &&
		payoutMode != "paystack_transfer" &&
		payoutMode != "voucher" &&
		payoutMode != "manual" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	status := normalizePromotionOption(input.Status, "pending_review")
	if status != "pending_review" && status != "active" && status != "paused" {
		return affiliateFields{}, authdomain.ErrInvalidInput
	}
	return affiliateFields{
		EntityType:       entityType,
		Code:             code,
		DisplayName:      displayName,
		ContactName:      normalizePromotionTitle(input.ContactName),
		Email:            email,
		Phone:            strings.Join(strings.Fields(strings.TrimSpace(input.Phone)), " "),
		WebsiteURL:       websiteURL,
		CommissionModel:  commissionModel,
		CommissionRate:   input.CommissionRate,
		CookieWindowDays: cookieWindowDays,
		PayoutMode:       payoutMode,
		PayoutReference:  normalizeOperatorNote(input.PayoutReference),
		Status:           status,
		Notes:            normalizeOperatorNote(input.Notes),
	}, nil
}

func normalizeAffiliateURL(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", authdomain.ErrInvalidInput
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", authdomain.ErrInvalidInput
	}
	return parsed.String(), nil
}

func affiliateAuditSummary(record ports.AdminAffiliateRecord) string {
	return record.DisplayName + " uses code " + record.Code +
		" with " + affiliateCommissionLabel(record) + "."
}

func affiliateAuditMetadata(record ports.AdminAffiliateRecord) map[string]string {
	return map[string]string{
		"affiliate_id":       record.AffiliateID.String(),
		"entity_type":        record.EntityType,
		"code":               record.Code,
		"commission_model":   record.CommissionModel,
		"commission_rate":    strconv.FormatInt(record.CommissionRate, 10),
		"cookie_window_days": strconv.Itoa(record.CookieWindowDays),
		"payout_mode":        record.PayoutMode,
		"status":             record.Status,
	}
}

func affiliateAuditSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "active":
		return admindomain.AuditSeverityInfo
	default:
		return admindomain.AuditSeverityWarning
	}
}

func affiliateCommissionLabel(record ports.AdminAffiliateRecord) string {
	if record.CommissionModel == "percentage" {
		return strconv.FormatFloat(float64(record.CommissionRate)/100, 'f', 2, 64) + "% commission"
	}
	return "GHS " + strconv.FormatFloat(float64(record.CommissionRate)/100, 'f', 2, 64) + " flat commission"
}
