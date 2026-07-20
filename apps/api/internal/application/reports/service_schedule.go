package reportsapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

// §14.1 scheduled reports: the owner configures ONE schedule (GET/PUT
// /v1/reports/schedule); the platform sweep (POST /v1/admin/reports/run-
// scheduled) generates and emails due ones. Entitlements are re-checked at
// generation time — a plan change must never leave a stale schedule running.

// GetSchedule returns the business's schedule config (ports.ErrNotFound when
// none was ever saved).
func (s Service) GetSchedule(ctx context.Context, scope common.TenantScope, role business.UserRole) (ports.ReportSchedule, error) {
	if _, err := s.authorizeReports(ctx, scope, role); err != nil {
		return ports.ReportSchedule{}, err
	}
	return s.reports.GetSchedule(ctx, scope)
}

type PutScheduleCommand struct {
	Scope      common.TenantScope
	ActorRole  business.UserRole
	ReportKind string
	Format     string
	Cadence    string
	Email      string
	Enabled    bool
}

// PutSchedule validates and stores the business's one schedule. Gating
// (§14.1/§14.5): scheduled_reports 0 → 403; 1 → monthly only; 2 → any
// cadence. The format must be a plan-entitled export format, and the 'full'
// suite needs full+ analytics — so a schedule can never promise a report the
// plan could not export by hand.
func (s Service) PutSchedule(ctx context.Context, cmd PutScheduleCommand) (ports.ReportSchedule, error) {
	profile, err := s.authorizeReports(ctx, cmd.Scope, cmd.ActorRole)
	if err != nil {
		return ports.ReportSchedule{}, err
	}

	switch cmd.ReportKind {
	case KindFinancial, KindSales, KindFull:
	default:
		return ports.ReportSchedule{}, ErrInvalidInput
	}
	switch cmd.Cadence {
	case CadenceDaily, CadenceWeekly, CadenceMonthly:
	default:
		return ports.ReportSchedule{}, ErrInvalidInput
	}
	email := strings.TrimSpace(cmd.Email)
	if len(email) < 3 || len(email) > 254 || !strings.Contains(email, "@") {
		return ports.ReportSchedule{}, ErrInvalidInput
	}

	level := scheduledReportsLevel(profile)
	if level < 1 {
		return ports.ReportSchedule{}, ErrScheduledReportsNotEntitled
	}
	if cmd.Cadence != CadenceMonthly && level < 2 {
		return ports.ReportSchedule{}, ErrScheduledReportsNotEntitled
	}
	if _, err := s.writerFor(profile, cmd.Format); err != nil {
		return ports.ReportSchedule{}, err
	}
	if cmd.ReportKind == KindFull {
		if analyticsLevel := analyticsapp.LevelOf(profile); analyticsLevel < analyticsapp.LevelFull {
			return ports.ReportSchedule{}, analyticsapp.NotEntitledError{
				Feature:       "full_report",
				RequiredLevel: analyticsapp.LevelFull,
				CurrentLevel:  analyticsLevel,
			}
		}
	}

	schedule := ports.ReportSchedule{
		BusinessID: cmd.Scope.BusinessID,
		ReportKind: cmd.ReportKind,
		Format:     cmd.Format,
		Cadence:    cmd.Cadence,
		Email:      email,
		Enabled:    cmd.Enabled,
	}
	if err := s.reports.UpsertSchedule(ctx, cmd.Scope, schedule); err != nil {
		return ports.ReportSchedule{}, err
	}
	return s.reports.GetSchedule(ctx, cmd.Scope)
}

// DueReportSchedules lists every schedule whose cadence has elapsed at `now`
// (internal use — the sweep and, later, the worker).
func (s Service) DueReportSchedules(ctx context.Context, now time.Time) ([]ports.ReportSchedule, error) {
	return s.reports.DueSchedules(ctx, now)
}

// GeneratedReport is one schedule's generated file plus its source document
// (kept for the plain-text email digest) and delivery address.
type GeneratedReport struct {
	Schedule ports.ReportSchedule
	Report   Report
	File     ExportedFile
}

// GenerateForSchedule builds the report file for one schedule, re-verifying
// the plan's entitlements LIVE (§14.5: the matrix is tunable; a stale grant
// must not run). Exported for the worker phase to call directly.
func (s Service) GenerateForSchedule(ctx context.Context, schedule ports.ReportSchedule) (GeneratedReport, error) {
	scope := common.TenantScope{BusinessID: schedule.BusinessID}
	profile, err := s.settings.GetProfile(ctx, scope)
	if err != nil {
		return GeneratedReport{}, err
	}

	// Re-check every gate the write path enforced, against the CURRENT plan.
	level := scheduledReportsLevel(profile)
	if level < 1 || (schedule.Cadence != CadenceMonthly && level < 2) {
		return GeneratedReport{}, ErrScheduledReportsNotEntitled
	}
	writer, err := s.writerFor(profile, schedule.Format)
	if err != nil {
		return GeneratedReport{}, err
	}
	if schedule.ReportKind == KindFull {
		if analyticsLevel := analyticsapp.LevelOf(profile); analyticsLevel < analyticsapp.LevelFull {
			return GeneratedReport{}, analyticsapp.NotEntitledError{
				Feature:       "full_report",
				RequiredLevel: analyticsapp.LevelFull,
				CurrentLevel:  analyticsLevel,
			}
		}
	}

	window, err := s.resolveExportWindow(profile, "", "")
	if err != nil {
		return GeneratedReport{}, err
	}

	var report Report
	switch schedule.ReportKind {
	case KindFinancial:
		report, err = s.buildFinancialReport(ctx, scope, profile.Name, window)
	case KindSales:
		var data ports.SalesReportData
		data, err = s.reports.SalesReport(ctx, scope, window)
		if err == nil {
			report = s.baseReport(KindSales, "Sales report", profile.Name, window)
			report.Sections = append(report.Sections, salesSection(data))
		}
	case KindFull:
		report, err = s.buildFullReport(ctx, scope, profile.Name, window)
	default:
		err = ErrInvalidInput
	}
	if err != nil {
		return GeneratedReport{}, err
	}
	file, err := s.render(report, writer)
	if err != nil {
		return GeneratedReport{}, err
	}
	return GeneratedReport{Schedule: schedule, Report: report, File: file}, nil
}

