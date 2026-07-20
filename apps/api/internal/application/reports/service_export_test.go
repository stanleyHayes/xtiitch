package reportsapp

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// --- colocated fakes ---

type fakeReportsRepo struct {
	financial   ports.FinancialReportData
	sales       ports.SalesReportData
	schedule    ports.ReportSchedule
	scheduleErr error
	upserted    ports.ReportSchedule
	due         []ports.ReportSchedule
	markedSent  map[common.ID]time.Time
	lastWindow  ports.AnalyticsWindow
}

func (f *fakeReportsRepo) FinancialReport(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) (ports.FinancialReportData, error) {
	f.lastWindow = window
	return f.financial, nil
}

func (f *fakeReportsRepo) SalesReport(_ context.Context, _ common.TenantScope, window ports.AnalyticsWindow) (ports.SalesReportData, error) {
	f.lastWindow = window
	return f.sales, nil
}

func (f *fakeReportsRepo) GetSchedule(_ context.Context, _ common.TenantScope) (ports.ReportSchedule, error) {
	return f.schedule, f.scheduleErr
}

func (f *fakeReportsRepo) UpsertSchedule(_ context.Context, _ common.TenantScope, schedule ports.ReportSchedule) error {
	f.upserted = schedule
	return nil
}

func (f *fakeReportsRepo) DueSchedules(_ context.Context, _ time.Time) ([]ports.ReportSchedule, error) {
	return f.due, nil
}

func (f *fakeReportsRepo) MarkScheduleSent(_ context.Context, businessID common.ID, sentAt time.Time) error {
	if f.markedSent == nil {
		f.markedSent = map[common.ID]time.Time{}
	}
	f.markedSent[businessID] = sentAt
	return nil
}

type fakeAnalyticsStub struct {
	mix          ports.CustomerMix
	topCustomers []ports.TopCustomer
	performance  []ports.DesignPerformance
	breakdowns   ports.RevenueBreakdowns
	balances     []ports.OutstandingBalance
}

func (f fakeAnalyticsStub) Summary(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) (ports.AnalyticsSummary, error) {
	return ports.AnalyticsSummary{}, nil
}
func (f fakeAnalyticsStub) SalesTrend(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) ([]ports.DailySalesPoint, error) {
	return nil, nil
}
func (f fakeAnalyticsStub) OrdersTrend(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) ([]ports.DailyOrdersPoint, error) {
	return nil, nil
}
func (f fakeAnalyticsStub) TopDesigns(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow, _ int) ([]ports.TopDesign, error) {
	return nil, nil
}
func (f fakeAnalyticsStub) CustomerMix(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) (ports.CustomerMix, error) {
	return f.mix, nil
}
func (f fakeAnalyticsStub) TopCustomers(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow, _ int) ([]ports.TopCustomer, error) {
	return f.topCustomers, nil
}
func (f fakeAnalyticsStub) CustomerGrowth(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) ([]ports.CustomerGrowthPoint, error) {
	return nil, nil
}
func (f fakeAnalyticsStub) OutstandingBalances(_ context.Context, _ common.TenantScope) ([]ports.OutstandingBalance, error) {
	return f.balances, nil
}
func (f fakeAnalyticsStub) RevenueBreakdowns(_ context.Context, _ common.TenantScope, _ ports.AnalyticsWindow) (ports.RevenueBreakdowns, error) {
	return f.breakdowns, nil
}
func (f fakeAnalyticsStub) DesignPerformance(_ context.Context, _ common.TenantScope) ([]ports.DesignPerformance, error) {
	return f.performance, nil
}
func (f fakeAnalyticsStub) StaffActivity(_ context.Context, _ common.TenantScope) ([]ports.StaffActivity, error) {
	return nil, nil
}

type fakeSettingsStub struct{ profile ports.StoreProfile }

func (f fakeSettingsStub) Get(_ context.Context, _ common.TenantScope) (ports.StoreSettings, error) {
	return ports.StoreSettings{}, nil
}
func (f fakeSettingsStub) Update(_ context.Context, _ common.TenantScope, _ ports.StoreSettings) error {
	return nil
}
func (f fakeSettingsStub) GetProfile(_ context.Context, _ common.TenantScope) (ports.StoreProfile, error) {
	return f.profile, nil
}

