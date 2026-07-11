package catalogueapp

import (
	"context"
	"errors"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/catalogue"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var ErrInvalidInput = errors.New("invalid catalogue input")

// ErrActivationRequired is returned when a paid-plan business tries to use a core
// paid write-action before it has paid (activated) its first invoice. Its
// subscription is still 'trialing'; the HTTP layer maps this to 402.
var ErrActivationRequired = errors.New("plan activation required")

// activationPending reports whether a subscription status blocks paid features.
// A 'trialing' paid plan has never paid its first invoice, so it is gated. An
// empty/unknown status (free plans, or no subscription row) counts as activated
// (fail-open), leaving existing tests and free plans unaffected.
func activationPending(status string) bool { return status == "trialing" }

// ErrPricingModeConflict is returned when a size-band price is set on a design
// in customisation (deposit) mode. It aliases the port-level error so the
// repository can surface it atomically and the handler maps it to a 409.
var ErrPricingModeConflict = ports.ErrPricingModeConflict

// normalizeSizeChart trims and validates a size band's chart entries: every entry
// must have a non-empty name and value and a unit from catalogue.SizeChartUnits.
// Units are lower-cased. Returns the cleaned chart or ErrInvalidInput.
func normalizeSizeChart(items []catalogue.SizeChartItem) ([]catalogue.SizeChartItem, error) {
	if len(items) == 0 {
		return nil, nil
	}
	cleaned := make([]catalogue.SizeChartItem, 0, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.Name)
		value := strings.TrimSpace(item.Value)
		unit := strings.ToLower(strings.TrimSpace(item.Unit))
		if name == "" || value == "" || !catalogue.ValidSizeChartUnit(unit) {
			return nil, ErrInvalidInput
		}
		cleaned = append(cleaned, catalogue.SizeChartItem{Name: name, Value: value, Unit: unit})
	}
	return cleaned, nil
}

// ErrWaitlistUnavailable is returned when a customer tries to join a design's
// waiting list but the store's plan does not grant the design_waitlist benefit.
var ErrWaitlistUnavailable = errors.New("waiting list not available for this store")

// ErrStoreNotFound is returned when a public store handle does not resolve.
var ErrStoreNotFound = errors.New("store not found")

// ErrDesignUnavailable is returned when a design handle does not resolve to an
// active design within the resolved store.
var ErrDesignUnavailable = errors.New("design unavailable")

// validWaitlistStatuses are the dashboard-settable states for an entry.
var validWaitlistStatuses = map[string]bool{
	"waiting":  true,
	"notified": true,
	"closed":   true,
}

type Service struct {
	catalogue  ports.CatalogueRepository
	storefront ports.StorefrontRepository
	settings   ports.StoreSettingsRepository
	promotions ports.PromotionRepository
	waitlist   ports.DesignWaitlistRepository
	ids        ports.IDGenerator
}
type Dependencies struct {
	Catalogue  ports.CatalogueRepository
	Storefront ports.StorefrontRepository
	Settings   ports.StoreSettingsRepository
	Promotions ports.PromotionRepository
	Waitlist   ports.DesignWaitlistRepository
	IDs        ports.IDGenerator
}

func NewService(deps Dependencies) Service {
	return Service{
		catalogue:  deps.Catalogue,
		storefront: deps.Storefront,
		settings:   deps.Settings,
		promotions: deps.Promotions,
		waitlist:   deps.Waitlist,
		ids:        deps.IDs,
	}
}
func (s Service) newHandle(name string) string {
	return catalogue.BuildHandle(name, catalogue.NewHandleToken(s.ids.NewID().String()))
}
func (s Service) GetSettings(ctx context.Context, scope common.TenantScope) (ports.StoreSettings, error) {
	return s.settings.Get(ctx, scope)
}

type UpdateSettingsCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Settings  ports.StoreSettings
}

func (s Service) UpdateSettings(ctx context.Context, cmd UpdateSettingsCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	// Server-side entitlement gate: resolve the business's plan benefits and coerce
	// any customization its plan does not grant back to the Xtiitch default before
	// persisting. This is the enforceable backstop behind the dashboard's UI gating —
	// a business on a plan without custom_* simply cannot persist that customization.
	profile, err := s.settings.GetProfile(ctx, cmd.Scope)
	if err != nil {
		return err
	}
	if activationPending(profile.SubscriptionStatus) {
		return ErrActivationRequired
	}
	settings := coerceStoreCustomization(business.Entitlements(profile.Entitlements), cmd.Settings)
	return s.settings.Update(ctx, cmd.Scope, settings)
}

