package catalogueapp

import (
	"context"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type CreateSizeBandCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Label     string
	Chart     []catalogue.SizeChartItem
	Sequence  int
}

func (s Service) CreateSizeBand(ctx context.Context, cmd CreateSizeBandCommand) (common.ID, error) {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return "", err
	}
	label := strings.TrimSpace(cmd.Label)
	if label == "" {
		return "", ErrInvalidInput
	}
	chart, err := normalizeSizeChart(cmd.Chart)
	if err != nil {
		return "", err
	}
	id := s.ids.NewID()
	createErr := s.catalogue.CreateSizeBand(ctx, cmd.Scope, ports.SizeBandInput{
		SizeBandID: id,
		BusinessID: cmd.Scope.BusinessID,
		Label:      label,
		Chart:      chart,
		Sequence:   cmd.Sequence,
	})
	return id, createErr
}
func (s Service) ListSizeBands(ctx context.Context, scope common.TenantScope) ([]catalogue.SizeBand, error) {
	return s.catalogue.ListSizeBands(ctx, scope)
}

type UpdateSizeBandCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	SizeBandID common.ID
	Label      string
	Chart      []catalogue.SizeChartItem
	Sequence   int
}

// UpdateSizeBand edits a size band's label, measurement chart, and display order.
func (s Service) UpdateSizeBand(ctx context.Context, cmd UpdateSizeBandCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	label := strings.TrimSpace(cmd.Label)
	if label == "" {
		return ErrInvalidInput
	}
	chart, err := normalizeSizeChart(cmd.Chart)
	if err != nil {
		return err
	}
	return s.catalogue.UpdateSizeBand(ctx, cmd.Scope, ports.SizeBandUpdateInput{
		SizeBandID: cmd.SizeBandID,
		BusinessID: cmd.Scope.BusinessID,
		Label:      label,
		Chart:      chart,
		Sequence:   cmd.Sequence,
	})
}

type DeleteSizeBandCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	SizeBandID common.ID
}

// DeleteSizeBand removes a size band; its per-design prices cascade away.
func (s Service) DeleteSizeBand(ctx context.Context, cmd DeleteSizeBandCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	return s.catalogue.DeleteSizeBand(ctx, cmd.Scope, cmd.SizeBandID)
}

type SetDesignPriceCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	DesignID   common.ID
	SizeBandID common.ID
	PriceMinor int64
}

func (s Service) SetDesignPrice(ctx context.Context, cmd SetDesignPriceCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.PriceMinor < 0 {
		return ErrInvalidInput
	}
	// Pricing-mode exclusivity (customisation designs are priced by deposit, not
	// size-band prices) is enforced atomically inside the repository's write
	// transaction, which returns ports.ErrPricingModeConflict.
	return s.catalogue.SetDesignPrice(ctx, cmd.Scope, cmd.DesignID, cmd.SizeBandID, cmd.PriceMinor)
}

// ListDesignPrices returns a design's per-band prices with the EFFECTIVE band
// label/chart resolved: any per-design size-band override wins over the master
// band, master otherwise (Xtiitch-Updates §1a/§6).
func (s Service) ListDesignPrices(ctx context.Context, scope common.TenantScope, designID common.ID) ([]catalogue.BandPrice, error) {
	prices, err := s.catalogue.ListDesignPrices(ctx, scope, designID)
	if err != nil {
		return nil, err
	}
	overrides, err := s.catalogue.ListDesignSizeBandOverrides(ctx, scope, designID)
	if err != nil {
		return nil, err
	}
	return catalogue.ApplyBandOverrides(prices, overrides), nil
}

type SetDesignSizeBandOverrideCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	DesignID   common.ID
	SizeBandID common.ID
	// Label overrides the master band's label for this design only. A nil pointer
	// (or a blank string) leaves the master label in place.
	Label *string
	// Chart overrides the master band's measurement chart for this design only,
	// but only when ChartSet is true (ChartSet true with an empty Chart blanks the
	// chart for this design; ChartSet false leaves the master chart in place).
	Chart    []catalogue.SizeChartItem
	ChartSet bool
}

// SetDesignSizeBandOverride upserts a design's override of one master size band's
// label and/or chart. The override is scoped to exactly this (design, band) and
// never touches the master or any other design. It rejects an empty override
// (neither a label nor a chart to apply).
func (s Service) SetDesignSizeBandOverride(ctx context.Context, cmd SetDesignSizeBandOverrideCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.DesignID.IsZero() || cmd.SizeBandID.IsZero() {
		return ErrInvalidInput
	}

	var label *string
	if cmd.Label != nil {
		if trimmed := strings.TrimSpace(*cmd.Label); trimmed != "" {
			label = &trimmed
		}
	}

	var chart []catalogue.SizeChartItem
	if cmd.ChartSet {
		cleaned, err := normalizeSizeChart(cmd.Chart)
		if err != nil {
			return err
		}
		chart = cleaned
	}

	// An override that carries neither a label nor a chart would be a no-op row;
	// reject it so callers clear an override via Delete instead.
	if label == nil && !cmd.ChartSet {
		return ErrInvalidInput
	}

	return s.catalogue.SetDesignSizeBandOverride(ctx, cmd.Scope, ports.DesignSizeBandOverrideInput{
		OverrideID: s.ids.NewID(),
		DesignID:   cmd.DesignID,
		BusinessID: cmd.Scope.BusinessID,
		SizeBandID: cmd.SizeBandID,
		Label:      label,
		Chart:      chart,
		ChartSet:   cmd.ChartSet,
	})
}

type DeleteDesignSizeBandOverrideCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	DesignID   common.ID
	SizeBandID common.ID
}

// DeleteDesignSizeBandOverride clears a design's override for one band, reverting
// it to the master band's label/chart. Clearing an absent override is a no-op.
func (s Service) DeleteDesignSizeBandOverride(ctx context.Context, cmd DeleteDesignSizeBandOverrideCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if cmd.DesignID.IsZero() || cmd.SizeBandID.IsZero() {
		return ErrInvalidInput
	}
	return s.catalogue.DeleteDesignSizeBandOverride(ctx, cmd.Scope, cmd.DesignID, cmd.SizeBandID)
}

// ListDesignSizeBandOverrides returns a design's stored size-band overrides, for
// the dashboard's override editor.
func (s Service) ListDesignSizeBandOverrides(
	ctx context.Context,
	scope common.TenantScope,
	designID common.ID) ([]catalogue.DesignSizeBandOverride,
	error,
) {
	return s.catalogue.ListDesignSizeBandOverrides(ctx, scope, designID)
}
