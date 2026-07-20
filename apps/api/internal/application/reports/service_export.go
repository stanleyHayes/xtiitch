package reportsapp

import (
	"context"

	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ExportedFile is one generated report download.
type ExportedFile struct {
	Content     []byte
	ContentType string
	Filename    string
}

// ExportCommand is the owner export request: /v1/reports/<kind>?format&from&to.
type ExportCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Format    string
	From      string
	To        string
}

// ExportFinancial builds the §14.3 financial-records export from the SAME
// persisted Paystack figures as the Money Desk — a downloaded record always
// matches what Paystack actually paid.
func (s Service) ExportFinancial(ctx context.Context, cmd ExportCommand) (ExportedFile, error) {
	profile, writer, window, err := s.authorizeExport(ctx, cmd, KindFinancial)
	if err != nil {
		return ExportedFile{}, err
	}
	report, err := s.buildFinancialReport(ctx, cmd.Scope, profile.Name, window)
	if err != nil {
		return ExportedFile{}, err
	}
	return s.render(report, writer)
}

// ExportSales builds the §14.1 sales report (orders with status, design,
// customer, amounts).
func (s Service) ExportSales(ctx context.Context, cmd ExportCommand) (ExportedFile, error) {
	profile, writer, window, err := s.authorizeExport(ctx, cmd, KindSales)
	if err != nil {
		return ExportedFile{}, err
	}
	data, err := s.reports.SalesReport(ctx, cmd.Scope, window)
	if err != nil {
		return ExportedFile{}, err
	}
	report := s.baseReport(KindSales, "Sales report", profile.Name, window)
	report.Sections = append(report.Sections, salesSection(data))
	return s.render(report, writer)
}

// ExportFull is the §14.1 complete suite in one file (full+ analytics level):
// financial + sales + customers + designs + orders sections.
func (s Service) ExportFull(ctx context.Context, cmd ExportCommand) (ExportedFile, error) {
	profile, writer, window, err := s.authorizeExport(ctx, cmd, KindFull)
	if err != nil {
		return ExportedFile{}, err
	}
	report, err := s.buildFullReport(ctx, cmd.Scope, profile.Name, window)
	if err != nil {
		return ExportedFile{}, err
	}
	return s.render(report, writer)
}

// authorizeExport runs the shared export gates: role, format registry +
// format entitlement, the full-suite analytics level, and the export window.
func (s Service) authorizeExport(ctx context.Context, cmd ExportCommand, kind string) (ports.StoreProfile, Writer, ports.AnalyticsWindow, error) {
	profile, err := s.authorizeReports(ctx, cmd.Scope, cmd.ActorRole)
	if err != nil {
		return ports.StoreProfile{}, nil, ports.AnalyticsWindow{}, err
	}
	writer, err := s.writerFor(profile, cmd.Format)
	if err != nil {
		return ports.StoreProfile{}, nil, ports.AnalyticsWindow{}, err
	}
	if kind == KindFull {
		if level := analyticsapp.LevelOf(profile); level < analyticsapp.LevelFull {
			return ports.StoreProfile{}, nil, ports.AnalyticsWindow{}, analyticsapp.NotEntitledError{
				Feature:       "full_report",
				RequiredLevel: analyticsapp.LevelFull,
				CurrentLevel:  level,
			}
		}
	}
	window, err := s.resolveExportWindow(profile, cmd.From, cmd.To)
	if err != nil {
		return ports.StoreProfile{}, nil, ports.AnalyticsWindow{}, err
	}
	return profile, writer, window, nil
}

func (s Service) render(report Report, writer Writer) (ExportedFile, error) {
	content, err := writer.Write(report)
	if err != nil {
		return ExportedFile{}, err
	}
	return ExportedFile{
		Content:     content,
		ContentType: writer.ContentType(),
		Filename:    filename(report.Kind, writer, s.clock.Now()),
	}, nil
}

func (s Service) baseReport(kind, title, businessName string, window ports.AnalyticsWindow) Report {
	return Report{
		Kind:         kind,
		Title:        title,
		BusinessName: businessName,
		GeneratedAt:  s.clock.Now(),
		WindowFrom:   window.From,
		WindowTo:     window.To,
		Currency:     string(common.CurrencyGHS),
	}
}

