package reportsapp

import (
	"bytes"
	"encoding/csv"
	"fmt"
)

// CSVWriter renders the report as RFC 4180 CSV (stdlib only). Multi-section
// reports are laid out sequentially with a "# <section>" marker row before
// each section's header — the shape the existing admin CSV exports use.
type CSVWriter struct{}

func (CSVWriter) Format() string      { return "csv" }
func (CSVWriter) ContentType() string { return "text/csv; charset=utf-8" }
func (CSVWriter) Ext() string         { return "csv" }

func (CSVWriter) Write(report Report) ([]byte, error) {
	var buf bytes.Buffer
	out := csv.NewWriter(&buf)

	meta := [][2]string{
		{"report", report.Title},
		{"business", report.BusinessName},
		{"generated_at", report.GeneratedAt.UTC().Format("2006-01-02 15:04 UTC")},
	}
	if report.WindowFrom != nil {
		meta = append(meta, [2]string{"from", report.WindowFrom.UTC().Format("2006-01-02")})
	}
	meta = append(meta, [2]string{"to", report.WindowTo.UTC().Format("2006-01-02")})
	for _, pair := range meta {
		if err := out.Write([]string{"# " + pair[0], pair[1]}); err != nil {
			return nil, err
		}
	}

	for _, section := range report.Sections {
		if err := out.Write([]string{}); err != nil {
			return nil, err
		}
		if err := out.Write([]string{fmt.Sprintf("# %s", section.Name)}); err != nil {
			return nil, err
		}
		if err := out.Write(section.Columns); err != nil {
			return nil, err
		}
		for _, row := range section.Rows {
			if err := out.Write(row); err != nil {
				return nil, err
			}
		}
	}

	out.Flush()
	if err := out.Error(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
