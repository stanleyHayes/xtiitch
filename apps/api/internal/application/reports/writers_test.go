package reportsapp

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"strings"
	"testing"
	"time"
)

func sampleReport() Report {
	from := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	return Report{
		Kind:         KindFinancial,
		Title:        "Financial records",
		BusinessName: "Top Designers Hub",
		GeneratedAt:  time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC),
		WindowFrom:   &from,
		WindowTo:     time.Date(2026, 7, 19, 12, 0, 0, 0, time.UTC),
		Currency:     "GHS",
		Sections: []Section{
			{
				Name:    "Summary (in period)",
				Columns: []string{"Metric", "Amount (GHS)"},
				Rows:    [][]string{{"Through platform", "100.00"}, {"Paystack fee", "1.87"}},
			},
			{
				Name:    "Payments",
				Columns: []string{"Date", "Reference", "Amount (GHS)"},
				Rows:    [][]string{{"2026-07-01 10:00 UTC", "ref_123", "100.00"}},
			},
		},
	}
}

func TestRegistry_AllLaunchFormatsRegistered(t *testing.T) {
	registry := NewDefaultRegistry()
	want := []string{"csv", "docx", "pdf", "xlsx"}
	got := registry.Formats()
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("formats: got %v want %v", got, want)
	}
	if _, ok := registry.Get("json"); ok {
		t.Fatal("json must not be registered yet (§14.4: added later by registration)")
	}
}

func TestCSVWriter_ValidCSVWithSections(t *testing.T) {
	content, err := CSVWriter{}.Write(sampleReport())
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if len(content) == 0 {
		t.Fatal("empty csv")
	}
	reader := csv.NewReader(bytes.NewReader(content))
	reader.FieldsPerRecord = -1 // sections have different column counts
	rows, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("output is not valid csv: %v", err)
	}
	var sawSection, sawCell bool
	for _, row := range rows {
		if len(row) > 0 && row[0] == "# Payments" {
			sawSection = true
		}
		if len(row) > 1 && row[1] == "ref_123" {
			sawCell = true
		}
	}
	if !sawSection || !sawCell {
		t.Fatalf("csv missing section or data rows:\n%s", content)
	}
}

func TestPDFWriter_ValidPDFFile(t *testing.T) {
	content, err := PDFWriter{}.Write(sampleReport())
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if !bytes.HasPrefix(content, []byte("%PDF")) {
		t.Fatal("pdf output must start with %PDF header")
	}
	if len(content) < 500 {
		t.Fatalf("pdf suspiciously small: %d bytes", len(content))
	}
}

func TestXLSXWriter_ValidWorkbookZip(t *testing.T) {
	content, err := XLSXWriter{}.Write(sampleReport())
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	reader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("xlsx must be a valid zip: %v", err)
	}
	names := map[string]bool{}
	for _, file := range reader.File {
		names[file.Name] = true
	}
	for _, required := range []string{"[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"} {
		if !names[required] {
			t.Fatalf("xlsx missing %s (has %v)", required, names)
		}
	}
}

func TestDOCXWriter_ValidOOXMLZip(t *testing.T) {
	content, err := DOCXWriter{}.Write(sampleReport())
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	reader, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		t.Fatalf("docx must be a valid zip: %v", err)
	}
	var documentXML string
	for _, file := range reader.File {
		if file.Name == "word/document.xml" {
			part, _ := file.Open()
			buf := new(bytes.Buffer)
			_, _ = buf.ReadFrom(part)
			documentXML = buf.String()
			_ = part.Close()
		}
	}
	if documentXML == "" {
		t.Fatal("docx missing word/document.xml")
	}
	if !strings.Contains(documentXML, "Financial records") || !strings.Contains(documentXML, "ref_123") {
		t.Fatal("docx document.xml missing report content")
	}
}

func TestWriters_EmptyReportDoesNotPanic(t *testing.T) {
	empty := Report{Kind: KindSales, Title: "Sales report", GeneratedAt: time.Now()}
	for _, writer := range NewDefaultRegistry().Formats() {
		w, _ := NewDefaultRegistry().Get(writer)
		if _, err := w.Write(empty); err != nil {
			t.Fatalf("%s writer on empty report: %v", writer, err)
		}
	}
}
