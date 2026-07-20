package reportsapp

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
)

// DOCXWriter renders a minimal, valid OOXML word-processing document with the
// stdlib alone (a .docx is a zip; tabular reports need only paragraphs and
// bordered tables). No styles part — Word/LibreOffice render defaults.
type DOCXWriter struct{}

func (DOCXWriter) Format() string { return "docx" }
func (DOCXWriter) ContentType() string {
	return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
func (DOCXWriter) Ext() string { return "docx" }

const docxContentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const docxRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

func (DOCXWriter) Write(report Report) ([]byte, error) {
	var document bytes.Buffer
	document.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	document.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>`)

	writeDocxParagraph(&document, report.Title, true)
	subtitle := fmt.Sprintf("%s — generated %s", report.BusinessName,
		report.GeneratedAt.UTC().Format("2006-01-02 15:04 UTC"))
	if report.WindowFrom != nil {
		subtitle += fmt.Sprintf(" — period %s to %s", report.WindowFrom.UTC().Format("2006-01-02"),
			report.WindowTo.UTC().Format("2006-01-02"))
	}
	writeDocxParagraph(&document, subtitle, false)

	for _, section := range report.Sections {
		writeDocxParagraph(&document, "", false)
		writeDocxParagraph(&document, section.Name, true)
		document.WriteString(`<w:tbl><w:tblPr><w:tblBorders>`)
		for _, edge := range []string{"top", "left", "bottom", "right", "insideH", "insideV"} {
			document.WriteString(`<w:` + edge + ` w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
		}
		document.WriteString(`</w:tblBorders></w:tblPr>`)
		writeDocxRow(&document, section.Columns, true)
		for _, row := range section.Rows {
			writeDocxRow(&document, row, false)
		}
		document.WriteString(`</w:tbl>`)
	}

	document.WriteString(`<w:sectPr/></w:body></w:document>`)

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)
	for name, content := range map[string]string{
		"[Content_Types].xml": docxContentTypes,
		"_rels/.rels":         docxRels,
		"word/document.xml":   document.String(),
	} {
		part, err := zipWriter.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := part.Write([]byte(content)); err != nil {
			return nil, err
		}
	}
	if err := zipWriter.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func writeDocxParagraph(buf *bytes.Buffer, text string, bold bool) {
	buf.WriteString(`<w:p><w:r>`)
	if bold {
		buf.WriteString(`<w:rPr><w:b/></w:rPr>`)
	}
	buf.WriteString(`<w:t xml:space="preserve">`)
	_ = xml.EscapeText(buf, []byte(text))
	buf.WriteString(`</w:t></w:r></w:p>`)
}

func writeDocxRow(buf *bytes.Buffer, cells []string, header bool) {
	buf.WriteString(`<w:tr>`)
	for _, cell := range cells {
		buf.WriteString(`<w:tc><w:p><w:r>`)
		if header {
			buf.WriteString(`<w:rPr><w:b/></w:rPr>`)
		}
		buf.WriteString(`<w:t xml:space="preserve">`)
		_ = xml.EscapeText(buf, []byte(cell))
		buf.WriteString(`</w:t></w:r></w:p></w:tc>`)
	}
	buf.WriteString(`</w:tr>`)
}