// coerceStoreCustomization forces plan-gated storefront fields back to their
// defaults whenever the business is not entitled to the matching benefit.
func coerceStoreCustomization(ent business.Entitlements, settings ports.StoreSettings) ports.StoreSettings {
	settings.BrandColor = strings.TrimSpace(settings.BrandColor)
	settings.LogoURL = strings.TrimSpace(settings.LogoURL)
	settings.BannerURL = strings.TrimSpace(settings.BannerURL)
	settings.LayoutVariant = strings.TrimSpace(settings.LayoutVariant)

	if !ent.Has(business.FeatureCustomBrandColor) || settings.BrandColor == "" {
		settings.BrandColor = business.DefaultBrandColor
	}
	if !ent.Has(business.FeatureCustomLogo) {
		settings.LogoURL = ""
	}
	if !ent.Has(business.FeatureCustomBanner) {
		settings.BannerURL = ""
	}
	if !ent.Has(business.FeatureCustomLayout) || !business.IsValidLayoutVariant(settings.LayoutVariant) {
		settings.LayoutVariant = business.DefaultLayoutVariant
	}
	return settings
}
func (s Service) GetStoreProfile(ctx context.Context, scope common.TenantScope) (ports.StoreProfile, error) {
	return s.settings.GetProfile(ctx, scope)
}

type JoinDesignWaitlistCommand struct {
	StoreHandle     string
	DesignHandle    string
	CustomerName    string
	CustomerContact string
	Note            string
}

// JoinDesignWaitlist registers a customer's interest in a design from the public
// storefront. It resolves the store + design, enforces the design_waitlist plan
// benefit, and verifies the design belongs to the resolved store (tenant safety).
func (s Service) JoinDesignWaitlist(ctx context.Context, cmd JoinDesignWaitlistCommand) error {
	name := strings.TrimSpace(cmd.CustomerName)
	contact := strings.TrimSpace(cmd.CustomerContact)
	if name == "" || contact == "" {
		return ErrInvalidInput
	}

	store, err := s.storefront.ResolveStore(ctx, strings.TrimSpace(cmd.StoreHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return ErrStoreNotFound
		}
		return err
	}
	if !store.WaitlistEnabled {
		return ErrWaitlistUnavailable
	}

	design, err := s.storefront.GetActiveDesignByHandle(ctx, strings.TrimSpace(cmd.DesignHandle))
	if err != nil {
		if errors.Is(err, ports.ErrNotFound) {
			return ErrDesignUnavailable
		}
		return err
	}
	if design.Design.BusinessID != store.BusinessID {
		return ErrDesignUnavailable
	}

	scope := common.TenantScope{BusinessID: store.BusinessID}
	return s.waitlist.Join(ctx, scope, ports.DesignWaitlistEntryInput{
		EntryID:         s.ids.NewID(),
		BusinessID:      store.BusinessID,
		DesignID:        design.Design.ID,
		CustomerName:    name,
		CustomerContact: contact,
		Note:            strings.TrimSpace(cmd.Note),
	})
}
func (s Service) ListWaitlistEntries(ctx context.Context, scope common.TenantScope) ([]ports.DesignWaitlistEntry, error) {
	return s.waitlist.List(ctx, scope)
}

type UpdateWaitlistStatusCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	EntryID   common.ID
	Status    string
}

func (s Service) UpdateWaitlistStatus(ctx context.Context, cmd UpdateWaitlistStatusCommand) error {
	if err := authorizeCatalogueManagement(cmd.Scope, cmd.ActorRole); err != nil {
		return err
	}
	if !validWaitlistStatuses[cmd.Status] {
		return ErrInvalidInput
	}
	return s.waitlist.UpdateStatus(ctx, cmd.Scope, cmd.EntryID, cmd.Status)
}
func authorizeCatalogueManagement(scope common.TenantScope, role business.UserRole) error {
	if scope.BusinessID.IsZero() {
		return ErrInvalidInput
	}
	if role == business.UserRoleOwner || role == business.UserRoleAdmin {
		return nil
	}
	return authdomain.ErrForbidden
}
