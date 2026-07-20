package reportsapp

import (
	"context"
	"errors"
	"fmt"
	"time"

	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

var (
	ErrInvalidInput                = errors.New("invalid report input")
	ErrUnknownFormat               = errors.New("unknown export format")
	ErrExportNotEntitled           = errors.New("export format not entitled")
	ErrScheduledReportsNotEntitled = errors.New("scheduled reports not entitled")
)

// Report kinds (§14.3/§14.1 export rows).
const (
	KindFinancial = "financial"
	KindSales     = "sales"
	KindFull      = "full"
)

// Schedule cadences (§14.1: Growth monthly; Studio any cadence).
const (
	CadenceDaily   = "daily"
	CadenceWeekly  = "weekly"
	CadenceMonthly = "monthly"
)

type Service struct {
	reports   ports.ReportsRepository
	analytics ports.AnalyticsRepository
	settings  ports.StoreSettingsRepository
	writers   *Registry
	emails    ports.EmailSender
	clock     ports.Clock
}

type Dependencies struct {
	Reports   ports.ReportsRepository
	Analytics ports.AnalyticsRepository
	Settings  ports.StoreSettingsRepository
	Writers   *Registry
	// Emails delivers scheduled reports (the outbox has no email channel —
	// the API sends synchronously via Resend, like the auth flows). Nil-safe:
	// with no sender configured the sweep still generates and records runs.
	Emails ports.EmailSender
	Clock  ports.Clock
}

func NewService(deps Dependencies) Service {
	return Service{
		reports:   deps.Reports,
		analytics: deps.Analytics,
		settings:  deps.Settings,
		writers:   deps.Writers,
		emails:    deps.Emails,
		clock:     deps.Clock,
	}
}

// authorizeReports mirrors the Money Desk's rule: owner/admin only.
func (s Service) authorizeReports(ctx context.Context, scope common.TenantScope, role business.UserRole) (ports.StoreProfile, error) {
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
	return profile, nil
}

// exportFeatureKey maps a format to its §14.4 matrix boolean.
func exportFeatureKey(format string) string {
	switch format {
	case "csv":
		return business.FeatureExportCSV
	case "pdf":
		return business.FeatureExportPDF
	case "docx":
		return business.FeatureExportDOCX
	case "xlsx":
		return business.FeatureExportXLSX
	}
	return ""
}

// writerFor resolves the requested format against the registry and the plan's
// export entitlements (§14.4: "which formats are available per plan is set in
// the admin feature matrix"). Free has every boolean off → 403 on all exports
// (§14.3 view-only).
func (s Service) writerFor(profile ports.StoreProfile, format string) (Writer, error) {
	writer, ok := s.writers.Get(format)
	if !ok {
		return nil, ErrUnknownFormat
	}
	if !business.Entitlements(profile.Entitlements).Has(exportFeatureKey(format)) {
		return nil, ErrExportNotEntitled
	}
	return writer, nil
}

// scheduledReportsLevel resolves the plan's scheduled_reports limit
// (0=off, 1=monthly, 2=any cadence); absent row = off (conservative).
func scheduledReportsLevel(profile ports.StoreProfile) int {
	level, ok := profile.EntitlementLimits[business.LimitScheduledReports]
	if !ok || level < 0 {
		return 0
	}
	return level
}

// ghs renders minor units (pesewas) as major cedis for display cells. Column
// headers carry the currency, so the cell is the bare figure.
func ghs(minor int64) string {
	return fmt.Sprintf("%.2f", float64(minor)/100)
}

func reportTimestamp(t time.Time) string {
	return t.UTC().Format("2006-01-02 15:04 UTC")
}

func optionalTimestamp(t *time.Time) string {
	if t == nil {
		return ""
	}
	return reportTimestamp(*t)
}

// filename builds xtiitch-<report>-<date>.<ext> (Content-Disposition).
func filename(kind string, writer Writer, now time.Time) string {
	return fmt.Sprintf("xtiitch-%s-%s.%s", kind, now.UTC().Format("2006-01-02"), writer.Ext())
}

// resolveExportWindow applies the same §14.1 window rule as the dashboards:
// plan lookback clamp, custom ranges Studio-only (one data source, §14.5).
func (s Service) resolveExportWindow(profile ports.StoreProfile, from, to string) (ports.AnalyticsWindow, error) {
	return analyticsapp.ResolveWindow(s.clock.Now(), profile, from, to)
}
