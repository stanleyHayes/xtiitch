package reportsapp

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

// XLSXWriter renders a real .xlsx workbook (excelize — pure Go): a "Report"
// metadata sheet, then one sheet per section named after it. Header rows are
// bold; every cell is written as a string so money renders exactly as
// formatted (no float rounding surprises).
type XLSXWriter struct{}

func (XLSXWriter) Format() string { return "xlsx" }
func (XLSXWriter) ContentType() string {
	return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}
func (XLSXWriter) Ext() string { return "xlsx" }

//nolint:gocognit,gocyclo // serializes the report's optional sections in their stable export order
func (XLSXWriter) Write(report Report) ([]byte, error) {
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()

	headerStyle, err := file.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	if err != nil {
		return nil, err
	}

	metaSheet := "Report"
	defaultSheet := file.GetSheetName(0)
	if err := file.SetSheetName(defaultSheet, metaSheet); err != nil {
		return nil, err
	}
	metaRows := [][2]string{
		{"Report", report.Title},
		{"Business", report.BusinessName},
		{"Generated at", report.GeneratedAt.UTC().Format("2006-01-02 15:04 UTC")},
	}
	if report.WindowFrom != nil {
		metaRows = append(metaRows, [2]string{"From", report.WindowFrom.UTC().Format("2006-01-02")})
	}
	metaRows = append(metaRows, [2]string{"To", report.WindowTo.UTC().Format("2006-01-02")})
	for row, pair := range metaRows {
		cell, _ := excelize.CoordinatesToCellName(1, row+1)
		if err := file.SetCellValue(metaSheet, cell, pair[0]+": "+pair[1]); err != nil {
			return nil, err
		}
	}

	usedNames := map[string]bool{metaSheet: true}
	for i, section := range report.Sections {
		sheet := sheetName(section.Name, i, usedNames)
		if _, err := file.NewSheet(sheet); err != nil {
			return nil, err
		}
		for col, column := range section.Columns {
			cell, _ := excelize.CoordinatesToCellName(col+1, 1)
			if err := file.SetCellValue(sheet, cell, column); err != nil {
				return nil, err
			}
		}
		if len(section.Columns) > 0 {
			start, _ := excelize.CoordinatesToCellName(1, 1)
			end, _ := excelize.CoordinatesToCellName(len(section.Columns), 1)
			if err := file.SetCellStyle(sheet, start, end, headerStyle); err != nil {
				return nil, err
			}
		}
		for rowIdx, row := range section.Rows {
			for colIdx, cell := range row {
				name, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
				if err := file.SetCellValue(sheet, name, cell); err != nil {
					return nil, err
				}
			}
		}
	}

	var buf bytes.Buffer
	if err := file.Write(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// sheetName makes a valid, unique Excel sheet name (≤31 chars, no []:*?/\).
func sheetName(raw string, index int, used map[string]bool) string {
	name := strings.Map(func(r rune) rune {
		switch r {
		case '[', ']', ':', '*', '?', '/', '\\':
			return ' '
		}
		return r
	}, strings.TrimSpace(raw))
	if name == "" {
		name = fmt.Sprintf("Section %d", index+1)
	}
	runes := []rune(name)
	if len(runes) > 31 {
		name = string(runes[:31])
	}
	candidate := name
	for suffix := 2; used[candidate]; suffix++ {
		candidate = fmt.Sprintf("%s (%d)", name, suffix)
		if crunes := []rune(candidate); len(crunes) > 31 {
			candidate = string(crunes[:31])
		}
	}
	used[candidate] = true
	return candidate
}
