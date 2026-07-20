package crmapp

import (
	"context"
	"fmt"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// ExportCommand is the §15.1 customer-list export request:
// GET /v1/crm/customers/export?format=csv|pdf|docx|xlsx.
type ExportCommand struct {
	Scope     common.TenantScope
	ActorRole business.UserRole
	Format    string
}

// ExportCustomers builds the §15.1 customer-list export (name, phone,
// whatsapp, orders count, total spend, last order, tags) through the SAME
// reports writer registry as §14.4 — a CRM CSV is byte-for-byte the reports
// CSV writer's output, and a new format registration lights up here too.
//
// The gate mirrors the reports module exactly (§15.3 launch default: "export
// starts at Growth — lining up with the report-export ladder in §14"): the
// format must be registered AND the plan must grant the matching export_*
// boolean in the admin matrix (export_csv Growth, the rest Studio), else 403
// export_not_entitled. The crm_level ladder does NOT apply inside the file:
// exportability is its own matrix capability, so an entitled export carries
// the full column set (spend, counts, tags) even on a custom matrix whose
// crm_level sits below the default for that plan.
func (s Service) ExportCustomers(ctx context.Context, cmd ExportCommand) (reportsapp.ExportedFile, error) {
	profile, err := s.authorize(ctx, cmd.Scope, cmd.ActorRole, LevelBasic, "export")
	if err != nil {
		return reportsapp.ExportedFile{}, err
	}
	writer, err := s.writerFor(profile, cmd.Format)
	if err != nil {
		return reportsapp.ExportedFile{}, err
	}

	// Limit 0 = the whole list (repository convention): an export is every
	// customer, not one page.
	list, err := s.crm.ListCustomers(ctx, cmd.Scope, ports.CRMCustomerQuery{Now: s.clock.Now()})
	if err != nil {
		return reportsapp.ExportedFile{}, err
	}

	report := reportsapp.Report{
		Kind:         "customers",
		Title:        "Customer list",
		BusinessName: profile.Name,
		GeneratedAt:  s.clock.Now(),
		WindowTo:     s.clock.Now(),
		Currency:     string(common.CurrencyGHS),
		Sections:     []reportsapp.Section{customersSection(list.Customers)},
	}
	content, err := writer.Write(report)
	if err != nil {
		return reportsapp.ExportedFile{}, err
	}
	return reportsapp.ExportedFile{
		Content:     content,
		ContentType: writer.ContentType(),
		Filename:    fmt.Sprintf("xtiitch-customers-%s.%s", s.clock.Now().UTC().Format("2006-01-02"), writer.Ext()),
	}, nil
}

// customersSection renders the §15.1 export column set. Money cells are
// major cedis (the header carries the currency), matching the reports
// convention.
func customersSection(customers []ports.CRMCustomerRow) reportsapp.Section {
	section := reportsapp.Section{
		Name: "Customers",
		Columns: []string{
			"Name", "Phone", "WhatsApp", "Orders", "Total spend (GHS)", "Last order", "Tags",
		},
	}
	for _, customer := range customers {
		lastOrder := ""
		if customer.LastOrderAt != nil {
			lastOrder = customer.LastOrderAt.UTC().Format("2006-01-02 15:04 UTC")
		}
		section.Rows = append(section.Rows, []string{
			customer.DisplayName,
			customer.Phone,
			customer.WhatsAppNumber,
			fmt.Sprintf("%d", customer.OrdersCount),
			fmt.Sprintf("%.2f", float64(customer.TotalSpendMinor)/100),
			lastOrder,
			strings.Join(customer.Tags, ", "),
		})
	}
	return section
}

// exportFeatureKey maps a format to its §14.4/§15.3 matrix boolean — the same
// mapping the reports module applies (kept in sync by the shared business
// constants).
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

// writerFor resolves the requested format against the shared registry and the
// plan's export entitlements. Free has every boolean off → 403 on all formats.
func (s Service) writerFor(profile ports.StoreProfile, format string) (reportsapp.Writer, error) {
	writer, ok := s.writers.Get(format)
	if !ok {
		return nil, reportsapp.ErrUnknownFormat
	}
	if !business.Entitlements(profile.Entitlements).Has(exportFeatureKey(format)) {
		return nil, reportsapp.ErrExportNotEntitled
	}
	return writer, nil
}
