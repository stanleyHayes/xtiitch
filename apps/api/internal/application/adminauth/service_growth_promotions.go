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

type ListPromotionsCommand struct {
	ActorRole admindomain.Role
}

type CreatePromotionCommand struct {
	ActorUserID           common.ID
	ActorRole             admindomain.Role
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	UserAgent             string
	IPAddress             string
}

type UpdatePromotionCommand struct {
	ActorUserID           common.ID
	ActorRole             admindomain.Role
	PromotionID           common.ID
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
	UserAgent             string
	IPAddress             string
}

type ArchivePromotionCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	PromotionID common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

func (s Service) ListPromotions(
	ctx context.Context,
	cmd ListPromotionsCommand,
) ([]ports.AdminPromotionRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminPromotions(ctx)
}

func (s Service) CreatePromotion(
	ctx context.Context,
	cmd CreatePromotionCommand,
) (ports.AdminPromotionRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPromotionRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreatePromotionInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := s.businesses.CreateAdminPromotion(ctx, input)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created promotion",
		TargetType:  "promotion",
		TargetID:    record.PromotionID.String(),
		TargetLabel: record.Title,
		Summary:     promotionAuditSummary(record),
		Severity:    promotionAuditSeverity(record.Status),
		Metadata:    promotionAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (s Service) UpdatePromotion(
	ctx context.Context,
	cmd UpdatePromotionCommand,
) (ports.AdminPromotionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPromotionRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdatePromotionInput(cmd)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	record, err := s.businesses.UpdateAdminPromotion(ctx, input)
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated promotion",
		TargetType:  "promotion",
		TargetID:    record.PromotionID.String(),
		TargetLabel: record.Title,
		Summary:     promotionAuditSummary(record),
		Severity:    promotionAuditSeverity(record.Status),
		Metadata:    promotionAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}

func (s Service) ArchivePromotion(
	ctx context.Context,
	cmd ArchivePromotionCommand,
) (ports.AdminPromotionRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.AdminPromotionRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManagePromotions); err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminPromotionRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminPromotion(ctx, ports.ArchiveAdminPromotionInput{
		PromotionID:    cmd.PromotionID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminPromotionRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Promotion archived."
	}

	metadata := promotionAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived promotion",
		TargetType:  "promotion",
		TargetID:    record.PromotionID.String(),
		TargetLabel: record.Title,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminPromotionRecord{}, err
	}

	return record, nil
}
func normalizeCreatePromotionInput(cmd CreatePromotionCommand, promotionID common.ID) (ports.CreateAdminPromotionInput, error) {
	normalized, err := normalizePromotionFields(promotionFields{
		BusinessID:            cmd.BusinessID,
		Code:                  cmd.Code,
		Title:                 cmd.Title,
		Description:           cmd.Description,
		DiscountType:          cmd.DiscountType,
		DiscountValue:         cmd.DiscountValue,
		MaxDiscountMinor:      cmd.MaxDiscountMinor,
		MinSpendMinor:         cmd.MinSpendMinor,
		UsageLimitGlobal:      cmd.UsageLimitGlobal,
		UsageLimitPerCustomer: cmd.UsageLimitPerCustomer,
		FundingSource:         cmd.FundingSource,
		Scope:                 cmd.Scope,
		TargetCollectionID:    cmd.TargetCollectionID,
		TargetDesignID:        cmd.TargetDesignID,
		Status:                cmd.Status,
		StartsAt:              cmd.StartsAt,
		EndsAt:                cmd.EndsAt,
	})
	if err != nil {
		return ports.CreateAdminPromotionInput{}, err
	}
	return ports.CreateAdminPromotionInput{
		PromotionID:           promotionID,
		BusinessID:            normalized.BusinessID,
		Code:                  normalized.Code,
		Title:                 normalized.Title,
		Description:           normalized.Description,
		DiscountType:          normalized.DiscountType,
		DiscountValue:         normalized.DiscountValue,
		MaxDiscountMinor:      normalized.MaxDiscountMinor,
		MinSpendMinor:         normalized.MinSpendMinor,
		UsageLimitGlobal:      normalized.UsageLimitGlobal,
		UsageLimitPerCustomer: normalized.UsageLimitPerCustomer,
		FundingSource:         normalized.FundingSource,
		Scope:                 normalized.Scope,
		TargetCollectionID:    normalized.TargetCollectionID,
		TargetDesignID:        normalized.TargetDesignID,
		Status:                normalized.Status,
		StartsAt:              normalized.StartsAt,
		EndsAt:                normalized.EndsAt,
		ActorAdminUser:        cmd.ActorUserID,
	}, nil
}

