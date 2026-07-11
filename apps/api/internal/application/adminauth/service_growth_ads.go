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

type ListAdCampaignsCommand struct {
	ActorRole admindomain.Role
}

type CreateAdCampaignCommand struct {
	ActorUserID   common.ID
	ActorRole     admindomain.Role
	BusinessID    common.ID
	PlacementType string
	TargetRefID   string
	Headline      string
	Description   string
	Status        string
	PricingModel  string
	BudgetMinor   int64
	DailyCapMinor *int64
	StartsAt      *time.Time
	EndsAt        *time.Time
	ReviewNote    string
	UserAgent     string
	IPAddress     string
}

type UpdateAdCampaignCommand struct {
	ActorUserID   common.ID
	ActorRole     admindomain.Role
	CampaignID    common.ID
	BusinessID    common.ID
	PlacementType string
	TargetRefID   string
	Headline      string
	Description   string
	Status        string
	PricingModel  string
	BudgetMinor   int64
	DailyCapMinor *int64
	StartsAt      *time.Time
	EndsAt        *time.Time
	ReviewNote    string
	UserAgent     string
	IPAddress     string
}

type ArchiveAdCampaignCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	CampaignID  common.ID
	Reason      string
	UserAgent   string
	IPAddress   string
}

type CollectAdCampaignPaymentCommand struct {
	ActorUserID   common.ID
	ActorRole     admindomain.Role
	CampaignID    common.ID
	CustomerEmail string
	UserAgent     string
	IPAddress     string
}

type AdCampaignPaymentResult struct {
	Payment          ports.AdminAdCampaignPaymentRecord
	Created          bool
	AuthorizationURL string
}

func (s Service) ListAdCampaigns(
	ctx context.Context,
	cmd ListAdCampaignsCommand,
) ([]ports.AdminAdCampaignRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}

	return s.businesses.ListAdminAdCampaigns(ctx)
}