// RunSchedulesCommand is the admin sweep trigger.
type RunSchedulesCommand struct {
	ActorRole admindomain.Role
	Now       time.Time
}

// ScheduleRunItem reports what the sweep did with one due schedule.
type ScheduleRunItem struct {
	BusinessID common.ID
	ReportKind string
	Format     string
	Generated  bool
	Delivered  bool
	Detail     string
}

type RunSchedulesResult struct {
	Items []ScheduleRunItem
}

// RunDueSchedules is the platform sweep: generate every due schedule and
// deliver it. Delivery is API-side synchronous email (Resend) — the
// notification outbox has NO email channel (CHECK: whatsapp/sms) and the
// worker has no email sender, so queueing there would only dead-letter; when
// no sender is configured the run is still recorded (generation proven) and
// last_sent_at advances, exactly like the marketing waitlist's best-effort
// email. A schedule the plan no longer entitles is skipped, never silently
// run.
func (s Service) RunDueSchedules(ctx context.Context, cmd RunSchedulesCommand) (RunSchedulesResult, error) {
	if cmd.ActorRole != admindomain.RoleOwner && cmd.ActorRole != admindomain.RoleOperator {
		return RunSchedulesResult{}, authdomain.ErrForbidden
	}
	now := cmd.Now
	if now.IsZero() {
		now = s.clock.Now()
	}

	due, err := s.reports.DueSchedules(ctx, now)
	if err != nil {
		return RunSchedulesResult{}, err
	}

	result := RunSchedulesResult{Items: make([]ScheduleRunItem, 0, len(due))}
	for _, schedule := range due {
		item := ScheduleRunItem{
			BusinessID: schedule.BusinessID,
			ReportKind: schedule.ReportKind,
			Format:     schedule.Format,
		}
		generated, err := s.GenerateForSchedule(ctx, schedule)
		if err != nil {
			item.Detail = fmt.Sprintf("skipped: %v", err)
			result.Items = append(result.Items, item)
			continue
		}
		item.Generated = true

		if s.emails == nil {
			item.Detail = "generated; no email sender configured"
		} else if err := s.emails.Send(ctx, ports.EmailMessage{
			To:      schedule.Email,
			Subject: fmt.Sprintf("Xtiitch %s report — %s", schedule.ReportKind, now.UTC().Format("2006-01-02")),
			Body:    plainTextBody(generated),
			// §14.1 "delivered by email": the generated file itself is attached,
			// not just described — the body stays a short plain-text digest.
			Attachments: []ports.EmailAttachment{{
				Filename:    generated.File.Filename,
				ContentType: generated.File.ContentType,
				Content:     generated.File.Content,
			}},
		}); err != nil {
			item.Detail = fmt.Sprintf("generated; email failed: %v", err)
			result.Items = append(result.Items, item)
			// Not marked sent: a delivery failure retries next sweep.
			continue
		} else {
			item.Delivered = true
			item.Detail = "generated and emailed"
		}

		if err := s.reports.MarkScheduleSent(ctx, schedule.BusinessID, now); err != nil {
			item.Detail = fmt.Sprintf("generated; mark-sent failed: %v", err)
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

// plainTextBody renders the report as an inline plain-text digest beside the
// attached file (§14.1). Capped so a huge export never produces an unbounded
// email.
func plainTextBody(generated GeneratedReport) string {
	const maxLines = 200
	var b strings.Builder
	fmt.Fprintf(&b, "Your scheduled Xtiitch %s report (generated %s).\n",
		generated.Schedule.ReportKind, generated.Report.GeneratedAt.UTC().Format("2006-01-02 15:04 UTC"))
	fmt.Fprintf(&b, "File: %s (%s) — attached to this email.\n\n",
		generated.File.Filename, generated.File.ContentType)
	lines := 0
	for _, section := range generated.Report.Sections {
		if lines >= maxLines {
			b.WriteString("... (truncated — download the full file from your dashboard)\n")
			break
		}
		fmt.Fprintf(&b, "== %s ==\n", section.Name)
		lines++
		b.WriteString(strings.Join(section.Columns, " | ") + "\n")
		lines++
		for _, row := range section.Rows {
			if lines >= maxLines {
				break
			}
			b.WriteString(strings.Join(row, " | ") + "\n")
			lines++
		}
		b.WriteString("\n")
	}
	return b.String()
}
