package crmapp

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	reportsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/reports"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
)

// exportService builds a CRM service whose plan grants the given export_*
// booleans at the given crm_level.
func exportService(t *testing.T, level int, features map[string]bool, repo *fakeCRMRepo) Service {
	t.Helper()
	return NewService(Dependencies{
		CRM: repo,
		Settings: fakeSettings{profile: ports.StoreProfile{
			Name:              "IT Store",
			Entitlements:      features,
			EntitlementLimits: map[string]int{business.LimitCRMLevel: level},
		}},
		Writers: reportsapp.NewDefaultRegistry(),
		Clock:   fakeClock{now: testNow},
	})
}

func exportCmd(format string) ExportCommand {
	return ExportCommand{Scope: testScope, ActorRole: business.UserRoleOwner, Format: format}
}

func TestExportCustomersCSVEntitled(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	file, err := exportService(t, LevelFull, map[string]bool{business.FeatureExportCSV: true}, repo).
		ExportCustomers(context.Background(), exportCmd("csv"))
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if file.Filename != "xtiitch-customers-2026-07-19.csv" {
		t.Fatalf("filename: %q", file.Filename)
	}
	if file.ContentType != "text/csv; charset=utf-8" {
		t.Fatalf("content type: %q", file.ContentType)
	}
	body := string(file.Content)
	for _, want := range []string{"Ama", "0244000001", "750.00", "VIP", "Kofi"} {
		if !strings.Contains(body, want) {
			t.Fatalf("csv missing %q:\n%s", want, body)
		}
	}
	// The export reads the WHOLE list, not a page (Limit 0 convention).
	if repo.lastQuery.Limit != 0 {
		t.Fatalf("export must not page: %+v", repo.lastQuery)
	}
}

func TestExportCustomersFormatGates(t *testing.T) {
	// Growth default: export_csv only — pdf/docx/xlsx refuse (§15.1 Studio
	// any-format).
	growth := exportService(t, LevelFull, map[string]bool{business.FeatureExportCSV: true}, &fakeCRMRepo{list: twoCustomerList()})
	for _, format := range []string{"pdf", "docx", "xlsx"} {
		if _, err := growth.ExportCustomers(context.Background(), exportCmd(format)); !errors.Is(err, reportsapp.ErrExportNotEntitled) {
			t.Fatalf("%s without its boolean: %v", format, err)
		}
	}
	// Free: every boolean off → even CSV refuses (§14.4/§15.3 same matrix).
	free := exportService(t, LevelBasic, map[string]bool{}, &fakeCRMRepo{list: twoCustomerList()})
	if _, err := free.ExportCustomers(context.Background(), exportCmd("csv")); !errors.Is(err, reportsapp.ErrExportNotEntitled) {
		t.Fatalf("free csv: %v", err)
	}
	// Studio default: all formats on.
	studio := exportService(t, LevelAdvanced, map[string]bool{
		business.FeatureExportCSV:  true,
		business.FeatureExportPDF:  true,
		business.FeatureExportDOCX: true,
		business.FeatureExportXLSX: true,
	}, &fakeCRMRepo{list: twoCustomerList()})
	for _, format := range []string{"csv", "pdf", "docx", "xlsx"} {
		file, err := studio.ExportCustomers(context.Background(), exportCmd(format))
		if err != nil {
			t.Fatalf("%s: %v", format, err)
		}
		if len(file.Content) == 0 {
			t.Fatalf("%s: empty file", format)
		}
		if !strings.HasSuffix(file.Filename, "."+format) {
			t.Fatalf("%s filename: %q", format, file.Filename)
		}
	}
}

func TestExportCustomersUnknownFormatAndRole(t *testing.T) {
	service := exportService(t, LevelAdvanced, map[string]bool{business.FeatureExportCSV: true}, &fakeCRMRepo{})
	if _, err := service.ExportCustomers(context.Background(), exportCmd("yaml")); !errors.Is(err, reportsapp.ErrUnknownFormat) {
		t.Fatalf("unknown format: %v", err)
	}
	cmd := exportCmd("csv")
	cmd.ActorRole = business.UserRoleStaff
	if _, err := service.ExportCustomers(context.Background(), cmd); !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("staff: %v", err)
	}
}

// TestExportGateIgnoresCRMLevel documents the §15.3 rule that exportability is
// its OWN matrix capability: a custom matrix could pair crm_level 0 with
// export_csv on, and the export still carries the full column set (spend,
// counts, tags) — the export_* boolean is the only gate.
func TestExportGateIgnoresCRMLevel(t *testing.T) {
	repo := &fakeCRMRepo{list: twoCustomerList()}
	file, err := exportService(t, LevelBasic, map[string]bool{business.FeatureExportCSV: true}, repo).
		ExportCustomers(context.Background(), exportCmd("csv"))
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if !strings.Contains(string(file.Content), "750.00") || !strings.Contains(string(file.Content), "VIP") {
		t.Fatalf("entitled export carries the full columns regardless of crm_level:\n%s", file.Content)
	}
}
