// Package crmapp implements §15 Customer CRM: the tenant-scoped, entitlement-
// gated read-and-annotate layer over the customer data the order flow already
// persists (§15.3 "auto-populated, not manual … one customer record"). Two
// rules come straight from the spec: a store's CRM contains only its own
// customers (§6/§15.3), and every gated capability checks the plan's
// crm_level LIVE from the entitlement matrix (§15.3 "admin-configurable …
// tunable without a deploy"), so a matrix edit gates or ungates without a
// code change. There is deliberately NO create-customer command anywhere in
// this module — customers arrive via checkout/walk-in orders only.
package crmapp

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var ErrInvalidInput = errors.New("invalid crm input")

// ErrCRMNotEntitled is the sentinel for plan-gating refusals (HTTP maps it to
// 403 crm_not_entitled). Always wrapped in NotEntitledError, which carries the
// levels for the payload — the same shape analytics uses for §14.
var ErrCRMNotEntitled = errors.New("crm not entitled")

// NotEntitledError reports a §15.1 ladder refusal with the caller's CURRENT
// CRM level and the level the capability needs, so the dashboard can render a
// targeted upgrade prompt.
type NotEntitledError struct {
	Feature       string
	RequiredLevel int
	CurrentLevel  int
}

func (e NotEntitledError) Error() string {
	return fmt.Sprintf("%s requires crm level %d (%s); plan has %d (%s)",
		e.Feature, e.RequiredLevel, business.CapabilityLevel(e.RequiredLevel),
		e.CurrentLevel, business.CapabilityLevel(e.CurrentLevel))
}

func (e NotEntitledError) Is(target error) bool {
	return target == ErrCRMNotEntitled
}

// CRM levels (§13.4/§15.1 naming: Free=basic, Starter=standard, Growth=full,
// Studio=advanced).
const (
	LevelBasic    = 0
	LevelStandard = 1
	LevelFull     = 2
	LevelAdvanced = 3
)

// List pagination: the list endpoint pages (§15 brief) with a conservative
// default and a hard cap so a ?limit= can never pull an unbounded set.
const (
	defaultListLimit = 50
	maxListLimit     = 200
)

// Validation bounds for the two annotation writes (notes/tags are owner
// free-text, but still bounded so a paste can't blow up a row).
const (
	maxNoteLength = 2000
	maxTags       = 20
	maxTagLength  = 40
)

type Service struct {
	crm      ports.CRMRepository
	settings ports.StoreSettingsRepository
	writers  *reportsapp.Registry
	clock    ports.Clock
}

type Dependencies struct {
	CRM      ports.CRMRepository
	Settings ports.StoreSettingsRepository
	// Writers is the §14.4 reports writer registry, reused read-only (§15.1
	// export row: Growth CSV, Studio any format — same formats, same files).
	Writers *reportsapp.Registry
	Clock   ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{crm: deps.CRM, settings: deps.Settings, writers: deps.Writers, clock: deps.Clock}
}

// crmLevel resolves the plan's CRM level from its entitlement limits. An
// absent row reads as basic (0) — conservative, never a grant (same precedent
// as analytics).
func crmLevel(profile ports.StoreProfile) int {
	level, ok := profile.EntitlementLimits[business.LimitCRMLevel]
	if !ok || level < 0 {
		return LevelBasic
	}
	return level
}

// authorize checks the caller may use the CRM at all (owner/admin, like
// analytics and the Money Desk) and that the plan reaches requiredLevel,
// returning the resolved store profile for the capability checks that follow.
func (s Service) authorize(ctx context.Context, scope common.TenantScope, role business.UserRole, requiredLevel int, feature string) (ports.StoreProfile, error) {
	if scope.BusinessID.IsZero() {
		return ports.StoreProfile{}, ErrInvalidInput
	}
	if role != business.UserRoleOwner && role != business.UserRoleAdmin {
		return ports.StoreProfile{}, authdomain.ErrForbidden
	}
	profile, err := s.settings.GetProfile(ctx, scope)
	if err != nil {
		return ports.StoreProfile{}, err
	}
	level := crmLevel(profile)
	if level < requiredLevel {
		return ports.StoreProfile{}, NotEntitledError{
			Feature:       feature,
			RequiredLevel: requiredLevel,
			CurrentLevel:  level,
		}
	}
	return profile, nil
}

// parseListDate accepts YYYY-MM-DD (a date-only bound; "before" bounds are
// inclusive of that day) or full RFC3339 — the same convention the analytics
// custom-range bounds use, so filters behave identically across modules.
func parseListDate(raw string, endBound bool) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	if day, err := time.Parse("2006-01-02", raw); err == nil {
		if endBound {
			day = day.AddDate(0, 0, 1)
		}
		return &day, nil
	}
	if ts, err := time.Parse(time.RFC3339, raw); err == nil {
		return &ts, nil
	}
	return nil, ErrInvalidInput
}
