// Package reportsapp implements §14.3/§14.4 reports & exports: downloadable
// files built from the same underlying metrics as the dashboards (§14.5 one
// data source), gated by the plan's export-format entitlements (§14.4, admin
// matrix) and produced through a PLUGGABLE writer registry — a new format is
// a new Writer registration, never a rework of the reports (§14.4).
package reportsapp

import (
	"sort"
	"time"
)

// Report is the format-agnostic document every writer renders. Cells are
// pre-formatted display strings (money already rendered in Currency), which
// keeps every writer dumb and every format visually identical in content.
type Report struct {
	Kind         string
	Title        string
	BusinessName string
	GeneratedAt  time.Time
	WindowFrom   *time.Time
	WindowTo     time.Time
	Currency     string
	Sections     []Section
}

type Section struct {
	Name    string
	Columns []string
	Rows    [][]string
}

// Writer renders a Report into one file format (§14.4 pluggable architecture).
type Writer interface {
	// Format is the query-string/format-selector value ("csv", "pdf", ...).
	Format() string
	ContentType() string
	// Ext is the filename extension without dot.
	Ext() string
	Write(report Report) ([]byte, error)
}

// Registry is the format table. Registering a writer here makes the format
// available platform-wide; which PLANS may use it stays a matrix setting
// (export_* booleans), checked by the service at export time.
type Registry struct {
	writers map[string]Writer
}

func NewRegistry(writers ...Writer) *Registry {
	registry := &Registry{writers: map[string]Writer{}}
	for _, writer := range writers {
		registry.writers[writer.Format()] = writer
	}
	return registry
}

func (r *Registry) Get(format string) (Writer, bool) {
	writer, ok := r.writers[format]
	return writer, ok
}

// Formats lists the registered format keys, sorted (for stable errors/docs).
func (r *Registry) Formats() []string {
	formats := make([]string, 0, len(r.writers))
	for format := range r.writers {
		formats = append(formats, format)
	}
	sort.Strings(formats)
	return formats
}

// NewDefaultRegistry registers the §14.4 launch formats: PDF, DOCX, CSV, XLSX.
func NewDefaultRegistry() *Registry {
	return NewRegistry(CSVWriter{}, PDFWriter{}, DOCXWriter{}, XLSXWriter{})
}
