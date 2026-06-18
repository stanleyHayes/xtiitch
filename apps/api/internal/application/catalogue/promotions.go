package catalogueapp

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var businessPromotionCodePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$`)

type BusinessPromotionCommand struct {
	Scope                 common.TenantScope
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
	if s.promotions == nil || cmd.Scope.BusinessID.IsZero() {
		return ports.BusinessPromotionRecord{}, ErrInvalidInput
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
	if s.promotions == nil || cmd.Scope.BusinessID.IsZero() || cmd.PromotionID.IsZero() {
		return ports.BusinessPromotionRecord{}, ErrInvalidInput
	}
	input, err := normalizeBusinessPromotionInput(cmd)
	if err != nil {
		return ports.BusinessPromotionRecord{}, err
	}
	return s.promotions.UpdateBusinessPromotion(ctx, cmd.Scope, input)
}

func (s Service) ArchiveBusinessPromotion(
	ctx context.Context,
	scope common.TenantScope,
	promotionID common.ID,
) (ports.BusinessPromotionRecord, error) {
	if s.promotions == nil || scope.BusinessID.IsZero() || promotionID.IsZero() {
		return ports.BusinessPromotionRecord{}, ErrInvalidInput
	}
	return s.promotions.ArchiveBusinessPromotion(ctx, scope, promotionID)
}

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