type fakeEmailSender struct{ sent []ports.EmailMessage }

func (f *fakeEmailSender) Send(_ context.Context, message ports.EmailMessage) error {
	f.sent = append(f.sent, message)
	return nil
}

type reportsFixedClock struct{ now time.Time }

func (c reportsFixedClock) Now() time.Time { return c.now }

var reportsTestNow = time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC)

// planProfile builds a StoreProfile with the §14 entitlement keys the launch
// matrix seeds (000106): analytics level + lookback, scheduled_reports limit,
// export booleans.
func planProfile(level, lookback, scheduled int, exports ...string) ports.StoreProfile {
	entitlements := map[string]bool{}
	for _, format := range exports {
		entitlements[exportFeatureKey(format)] = true
	}
	return ports.StoreProfile{
		Name:         "Test Store",
		Entitlements: entitlements,
		EntitlementLimits: map[string]int{
			business.LimitAnalyticsLevel:        level,
			business.LimitAnalyticsLookbackDays: lookback,
			business.LimitScheduledReports:      scheduled,
		},
	}
}

var (
	freeProfile    = planProfile(0, 30, 0)
	starterProfile = planProfile(1, 365, 0, "csv")
	growthProfile  = planProfile(2, -1, 1, "csv", "pdf")
	studioProfile  = planProfile(3, -1, 2, "csv", "pdf", "docx", "xlsx")
)

func newReportsService(repo *fakeReportsRepo, profile ports.StoreProfile, emails ports.EmailSender) Service {
	return NewService(Dependencies{
		Reports:   repo,
		Analytics: fakeAnalyticsStub{},
		Settings:  fakeSettingsStub{profile: profile},
		Writers:   NewDefaultRegistry(),
		Emails:    emails,
		Clock:     reportsFixedClock{now: reportsTestNow},
	})
}

func ownerExport(format string) ExportCommand {
	return ExportCommand{
		Scope:     common.TenantScope{BusinessID: "biz-1"},
		ActorRole: business.UserRoleOwner,
		Format:    format,
	}
}

// One seeded payment whose PERSISTED provider figures must surface verbatim
// in the export (§3.2/§14.5): provider_fee 187, commission 500 (of which tax
// 100), amount 10000 → store share 9313.
func seededFinancial() ports.FinancialReportData {
	return ports.FinancialReportData{
		Totals: ports.FinancialTotals{
			ThroughPlatformMinor: 10000, CommissionMinor: 500, XtiitchTaxMinor: 100,
			PaystackFeeMinor: 187, StoreShareMinor: 9313,
		},
		Payments: []ports.FinancialPaymentRow{{
			CreatedAt: reportsTestNow, ProviderReference: "ref_1", Purpose: "standard_full",
			Method: "momo", Status: "succeeded", AmountMinor: 10000, CommissionMinor: 500,
			XtiitchTaxMinor: 100, ProviderFeeMinor: 187, StoreShareMinor: 9313,
		}},
	}
}

// --- export gating (§14.3/§14.4) ---

func TestExport_FreePlanForbiddenOnEveryFormat(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, freeProfile, nil)
	for _, format := range []string{"csv", "pdf", "docx", "xlsx"} {
		for _, export := range []func(ExportCommand) error{
			func(c ExportCommand) error { _, e := service.ExportFinancial(context.Background(), c); return e },
			func(c ExportCommand) error { _, e := service.ExportSales(context.Background(), c); return e },
			func(c ExportCommand) error { _, e := service.ExportFull(context.Background(), c); return e },
		} {
			if err := export(ownerExport(format)); !errors.Is(err, ErrExportNotEntitled) {
				t.Fatalf("Free %s: want ErrExportNotEntitled, got %v", format, err)
			}
		}
	}
}