func (s Service) CreateAdCampaign(
	ctx context.Context,
	cmd CreateAdCampaignCommand,
) (ports.AdminAdCampaignRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeCreateAdCampaignInput(cmd, s.ids.NewID())
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := s.businesses.CreateAdminAdCampaign(ctx, input)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created sponsored placement",
		TargetType:  "ad_campaign",
		TargetID:    record.CampaignID.String(),
		TargetLabel: record.Headline,
		Summary:     adCampaignAuditSummary(record),
		Severity:    adCampaignAuditSeverity(record.Status),
		Metadata:    adCampaignAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (s Service) UpdateAdCampaign(
	ctx context.Context,
	cmd UpdateAdCampaignCommand,
) (ports.AdminAdCampaignRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.CampaignID.IsZero() {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrForbidden
	}

	input, err := normalizeUpdateAdCampaignInput(cmd)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	record, err := s.businesses.UpdateAdminAdCampaign(ctx, input)
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Updated sponsored placement",
		TargetType:  "ad_campaign",
		TargetID:    record.CampaignID.String(),
		TargetLabel: record.Headline,
		Summary:     adCampaignAuditSummary(record),
		Severity:    adCampaignAuditSeverity(record.Status),
		Metadata:    adCampaignAuditMetadata(record),
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

func (s Service) ArchiveAdCampaign(
	ctx context.Context,
	cmd ArchiveAdCampaignCommand,
) (ports.AdminAdCampaignRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.CampaignID.IsZero() {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAdCampaignRecord{}, authdomain.ErrForbidden
	}

	record, err := s.businesses.ArchiveAdminAdCampaign(ctx, ports.ArchiveAdminAdCampaignInput{
		CampaignID:     cmd.CampaignID,
		ActorAdminUser: cmd.ActorUserID,
	})
	if err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}
	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Sponsored placement archived."
	}

	metadata := adCampaignAuditMetadata(record)
	metadata["reason"] = reason
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Archived sponsored placement",
		TargetType:  "ad_campaign",
		TargetID:    record.CampaignID.String(),
		TargetLabel: record.Headline,
		Summary:     reason,
		Severity:    admindomain.AuditSeverityWarning,
		Metadata:    metadata,
		IPAddress:   cmd.IPAddress,
		UserAgent:   cmd.UserAgent,
	}); err != nil {
		return ports.AdminAdCampaignRecord{}, err
	}

	return record, nil
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func (s Service) CollectAdCampaignPayment(
	ctx context.Context,
	cmd CollectAdCampaignPaymentCommand,
) (AdCampaignPaymentResult, error) {
	if cmd.ActorUserID.IsZero() || cmd.CampaignID.IsZero() {
		return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAds); err != nil {
		return AdCampaignPaymentResult{}, err
	}
	if s.businesses == nil || s.payments == nil {
		return AdCampaignPaymentResult{}, authdomain.ErrForbidden
	}

	intent, err := s.businesses.GetAdminAdCampaignPaymentIntent(ctx, cmd.CampaignID)
	if err != nil {
		return AdCampaignPaymentResult{}, err
	}
	if intent.OpenPayment != nil {
		return AdCampaignPaymentResult{
			Payment:          *intent.OpenPayment,
			Created:          false,
			AuthorizationURL: intent.OpenPayment.PaymentURL,
		}, nil
	}
	if intent.DueMinor <= 0 {
		return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
	}

	customerEmail := ""
	if strings.TrimSpace(cmd.CustomerEmail) != "" {
		customerEmail, err = normalizeEmail(cmd.CustomerEmail)
		if err != nil {
			return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
		}
	}
	if customerEmail == "" {
		customerEmail, err = normalizeEmail(intent.OwnerEmail)
		if err != nil {
			return AdCampaignPaymentResult{}, authdomain.ErrInvalidInput
		}
	}

	paymentID := s.ids.NewID()
	reference := "xt_ad_" + s.ids.NewID().String()
	providerResult, err := s.payments.InitializeTransaction(ctx, ports.InitializeTransactionInput{
		BusinessID:      intent.BusinessID,
		CustomerEmail:   customerEmail,
		AmountMinor:     intent.DueMinor,
		CommissionMinor: 0,
		Currency:        common.CurrencyGHS,
		Reference:       reference,
	})
	if err != nil {
		return AdCampaignPaymentResult{}, err
	}
	providerReference := providerResult.ProviderReference
	if providerReference == "" {
		providerReference = reference
	}

	payment, err := s.businesses.CreateAdminAdCampaignPayment(ctx, ports.CreateAdminAdCampaignPaymentInput{
		PaymentID:         paymentID,
		CampaignID:        intent.CampaignID,
		BusinessID:        intent.BusinessID,
		ProviderReference: providerReference,
		PaymentURL:        providerResult.AuthorizationURL,
		AmountMinor:       intent.DueMinor,
		Currency:          common.CurrencyGHS,
		ActorAdminUser:    cmd.ActorUserID,
	})
	if err != nil {
		return AdCampaignPaymentResult{}, err
	}

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Created sponsored placement payment link",
		TargetType:  "ad_campaign_payment",
		TargetID:    payment.PaymentID.String(),
		TargetLabel: intent.Headline,
		Summary: "Created Paystack collection link for " +
			moneySummary(payment.AmountMinor) + " sponsored-placement budget.",
		Severity: admindomain.AuditSeverityInfo,
		Metadata: map[string]string{
			"campaign_id":        intent.CampaignID.String(),
			"business_id":        intent.BusinessID.String(),
			"provider":           payment.Provider,
			"provider_reference": payment.ProviderReference,
			"amount_minor":       strconv.FormatInt(payment.AmountMinor, 10),
			"currency":           payment.Currency,
			"customer_email":     customerEmail,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return AdCampaignPaymentResult{}, err
	}

	return AdCampaignPaymentResult{
		Payment:          payment,
		Created:          true,
		AuthorizationURL: payment.PaymentURL,
	}, nil
}
func normalizeCreateAdCampaignInput(
	cmd CreateAdCampaignCommand,
	campaignID common.ID,
) (ports.CreateAdminAdCampaignInput, error) {
	normalized, err := normalizeAdCampaignFields(adCampaignFields{
		BusinessID:    cmd.BusinessID,
		PlacementType: cmd.PlacementType,
		TargetRefID:   cmd.TargetRefID,
		Headline:      cmd.Headline,
		Description:   cmd.Description,
		Status:        cmd.Status,
		PricingModel:  cmd.PricingModel,
		BudgetMinor:   cmd.BudgetMinor,
		DailyCapMinor: cmd.DailyCapMinor,
		StartsAt:      cmd.StartsAt,
		EndsAt:        cmd.EndsAt,
		ReviewNote:    cmd.ReviewNote,
	})
	if err != nil {
		return ports.CreateAdminAdCampaignInput{}, err
	}
	return ports.CreateAdminAdCampaignInput{
		CampaignID:     campaignID,
		BusinessID:     normalized.BusinessID,
		PlacementType:  normalized.PlacementType,
		TargetRefID:    normalized.TargetRefID,
		Headline:       normalized.Headline,
		Description:    normalized.Description,
		Status:         normalized.Status,
		PricingModel:   normalized.PricingModel,
		BudgetMinor:    normalized.BudgetMinor,
		DailyCapMinor:  normalized.DailyCapMinor,
		StartsAt:       *normalized.StartsAt,
		EndsAt:         *normalized.EndsAt,
		ReviewNote:     normalized.ReviewNote,
		ActorAdminUser: cmd.ActorUserID,
	}, nil
}