// buildFinancialReport assembles the §14.3 financial dataset: summary totals +
// payments + settlements + manual takings. The summary mirrors the Money Desk
// cards (same persisted-figure formula) filtered to the export window.
func (s Service) buildFinancialReport(ctx context.Context, scope common.TenantScope, businessName string, window ports.AnalyticsWindow) (Report, error) {
	data, err := s.reports.FinancialReport(ctx, scope, window)
	if err != nil {
		return Report{}, err
	}
	report := s.baseReport(KindFinancial, "Financial records", businessName, window)
	report.Sections = financialSections(data)
	return report, nil
}

// financialSections renders the financial dataset as report sections. Shared
// by the financial export and the full suite (one data source, §14.5).
func financialSections(data ports.FinancialReportData) []Section {
	// The Money Desk's derived cards (§3.1), from persisted figures only:
	// all-time = store share + manual takings − accrued offline commission;
	// net (due for payout) = all-time − settled payouts.
	xtiitchFee := data.Totals.CommissionMinor - data.Totals.XtiitchTaxMinor
	allTime := data.Totals.StoreShareMinor + data.Totals.ManualTakingsMinor - data.Totals.OfflineCommissionDueMinor
	net := allTime - data.Totals.SettledPayoutsMinor

	summary := Section{
		Name:    "Summary (in period)",
		Columns: []string{"Metric", "Amount (GHS)"},
		Rows: [][]string{
			{"Through platform", ghs(data.Totals.ThroughPlatformMinor)},
			{"Xtiitch fee", ghs(xtiitchFee)},
			{"Xtiitch tax", ghs(data.Totals.XtiitchTaxMinor)},
			{"Paystack fee", ghs(data.Totals.PaystackFeeMinor)},
			{"Store share", ghs(data.Totals.StoreShareMinor)},
			{"Settled payouts", ghs(data.Totals.SettledPayoutsMinor)},
			{"Manual takings", ghs(data.Totals.ManualTakingsMinor)},
			{"Offline commission due", ghs(data.Totals.OfflineCommissionDueMinor)},
			{"All-time income (in period)", ghs(allTime)},
			{"Net income (in period)", ghs(net)},
		},
	}

	payments := Section{
		Name: "Payments",
		Columns: []string{
			"Date", "Reference", "Purpose", "Method", "Status",
			"Amount (GHS)", "Xtiitch fee+tax (GHS)", "of which tax (GHS)",
			"Paystack fee (GHS)", "Store share (GHS)",
		},
	}
	for _, row := range data.Payments {
		payments.Rows = append(payments.Rows, []string{
			reportTimestamp(row.CreatedAt), row.ProviderReference, row.Purpose, row.Method, row.Status,
			ghs(row.AmountMinor), ghs(row.CommissionMinor), ghs(row.XtiitchTaxMinor),
			ghs(row.ProviderFeeMinor), ghs(row.StoreShareMinor),
		})
	}

	settlements := Section{
		Name:    "Settlements (payouts)",
		Columns: []string{"Date", "Reference", "Status", "Settled at", "Amount (GHS)"},
	}
	for _, row := range data.Settlements {
		settlements.Rows = append(settlements.Rows, []string{
			reportTimestamp(row.CreatedAt), row.ProviderReference, row.Status,
			optionalTimestamp(row.SettledAt), ghs(row.AmountMinor),
		})
	}

	takings := Section{
		Name:    "Manual takings",
		Columns: []string{"Date", "What for", "Method", "Amount (GHS)", "Commission (GHS)", "Commission status"},
	}
	for _, row := range data.Takings {
		takings.Rows = append(takings.Rows, []string{
			reportTimestamp(row.TakenAt), row.WhatFor, row.Method,
			ghs(row.AmountMinor), ghs(row.CommissionMinor), row.CommissionStatus,
		})
	}

	return []Section{summary, payments, settlements, takings}
}

func salesSection(data ports.SalesReportData) Section {
	orders := Section{
		Name: "Orders",
		Columns: []string{
			"Date", "Order", "Status", "Flow", "Design", "Customer",
			"Fulfilment", "Agreed (GHS)", "Settled (GHS)", "Outstanding (GHS)",
		},
	}
	for _, row := range data.Orders {
		agreed := ""
		outstanding := ""
		if row.AgreedTotalMinor != nil {
			agreed = ghs(*row.AgreedTotalMinor)
			outstanding = ghs(*row.AgreedTotalMinor - row.SettledMinor)
		}
		orders.Rows = append(orders.Rows, []string{
			reportTimestamp(row.CreatedAt), row.OrderID.String(), row.Status, row.Flow,
			row.DesignTitle, row.CustomerName, row.DeliveryMethod,
			agreed, ghs(row.SettledMinor), outstanding,
		})
	}
	return orders
}