func normalizeUpdatePromotionInput(cmd UpdatePromotionCommand) (ports.UpdateAdminPromotionInput, error) {
	normalized, err := normalizePromotionFields(promotionFields{
		BusinessID:            cmd.BusinessID,
		Code:                  cmd.Code,
		Title:                 cmd.Title,
		Description:           cmd.Description,
		DiscountType:          cmd.DiscountType,
		DiscountValue:         cmd.DiscountValue,
		MaxDiscountMinor:      cmd.MaxDiscountMinor,
		MinSpendMinor:         cmd.MinSpendMinor,
		UsageLimitGlobal:      cmd.UsageLimitGlobal,
		UsageLimitPerCustomer: cmd.UsageLimitPerCustomer,
		FundingSource:         cmd.FundingSource,
		Scope:                 cmd.Scope,
		TargetCollectionID:    cmd.TargetCollectionID,
		TargetDesignID:        cmd.TargetDesignID,
		Status:                cmd.Status,
		StartsAt:              cmd.StartsAt,
		EndsAt:                cmd.EndsAt,
	})
	if err != nil {
		return ports.UpdateAdminPromotionInput{}, err
	}
	return ports.UpdateAdminPromotionInput{
		PromotionID:           cmd.PromotionID,
		BusinessID:            normalized.BusinessID,
		Code:                  normalized.Code,
		Title:                 normalized.Title,
		Description:           normalized.Description,
		DiscountType:          normalized.DiscountType,
		DiscountValue:         normalized.DiscountValue,
		MaxDiscountMinor:      normalized.MaxDiscountMinor,
		MinSpendMinor:         normalized.MinSpendMinor,
		UsageLimitGlobal:      normalized.UsageLimitGlobal,
		UsageLimitPerCustomer: normalized.UsageLimitPerCustomer,
		FundingSource:         normalized.FundingSource,
		Scope:                 normalized.Scope,
		TargetCollectionID:    normalized.TargetCollectionID,
		TargetDesignID:        normalized.TargetDesignID,
		Status:                normalized.Status,
		StartsAt:              normalized.StartsAt,
		EndsAt:                normalized.EndsAt,
		ActorAdminUser:        cmd.ActorUserID,
	}, nil
}

