package catalogueapp

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ErrPromotionsNotEntitled is returned when a store tries to create or edit a
// promotion but its plan does not grant the promotions entitlement (§13.4:
// "Free-plan stores cannot run promotions. That feature is not activated for
// them — it is for paid users only."). The HTTP layer maps this to 403.
var ErrPromotionsNotEntitled = errors.New("promotions are not included in this store's plan")

var businessPromotionCodePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$`)

type BusinessPromotionCommand struct {
	Scope                 common.TenantScope
	ActorRole             business.UserRole
	PromotionID           common.ID
	Code                  string
	Title                 string
	Description           string
	DiscountType          string
	DiscountValue         int64
	MaxDiscountMinor      *int64
	MinSpendMinor         int64
	UsageLimitGlobal      *int
	UsageLimitPerCustomer *int
	ScopeName             string
	TargetCollectionID    *common.ID
	TargetDesignID        *common.ID
	Status                string
	StartsAt              *time.Time
	EndsAt                *time.Time
}

func (s Service) ListBusinessPromotions(
	ctx context.Context,
	scope common.TenantScope,
) ([]ports.BusinessPromotionRecord, error) {
	if s.promotions == nil || scope.BusinessID.IsZero() {
		return nil, ErrInvalidInput
	}
	return s.promotions.ListBusinessPromotions(ctx, scope)
}
func (s Service) CreateBusinessPromotion(
	ctx context.Context,
	cmd BusinessPromotionCommand,
) (ports.BusinessPromotionRecord, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	if s.promotions == nil || cmd.Scope.BusinessID.IsZero() {
		return ports.BusinessPromotionRecord{}, ErrInvalidInput
	}
	if err := s.requirePromotionsEntitlement(ctx, cmd.Scope); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	cmd.PromotionID = s.ids.NewID()
	input, err := normalizeBusinessPromotionInput(cmd)
	if err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	return s.promotions.CreateBusinessPromotion(ctx, cmd.Scope, input)
}
func (s Service) UpdateBusinessPromotion(
	ctx context.Context,
	cmd BusinessPromotionCommand,
) (ports.BusinessPromotionRecord, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	if s.promotions == nil || cmd.Scope.BusinessID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.BusinessPromotionRecord{}, ErrInvalidInput
	}
	if err := s.requirePromotionsEntitlement(ctx, cmd.Scope); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	input, err := normalizeBusinessPromotionInput(cmd)
	if err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	return s.promotions.UpdateBusinessPromotion(ctx, cmd.Scope, input)
}

// requirePromotionsEntitlement is the server-side plan gate behind the dashboard's
// UI gating (§13.4): a store whose plan does not grant the promotions entitlement
// cannot create or edit one, whatever the client shows. Listing and archiving stay
// open on purpose — a store that downgraded must still see and switch off the
// promotions it ran while entitled. Paid-plan stores that have never paid are
// activation-gated first (§13.2), exactly like store settings.
func (s Service) requirePromotionsEntitlement(ctx context.Context, scope common.TenantScope) error {
	profile, err := s.settings.GetProfile(ctx, scope)
	if err != nil {
		return err
	}
	if profile.ActivationRequired {
		return ErrActivationRequired
	}
	if !business.Entitlements(profile.Entitlements).Has(business.FeaturePromotions) {
		return ErrPromotionsNotEntitled
	}
	return nil
}

type BusinessPromotionActionCommand struct {
	Scope       common.TenantScope
	ActorRole   business.UserRole
	PromotionID common.ID
}

func (s Service) ArchiveBusinessPromotion(
	ctx context.Context,
	cmd BusinessPromotionActionCommand,
) (ports.BusinessPromotionRecord, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	if s.promotions == nil || cmd.Scope.BusinessID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.BusinessPromotionRecord{}, ErrInvalidInput
	}
	return s.promotions.ArchiveBusinessPromotion(ctx, cmd.Scope, cmd.PromotionID)
}

//nolint:funlen,gocognit,gocyclo // Phase 2 follow-up: extract helpers while preserving behaviour
func normalizeBusinessPromotionInput(cmd BusinessPromotionCommand) (ports.BusinessPromotionInput, error) {
	code := strings.ToUpper(strings.TrimSpace(cmd.Code))
	if !businessPromotionCodePattern.MatchString(code) {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}
	title := strings.TrimSpace(cmd.Title)
	if title == "" {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}

	discountType := strings.ToLower(strings.TrimSpace(cmd.DiscountType))
	if discountType == "" {
		discountType = "percentage"
	}
	if discountType != "percentage" && discountType != "fixed" {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}
	if discountType == "percentage" {
		if cmd.DiscountValue <= 0 || cmd.DiscountValue > 10000 ||
			cmd.MaxDiscountMinor == nil || *cmd.MaxDiscountMinor <= 0 {
			return ports.BusinessPromotionInput{}, ErrInvalidInput
		}
	} else if cmd.DiscountValue <= 0 {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}

	if cmd.MinSpendMinor < 0 {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}
	if cmd.UsageLimitGlobal != nil && *cmd.UsageLimitGlobal <= 0 {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}
	if cmd.UsageLimitPerCustomer != nil && *cmd.UsageLimitPerCustomer <= 0 {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}

	scopeName := strings.ToLower(strings.TrimSpace(cmd.ScopeName))
	if scopeName == "" {
		scopeName = "store"
	}
	switch scopeName {
	case "store":
		cmd.TargetCollectionID = nil
		cmd.TargetDesignID = nil
	case "collection":
		if cmd.TargetCollectionID == nil || (*cmd.TargetCollectionID).IsZero() || cmd.TargetDesignID != nil {
			return ports.BusinessPromotionInput{}, ErrInvalidInput
		}
	case "design":
		if cmd.TargetDesignID == nil || (*cmd.TargetDesignID).IsZero() || cmd.TargetCollectionID != nil {
			return ports.BusinessPromotionInput{}, ErrInvalidInput
		}
	default:
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}

	status := strings.ToLower(strings.TrimSpace(cmd.Status))
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "paused" {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}
	if cmd.StartsAt != nil && cmd.EndsAt != nil && !cmd.EndsAt.After(*cmd.StartsAt) {
		return ports.BusinessPromotionInput{}, ErrInvalidInput
	}

	return ports.BusinessPromotionInput{
		PromotionID:           cmd.PromotionID,
		BusinessID:            cmd.Scope.BusinessID,
		Code:                  code,
		Title:                 title,
		Description:           strings.TrimSpace(cmd.Description),
		DiscountType:          discountType,
		DiscountValue:         cmd.DiscountValue,
		MaxDiscountMinor:      cmd.MaxDiscountMinor,
		MinSpendMinor:         cmd.MinSpendMinor,
		UsageLimitGlobal:      cmd.UsageLimitGlobal,
		UsageLimitPerCustomer: cmd.UsageLimitPerCustomer,
		Scope:                 scopeName,
		TargetCollectionID:    cmd.TargetCollectionID,
		TargetDesignID:        cmd.TargetDesignID,
		Status:                status,
		StartsAt:              cmd.StartsAt,
		EndsAt:                cmd.EndsAt,
	}, nil
}