func normalizeUpdateAdCampaignInput(cmd UpdateAdCampaignCommand) (ports.UpdateAdminAdCampaignInput, error) {
	normalized, err := normalizeAdCampaignFields(adCampaignFields{
		BusinessID:    cmd.BusinessID,
		PlacementType: cmd.PlacementType,
		TargetRefID:   cmd.TargetRefID,
		Headline:      cmd.Headline,
		Description:   cmd.Description,
		Status:        cmd.Status,
		PricingModel:  cmd.PricingModel,
		BudgetMinor:   cmd.BudgetMinor,
		DailyCapMinor: cmd.DailyCapMinor,
		StartsAt:      cmd.StartsAt,
		EndsAt:        cmd.EndsAt,
		ReviewNote:    cmd.ReviewNote,
	})
	if err != nil {
		return ports.UpdateAdminAdCampaignInput{}, err
	}
	return ports.UpdateAdminAdCampaignInput{
		CampaignID:     cmd.CampaignID,
		BusinessID:     normalized.BusinessID,
		PlacementType:  normalized.PlacementType,
		TargetRefID:    normalized.TargetRefID,
		Headline:       normalized.Headline,
		Description:    normalized.Description,
		Status:         normalized.Status,
		PricingModel:   normalized.PricingModel,
		BudgetMinor:    normalized.BudgetMinor,
		DailyCapMinor:  normalized.DailyCapMinor,
		StartsAt:       *normalized.StartsAt,
		EndsAt:         *normalized.EndsAt,
		ReviewNote:     normalized.ReviewNote,
		ActorAdminUser: cmd.ActorUserID,
	}, nil
}

type adCampaignFields struct {
	BusinessID    common.ID
	PlacementType string
	TargetRefID   string
	Headline      string
	Description   string
	Status        string
	PricingModel  string
	BudgetMinor   int64
	DailyCapMinor *int64
	StartsAt      *time.Time
	EndsAt        *time.Time
	ReviewNote    string
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func normalizeAdCampaignFields(input adCampaignFields) (adCampaignFields, error) {
	if input.BusinessID.IsZero() || input.StartsAt == nil || input.EndsAt == nil {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	if !input.EndsAt.After(*input.StartsAt) {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	placementType := normalizePromotionOption(input.PlacementType, "featured_business")
	if placementType != "featured_business" &&
		placementType != "promoted_design" &&
		placementType != "homepage_hero" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	targetRefID := strings.TrimSpace(input.TargetRefID)
	if placementType == "promoted_design" && targetRefID == "" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	headline := normalizeAdHeadline(input.Headline)
	if headline == "" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	status := normalizePromotionOption(input.Status, "pending_review")
	if status != "pending_review" && status != "active" && status != "paused" && status != "completed" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	pricingModel := normalizePromotionOption(input.PricingModel, "flat_time")
	if pricingModel != "flat_time" {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	if input.BudgetMinor <= 0 || (input.DailyCapMinor != nil && *input.DailyCapMinor <= 0) {
		return adCampaignFields{}, authdomain.ErrInvalidInput
	}
	return adCampaignFields{
		BusinessID:    input.BusinessID,
		PlacementType: placementType,
		TargetRefID:   targetRefID,
		Headline:      headline,
		Description:   normalizeOperatorNote(input.Description),
		Status:        status,
		PricingModel:  pricingModel,
		BudgetMinor:   input.BudgetMinor,
		DailyCapMinor: copyOptionalInt64(input.DailyCapMinor),
		StartsAt:      copyOptionalTime(input.StartsAt),
		EndsAt:        copyOptionalTime(input.EndsAt),
		ReviewNote:    normalizeOperatorNote(input.ReviewNote),
	}, nil
}

func normalizeAdHeadline(value string) string {
	headline := strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	runes := []rune(headline)
	if len(runes) > 96 {
		return string(runes[:96])
	}
	return headline
}

func adCampaignAuditSummary(record ports.AdminAdCampaignRecord) string {
	return record.Headline + " runs as " + adPlacementLabel(record.PlacementType) +
		" for " + record.BusinessName + "."
}

func adCampaignAuditMetadata(record ports.AdminAdCampaignRecord) map[string]string {
	metadata := map[string]string{
		"business_id":      record.BusinessID.String(),
		"placement_type":   record.PlacementType,
		"target_ref_id":    record.TargetRefID,
		"status":           record.Status,
		"pricing_model":    record.PricingModel,
		"budget_minor":     strconv.FormatInt(record.BudgetMinor, 10),
		"spend_minor":      strconv.FormatInt(record.SpendMinor, 10),
		"impression_count": strconv.Itoa(record.ImpressionCount),
		"click_count":      strconv.Itoa(record.ClickCount),
	}
	if record.DailyCapMinor != nil {
		metadata["daily_cap_minor"] = strconv.FormatInt(*record.DailyCapMinor, 10)
	}
	return metadata
}

func adCampaignAuditSeverity(status string) admindomain.AuditSeverity {
	switch status {
	case "active":
		return admindomain.AuditSeverityInfo
	case "pending_review":
		return admindomain.AuditSeverityInfo
	default:
		return admindomain.AuditSeverityWarning
	}
}

func adPlacementLabel(value string) string {
	switch value {
	case "homepage_hero":
		return "homepage hero"
	case "promoted_design":
		return "promoted design"
	default:
		return "featured business"
	}
}
