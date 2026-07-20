package reportsapp

import (
	"bytes"
	"fmt"

	"github.com/jung-kurt/gofpdf"
)

// PDFWriter renders a clean, simple PDF (gofpdf — pure Go, no cgo): a title
// block, then one bordered table per section. Long cells are truncated to the
// column width and non-latin-1 glyphs are replaced (core PDF fonts are
// latin-1; money cells are plain "123.45" with (GHS) headers, so nothing
// meaningful is ever lost).
type PDFWriter struct{}

func (PDFWriter) Format() string      { return "pdf" }
func (PDFWriter) ContentType() string { return "application/pdf" }
func (PDFWriter) Ext() string         { return "pdf" }

func (PDFWriter) Write(report Report) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(10, 10, 10)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 14)
	pdf.Cell(0, 8, latin1(report.Title))
	pdf.Ln(9)
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(0, 5, latin1(fmt.Sprintf("%s — generated %s", report.BusinessName,
		report.GeneratedAt.UTC().Format("2006-01-02 15:04 UTC"))))
	pdf.Ln(5)
	window := "full history"
	if report.WindowFrom != nil {
		window = fmt.Sprintf("%s to %s", report.WindowFrom.UTC().Format("2006-01-02"),
			report.WindowTo.UTC().Format("2006-01-02"))
	}
	pdf.Cell(0, 5, latin1("Period: "+window))
	pdf.Ln(8)

	const usableWidthMM = 190.0
	for _, section := range report.Sections {
		pdf.SetFont("Arial", "B", 11)
		pdf.Cell(0, 6, latin1(section.Name))
		pdf.Ln(7)

		cols := len(section.Columns)
		if cols == 0 {
			continue
		}
		colWidth := usableWidthMM / float64(cols)
		maxChars := int(colWidth/1.15) - 1
		if maxChars < 4 {
			maxChars = 4
		}

		pdf.SetFont("Arial", "B", 7)
		pdf.SetFillColor(230, 230, 230)
		for _, column := range section.Columns {
			pdf.CellFormat(colWidth, 5, latin1(fit(column, maxChars)), "1", 0, "", true, 0, "")
		}
		pdf.Ln(-1)

		pdf.SetFont("Arial", "", 7)
		for _, row := range section.Rows {
			for i := 0; i < cols; i++ {
				cell := ""
				if i < len(row) {
					cell = row[i]
				}
				pdf.CellFormat(colWidth, 5, latin1(fit(cell, maxChars)), "1", 0, "", false, 0, "")
			}
			pdf.Ln(-1)
		}
		pdf.Ln(4)
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// fit truncates a cell to the column's character budget.
func fit(text string, maxChars int) string {
	runes := []rune(text)
	if len(runes) <= maxChars {
		return text
	}
	return string(runes[:maxChars-1]) + "…"
}

// latin1 maps anything the core PDF fonts cannot draw to '?'.
func latin1(text string) string {
	out := []rune(text)
	for i, r := range out {
		if r > 126 && (r < 160 || r > 255) {
			out[i] = '?'
		}
	}
	return string(out)
}