func TestExport_FormatLadderPerPlan(t *testing.T) {
	cases := []struct {
		name    string
		profile ports.StoreProfile
		allowed []string
		denied  []string
	}{
		{"Starter CSV only", starterProfile, []string{"csv"}, []string{"pdf", "docx", "xlsx"}},
		{"Growth CSV+PDF", growthProfile, []string{"csv", "pdf"}, []string{"docx", "xlsx"}},
		{"Studio any", studioProfile, []string{"csv", "pdf", "docx", "xlsx"}, nil},
	}
	for _, tc := range cases {
		for _, format := range tc.allowed {
			service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, tc.profile, nil)
			if _, err := service.ExportFinancial(context.Background(), ownerExport(format)); err != nil {
				t.Fatalf("%s %s: want pass, got %v", tc.name, format, err)
			}
		}
		for _, format := range tc.denied {
			service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, tc.profile, nil)
			if _, err := service.ExportFinancial(context.Background(), ownerExport(format)); !errors.Is(err, ErrExportNotEntitled) {
				t.Fatalf("%s %s: want ErrExportNotEntitled, got %v", tc.name, format, err)
			}
		}
	}
}

func TestExport_UnknownFormatRejected(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, studioProfile, nil)
	if _, err := service.ExportFinancial(context.Background(), ownerExport("json")); !errors.Is(err, ErrUnknownFormat) {
		t.Fatalf("want ErrUnknownFormat, got %v", err)
	}
}

func TestExportFull_RequiresFullAnalyticsLevel(t *testing.T) {
	// Starter has CSV exports but basic-standard analytics: the full suite
	// must refuse with the analytics gate, not the export gate.
	service := newReportsService(&fakeReportsRepo{}, starterProfile, nil)
	_, err := service.ExportFull(context.Background(), ownerExport("csv"))
	if !errors.Is(err, analyticsapp.ErrAnalyticsNotEntitled) {
		t.Fatalf("want ErrAnalyticsNotEntitled, got %v", err)
	}
}

func TestExport_FinancialUsesPersistedProviderFiguresVerbatim(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, growthProfile, nil)
	file, err := service.ExportFinancial(context.Background(), ownerExport("csv"))
	if err != nil {
		t.Fatalf("ExportFinancial: %v", err)
	}
	body := string(file.Content)
	for _, verbatim := range []string{"100.00", "5.00", "1.00", "1.87", "93.13", "ref_1"} {
		if !strings.Contains(body, verbatim) {
			t.Fatalf("export missing persisted figure %q:\n%s", verbatim, body)
		}
	}
	if file.ContentType != "text/csv; charset=utf-8" {
		t.Fatalf("content type: %s", file.ContentType)
	}
	if file.Filename != "xtiitch-financial-2026-07-19.csv" {
		t.Fatalf("filename: %s", file.Filename)
	}
}

func TestExport_WindowClampedToPlanLookback(t *testing.T) {
	repo := &fakeReportsRepo{financial: seededFinancial()}
	service := newReportsService(repo, starterProfile, nil)
	if _, err := service.ExportFinancial(context.Background(), ownerExport("csv")); err != nil {
		t.Fatalf("ExportFinancial: %v", err)
	}
	wantFrom := reportsTestNow.AddDate(0, 0, -365)
	if repo.lastWindow.From == nil || !repo.lastWindow.From.Equal(wantFrom) {
		t.Fatalf("Starter export window must clamp to 365d: got %v", repo.lastWindow.From)
	}
}

func TestExport_CustomRangeStudioOnly(t *testing.T) {
	cmd := ownerExport("csv")
	cmd.From = "2026-01-01"
	growth := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, growthProfile, nil)
	if _, err := growth.ExportFinancial(context.Background(), cmd); err == nil {
		t.Fatal("Growth custom range must be refused (§14.1 Studio-only)")
	}
	studio := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, studioProfile, nil)
	if _, err := studio.ExportFinancial(context.Background(), cmd); err != nil {
		t.Fatalf("Studio custom range must pass, got %v", err)
	}
}

func TestExport_StaffRoleForbidden(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, studioProfile, nil)
	cmd := ownerExport("csv")
	cmd.ActorRole = business.UserRoleStaff
	if _, err := service.ExportFinancial(context.Background(), cmd); err == nil {
		t.Fatal("staff must be refused like the Money Desk")
	}
}
