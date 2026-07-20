package reportsapp

import (
	"context"
	"fmt"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// buildFullReport assembles the §14.1 complete suite in one document:
// financial + sales + customers + designs + orders, every section read from
// the same repositories the dashboards use (one data source, §14.5).
func (s Service) buildFullReport(ctx context.Context, scope common.TenantScope, businessName string, window ports.AnalyticsWindow) (Report, error) {
	financial, err := s.reports.FinancialReport(ctx, scope, window)
	if err != nil {
		return Report{}, err
	}
	sales, err := s.reports.SalesReport(ctx, scope, window)
	if err != nil {
		return Report{}, err
	}
	mix, err := s.analytics.CustomerMix(ctx, scope, window)
	if err != nil {
		return Report{}, err
	}
	topCustomers, err := s.analytics.TopCustomers(ctx, scope, window, 25)
	if err != nil {
		return Report{}, err
	}
	performance, err := s.analytics.DesignPerformance(ctx, scope)
	if err != nil {
		return Report{}, err
	}
	breakdowns, err := s.analytics.RevenueBreakdowns(ctx, scope, window)
	if err != nil {
		return Report{}, err
	}
	balances, err := s.analytics.OutstandingBalances(ctx, scope)
	if err != nil {
		return Report{}, err
	}

	report := s.baseReport(KindFull, "Full report suite", businessName, window)
	report.Sections = append(report.Sections, financialSections(financial)...)
	report.Sections = append(report.Sections, salesSection(sales))
	report.Sections = append(report.Sections, customersSections(mix, topCustomers)...)
	report.Sections = append(report.Sections,
		designPerformanceSection(performance),
		breakdownSection("Revenue by design", []string{"Design", "Orders", "Revenue (GHS)"}, designRows(breakdowns.ByDesign)),
		breakdownSection("Revenue by collection", []string{"Collection", "Orders", "Revenue (GHS)"}, collectionRows(breakdowns.ByCollection)),
		breakdownSection("Revenue by order type", []string{"Order type", "Orders", "Revenue (GHS)"}, flowRows(breakdowns.ByFlow)),
		breakdownSection("Revenue by fulfilment", []string{"Fulfilment", "Orders", "Revenue (GHS)"}, fulfilmentRows(breakdowns.ByFulfilment)),
		outstandingSection(balances),
	)
	return report, nil
}

func customersSections(mix ports.CustomerMix, top []ports.TopCustomer) []Section {
	repeatRate := 0.0
	if mix.WithOrdersInWindow > 0 {
		repeatRate = float64(mix.RepeatInWindow) / float64(mix.WithOrdersInWindow)
	}
	summary := Section{
		Name:    "Customers",
		Columns: []string{"Metric", "Value"},
		Rows: [][]string{
			{"New customers (in period)", fmt.Sprintf("%d", mix.NewInWindow)},
			{"Returning customers (in period)", fmt.Sprintf("%d", mix.ReturningInWindow)},
			{"Repeat rate (in period)", fmt.Sprintf("%.1f%%", repeatRate*100)},
		},
	}
	topSection := Section{
		Name:    "Top customers",
		Columns: []string{"Customer", "Phone", "Orders", "Spend (GHS)", "Last order"},
	}
	for _, row := range top {
		topSection.Rows = append(topSection.Rows, []string{
			row.DisplayName, row.Phone, fmt.Sprintf("%d", row.Orders),
			ghs(row.SpendMinor), row.LastOrderAt.UTC().Format("2006-01-02"),
		})
	}
	return []Section{summary, topSection}
}

func designPerformanceSection(performance []ports.DesignPerformance) Section {
	section := Section{
		Name:    "Design performance",
		Columns: []string{"Design", "Views", "Orders", "View→order conversion", "Waiting list"},
	}
	for _, row := range performance {
		section.Rows = append(section.Rows, []string{
			row.Title, fmt.Sprintf("%d", row.Views), fmt.Sprintf("%d", row.Orders),
			fmt.Sprintf("%.1f%%", row.ConversionRate*100), fmt.Sprintf("%d", row.WaitingList),
		})
	}
	return section
}

func breakdownSection(name string, columns []string, rows [][]string) Section {
	return Section{Name: name, Columns: columns, Rows: rows}
}

func designRows(rows []ports.DesignRevenue) [][]string {
	var out [][]string
	for _, row := range rows {
		out = append(out, []string{row.Title, fmt.Sprintf("%d", row.Orders), ghs(row.RevenueMinor)})
	}
	return out
}

func collectionRows(rows []ports.CollectionRevenue) [][]string {
	var out [][]string
	for _, row := range rows {
		name := row.Name
		if row.CollectionID == nil {
			name = "(no collection)"
		}
		out = append(out, []string{name, fmt.Sprintf("%d", row.Orders), ghs(row.RevenueMinor)})
	}
	return out
}

func flowRows(rows []ports.FlowRevenue) [][]string {
	var out [][]string
	for _, row := range rows {
		flow := row.Flow
		if flow == "ready_made" {
			flow = "standard"
		}
		out = append(out, []string{flow, fmt.Sprintf("%d", row.Orders), ghs(row.RevenueMinor)})
	}
	return out
}

func fulfilmentRows(rows []ports.FulfilmentRevenue) [][]string {
	var out [][]string
	for _, row := range rows {
		method := row.Method
		if method == "" {
			method = "(not specified)"
		}
		out = append(out, []string{method, fmt.Sprintf("%d", row.Orders), ghs(row.RevenueMinor)})
	}
	return out
}

func outstandingSection(balances []ports.OutstandingBalance) Section {
	section := Section{
		Name:    "Outstanding balances (bespoke)",
		Columns: []string{"Order", "Customer", "Design", "Status", "Agreed (GHS)", "Settled (GHS)", "Outstanding (GHS)"},
	}
	for _, row := range balances {
		section.Rows = append(section.Rows, []string{
			row.OrderID.String(), row.CustomerName, row.DesignTitle, row.Status,
			ghs(row.AgreedTotalMinor), ghs(row.SettledMinor), ghs(row.OutstandingMinor),
		})
	}
	return section
}