type promotionFields struct {
	BusinessID            *common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	FundingSource         string
	Scope                 string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func normalizePromotionFields(input promotionFields) (promotionFields, error) {
	businessID := copyOptionalID(input.BusinessID)
	if businessID != nil && businessID.IsZero() {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	code := normalizePromotionCode(input.Code)
	if code != "" && !validPromotionCode(code) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	title := normalizePromotionTitle(input.Title)
	if title == "" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	description := normalizeOperatorNote(input.Description)
	discountType := normalizePromotionOption(input.DiscountType, "percentage")
	if discountType != "percentage" && discountType != "fixed" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	if !validPromotionDiscount(discountType, input.DiscountValue, input.MaxDiscountMinor) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	if input.MinSpendMinor < 0 ||
		(input.UsageLimitGlobal != nil && *input.UsageLimitGlobal <= 0) ||
		(input.UsageLimitPerCustomer != nil && *input.UsageLimitPerCustomer <= 0) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	fundingSource := normalizePromotionOption(input.FundingSource, "business")
	if fundingSource != "business" && fundingSource != "platform" && fundingSource != "split" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	scope := normalizePromotionOption(input.Scope, "store")
	if scope != "store" && scope != "collection" && scope != "design" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	targetCollectionID := copyOptionalID(input.TargetCollectionID)
	targetDesignID := copyOptionalID(input.TargetDesignID)
	if (targetCollectionID != nil && targetCollectionID.IsZero()) ||
		(targetDesignID != nil && targetDesignID.IsZero()) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	switch scope {
	case "store":
		if targetCollectionID != nil || targetDesignID != nil {
			return promotionFields{}, authdomain.ErrInvalidInput
		}
	case "collection":
		if targetCollectionID == nil || targetDesignID != nil {
			return promotionFields{}, authdomain.ErrInvalidInput
		}
	case "design":
		if targetDesignID == nil || targetCollectionID != nil {
			return promotionFields{}, authdomain.ErrInvalidInput
		}
	}
	status := normalizePromotionOption(input.Status, "active")
	if status != "active" && status != "paused" {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	if input.StartsAt != nil && input.EndsAt != nil && !input.EndsAt.After(*input.StartsAt) {
		return promotionFields{}, authdomain.ErrInvalidInput
	}
	return promotionFields{
		BusinessID:            businessID,
		Code:                  code,
		Title:                 title,
		Description:           description,
		DiscountType:          discountType,
		DiscountValue:         input.DiscountValue,
		MaxDiscountMinor:      copyOptionalInt64(input.MaxDiscountMinor),
		MinSpendMinor:         input.MinSpendMinor,
		UsageLimitGlobal:      copyOptionalInt(input.UsageLimitGlobal),
		UsageLimitPerCustomer: copyOptionalInt(input.UsageLimitPerCustomer),
		FundingSource:         fundingSource,
		Scope:                 scope,
		TargetCollectionID:    targetCollectionID,
		TargetDesignID:        targetDesignID,
		Status:                status,
		StartsAt:              copyOptionalTime(input.StartsAt),
		EndsAt:                copyOptionalTime(input.EndsAt),
	}, nil
}

func normalizePromotionCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizePromotionTitle(value string) string {
	title := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(title)
	if len(runes) > 96 {
		return string(runes[:96])
	}
	return title
}

func normalizePromotionOption(value string, fallback string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return fallback
	}
	return normalized
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func validPromotionCode(value string) bool {
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

func validPromotionDiscount(discountType string, value int64, maxDiscountMinor *int64) bool {
	if discountType == "percentage" {
		return value > 0 && value <= 10000 && maxDiscountMinor != nil && *maxDiscountMinor > 0
	}
	return value > 0 && (maxDiscountMinor == nil || *maxDiscountMinor >= 0)
}

func copyOptionalID(value *common.ID) *common.ID {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func copyOptionalInt64(value *int64) *int64 {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func copyOptionalTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	out := *value
	return &out
}

func promotionAuditSummary(record ports.AdminPromotionRecord) string {
	discount := formatPromotionDiscount(record)
	scope := "platform-wide"
	if record.BusinessName != "" {
		scope = record.BusinessName
	}
	return record.Title + " gives " + discount + " for " + scope + "."
}

func promotionAuditMetadata(record ports.AdminPromotionRecord) map[string]string {
	metadata := map[string]string{
		"code":             record.Code,
		"discount_type":    record.DiscountType,
		"discount_value":   strconv.FormatInt(record.DiscountValue, 10),
		"funding_source":   record.FundingSource,
		"scope":            record.Scope,
		"status":           record.Status,
		"min_spend_minor":  strconv.FormatInt(record.MinSpendMinor, 10),
		"redemption_count": strconv.Itoa(record.RedemptionCount),
	}
	if record.BusinessID != nil {
		metadata["business_id"] = record.BusinessID.String()
	}
	if record.MaxDiscountMinor != nil {
		metadata["max_discount_minor"] = strconv.FormatInt(*record.MaxDiscountMinor, 10)
	}
	return metadata
}

func promotionAuditSeverity(status string) admindomain.AuditSeverity {
	if status == "active" {
		return admindomain.AuditSeverityInfo
	}
	return admindomain.AuditSeverityWarning
}

func formatPromotionDiscount(record ports.AdminPromotionRecord) string {
	if record.DiscountType == "percentage" {
		return strconv.FormatFloat(float64(record.DiscountValue)/100, 'f', 2, 64) + "%"
	}
	return "GHS " + strconv.FormatFloat(float64(record.DiscountValue)/100, 'f', 2, 64)
}
