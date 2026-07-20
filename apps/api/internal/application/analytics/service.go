// Package analyticsapp implements §14 analytics: tenant-scoped, entitlement-
// gated read models over data the platform already persists. Two rules come
// straight from the spec: every metric is built only from the caller's own
// store (§6/§14.5), and every endpoint checks the plan's analytics_level LIVE
// from the entitlement matrix (§14.5 "Admin-configurable ... without a
// deploy"), so a matrix edit gates or ungates without a code change.
package analyticsapp

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var ErrInvalidInput = errors.New("invalid analytics input")

// ErrAnalyticsNotEntitled is the sentinel for plan-gating refusals (HTTP maps
// it to 403 analytics_not_entitled). Always wrapped in NotEntitledError, which
// carries the levels for the payload.
var ErrAnalyticsNotEntitled = errors.New("analytics not entitled")

// NotEntitledError reports a §14.1 ladder refusal with the caller's CURRENT
// analytics level and the level the capability needs, so the dashboard can
// render a targeted upgrade prompt.
type NotEntitledError struct {
	Feature       string
	RequiredLevel int
	CurrentLevel  int
}

func (e NotEntitledError) Error() string {
	return fmt.Sprintf("%s requires analytics level %d (%s); plan has %d (%s)",
		e.Feature, e.RequiredLevel, business.CapabilityLevel(e.RequiredLevel),
		e.CurrentLevel, business.CapabilityLevel(e.CurrentLevel))
}

func (e NotEntitledError) Is(target error) bool {
	return target == ErrAnalyticsNotEntitled
}

// Analytics levels (§13.4/§14.5 naming: Free=basic, Starter=standard,
// Growth=full, Studio=advanced).
const (
	LevelBasic    = 0
	LevelStandard = 1
	LevelFull     = 2
	LevelAdvanced = 3
)

// defaultLookbackDays applies when the plan's analytics_lookback_days row is
// absent/disabled from the resolved limits: the conservative Free default
// (never invent a grant — same precedent as 000088).
const defaultLookbackDays = 30

type Service struct {
	analytics ports.AnalyticsRepository
	settings  ports.StoreSettingsRepository
	clock     ports.Clock
}

type Dependencies struct {
	Analytics ports.AnalyticsRepository
	Settings  ports.StoreSettingsRepository
	Clock     ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{analytics: deps.Analytics, settings: deps.Settings, clock: deps.Clock}
}

// Command is the shared request shape for every analytics endpoint: the
// caller's tenant + role, and the optional custom date range (Studio-only,
// §14.1 "Custom date ranges").
type Command struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	From      string
	To        string
}

// analyticsLevel resolves the plan's analytics level from its entitlement
// limits. An absent row reads as basic (0) — conservative, never a grant.
func analyticsLevel(profile ports.StoreProfile) int {
	level, ok := profile.EntitlementLimits[business.LimitAnalyticsLevel]
	if !ok || level < 0 {
		return LevelBasic
	}
	return level
}

// LevelOf exposes the plan's analytics level for the sibling reports module,
// which gates the full report suite on it (§14.1).
func LevelOf(profile ports.StoreProfile) int {
	return analyticsLevel(profile)
}

// ResolveWindow is the shared §14.1 window rule (lookback clamp + Studio-only
// custom ranges) for modules that render insight data outside the analytics
// service itself — the reports module resolves export windows through it, so
// a report can never use a different window than the dashboard (§14.5).
func ResolveWindow(now time.Time, profile ports.StoreProfile, from, to string) (ports.AnalyticsWindow, error) {
	var lower *time.Time
	if days := lookbackDays(profile); days >= 0 {
		start := now.AddDate(0, 0, -days)
		lower = &start
	}
	window := ports.AnalyticsWindow{From: lower, To: now}

	if from == "" && to == "" {
		return window, nil
	}
	level := analyticsLevel(profile)
	if level < LevelAdvanced {
		return ports.AnalyticsWindow{}, NotEntitledError{
			Feature:       "custom_date_ranges",
			RequiredLevel: LevelAdvanced,
			CurrentLevel:  level,
		}
	}

	requestedFrom, err := parseRangeDate(from, false)
	if err != nil {
		return ports.AnalyticsWindow{}, ErrInvalidInput
	}
	requestedTo, err := parseRangeDate(to, true)
	if err != nil {
		return ports.AnalyticsWindow{}, ErrInvalidInput
	}
	if requestedFrom != nil && requestedTo != nil && !requestedFrom.Before(*requestedTo) {
		return ports.AnalyticsWindow{}, ErrInvalidInput
	}
	if requestedFrom != nil && (lower == nil || requestedFrom.After(*lower)) {
		window.From = requestedFrom
	}
	if requestedTo != nil && requestedTo.Before(now) {
		window.To = *requestedTo
	}
	return window, nil
}

// lookbackDays resolves the plan's history window: -1 (NULL in the matrix) =
// full history; absent row = the conservative default.
func lookbackDays(profile ports.StoreProfile) int {
	days, ok := profile.EntitlementLimits[business.LimitAnalyticsLookbackDays]
	if !ok {
		return defaultLookbackDays
	}
	return days
}

// authorize checks the caller may read analytics at all (owner/admin, like the
// Money Desk) and that the plan reaches requiredLevel, returning the profile
// for the window resolution that follows.
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
	level := analyticsLevel(profile)
	if level < requiredLevel {
		return ports.StoreProfile{}, NotEntitledError{
			Feature:       feature,
			RequiredLevel: requiredLevel,
			CurrentLevel:  level,
		}
	}
	return profile, nil
}

// resolveWindow clamps every query to the plan's lookback (§14.1: Free 30d,
// Starter 365d, full otherwise). A custom from/to range is a Studio-only
// capability (§14.1): lower tiers passing either parameter get a 403, NOT a
// silently different window — an explicit refusal beats a quiet misread.
// Custom ranges are still clamped to the lookback and to now.
func (s Service) resolveWindow(profile ports.StoreProfile, from, to string) (ports.AnalyticsWindow, error) {
	return ResolveWindow(s.clock.Now(), profile, from, to)
}

// parseRangeDate accepts YYYY-MM-DD (a date-only range bound; end bounds are
// inclusive of that day) or full RFC3339. Empty input yields nil (unbounded
// on that side).
func parseRangeDate(raw string, end bool) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	if day, err := time.Parse("2006-01-02", raw); err == nil {
		if end {
			day = day.AddDate(0, 0, 1)
		}
		return &day, nil
	}
	if ts, err := time.Parse(time.RFC3339, raw); err == nil {
		return &ts, nil
	}
	return nil, ErrInvalidInput
}
