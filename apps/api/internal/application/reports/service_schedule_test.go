package reportsapp

import (
	"context"
	"errors"
	"strings"
	"testing"

	analyticsapp "github.com/xcreativs/xtiitch/apps/api/internal/application/analytics"
	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/business"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

func putCmd(profile string) PutScheduleCommand {
	cmd := PutScheduleCommand{
		Scope:      common.TenantScope{BusinessID: "biz-1"},
		ActorRole:  business.UserRoleOwner,
		ReportKind: KindFinancial,
		Format:     "csv",
		Cadence:    CadenceMonthly,
		Email:      "owner@example.com",
		Enabled:    true,
	}
	return cmd
}

// --- schedule CRUD + gating (§14.1: Growth monthly, Studio any cadence) ---

func TestPutSchedule_OffPlanForbidden(t *testing.T) {
	// Free AND Starter have scheduled_reports = 0 (§14.1 launch defaults).
	for _, profile := range []ports.StoreProfile{freeProfile, starterProfile} {
		service := newReportsService(&fakeReportsRepo{}, profile, nil)
		_, err := service.PutSchedule(context.Background(), putCmd(""))
		if !errors.Is(err, ErrScheduledReportsNotEntitled) {
			t.Fatalf("scheduled_reports=0: want ErrScheduledReportsNotEntitled, got %v", err)
		}
	}
}

func TestPutSchedule_GrowthMonthlyOnly(t *testing.T) {
	repo := &fakeReportsRepo{}
	service := newReportsService(repo, growthProfile, nil)

	if _, err := service.PutSchedule(context.Background(), putCmd("")); err != nil {
		t.Fatalf("Growth monthly must pass, got %v", err)
	}
	if repo.upserted.Cadence != CadenceMonthly || repo.upserted.Email != "owner@example.com" {
		t.Fatalf("upserted: %+v", repo.upserted)
	}

	weekly := putCmd("")
	weekly.Cadence = CadenceWeekly
	if _, err := service.PutSchedule(context.Background(), weekly); !errors.Is(err, ErrScheduledReportsNotEntitled) {
		t.Fatalf("Growth weekly: want ErrScheduledReportsNotEntitled, got %v", err)
	}
}

func TestPutSchedule_StudioAnyCadence(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, studioProfile, nil)
	for _, cadence := range []string{CadenceDaily, CadenceWeekly, CadenceMonthly} {
		cmd := putCmd("")
		cmd.Cadence = cadence
		if _, err := service.PutSchedule(context.Background(), cmd); err != nil {
			t.Fatalf("Studio %s must pass, got %v", cadence, err)
		}
	}
}

func TestPutSchedule_FormatMustBeEntitled(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, growthProfile, nil)
	cmd := putCmd("")
	cmd.Format = "docx" // Growth has csv+pdf only (§14.4)
	if _, err := service.PutSchedule(context.Background(), cmd); !errors.Is(err, ErrExportNotEntitled) {
		t.Fatalf("want ErrExportNotEntitled, got %v", err)
	}
}

func TestPutSchedule_FullKindRequiresFullAnalytics(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, growthProfile, nil)
	cmd := putCmd("")
	cmd.ReportKind = KindFull
	if _, err := service.PutSchedule(context.Background(), cmd); err != nil {
		t.Fatalf("Growth (full analytics) full suite must pass, got %v", err)
	}

	// A plan with scheduled_reports but only standard analytics cannot
	// schedule the full suite.
	oddProfile := planProfile(1, 365, 2, "csv")
	service = newReportsService(&fakeReportsRepo{}, oddProfile, nil)
	_, err := service.PutSchedule(context.Background(), cmd)
	if !errors.Is(err, analyticsapp.ErrAnalyticsNotEntitled) {
		t.Fatalf("want ErrAnalyticsNotEntitled, got %v", err)
	}
}

func TestPutSchedule_Validation(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, studioProfile, nil)
	for _, mutate := range []func(*PutScheduleCommand){
		func(c *PutScheduleCommand) { c.ReportKind = "quarterly" },
		func(c *PutScheduleCommand) { c.Cadence = "hourly" },
		func(c *PutScheduleCommand) { c.Format = "json" },
		func(c *PutScheduleCommand) { c.Email = "not-an-email" },
	} {
		cmd := putCmd("")
		mutate(&cmd)
		if _, err := service.PutSchedule(context.Background(), cmd); err == nil {
			t.Fatalf("invalid command must be rejected: %+v", cmd)
		}
	}
}

func TestGetSchedule_PassesThroughNotFound(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{scheduleErr: ports.ErrNotFound}, growthProfile, nil)
	_, err := service.GetSchedule(context.Background(), common.TenantScope{BusinessID: "biz-1"}, business.UserRoleOwner)
	if !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

// --- generation re-gating + the sweep ---

type failingEmailSender struct{}

func (failingEmailSender) Send(context.Context, ports.EmailMessage) error {
	return errors.New("resend unavailable")
}

func studioSchedule(businessID string) ports.ReportSchedule {
	return ports.ReportSchedule{
		BusinessID: common.ID(businessID),
		ReportKind: KindFinancial,
		Format:     "csv",
		Cadence:    CadenceMonthly,
		Email:      "owner@example.com",
		Enabled:    true,
	}
}

func TestGenerateForSchedule_RechecksEntitlementsLive(t *testing.T) {
	// The schedule was written on Studio, but the plan has since dropped to
	// Starter (scheduled_reports = 0): generation must refuse, never run stale.
	service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, starterProfile, nil)
	_, err := service.GenerateForSchedule(context.Background(), studioSchedule("biz-1"))
	if !errors.Is(err, ErrScheduledReportsNotEntitled) {
		t.Fatalf("want ErrScheduledReportsNotEntitled, got %v", err)
	}
}

func TestGenerateForSchedule_BuildsEntitledFile(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, studioProfile, nil)
	generated, err := service.GenerateForSchedule(context.Background(), studioSchedule("biz-1"))
	if err != nil {
		t.Fatalf("GenerateForSchedule: %v", err)
	}
	if len(generated.File.Content) == 0 || generated.File.Filename != "xtiitch-financial-2026-07-19.csv" {
		t.Fatalf("file: %+v", generated.File)
	}
}

func TestRunDueSchedules_RoleGate(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{}, studioProfile, nil)
	_, err := service.RunDueSchedules(context.Background(), RunSchedulesCommand{
		ActorRole: admindomain.RoleSupport,
		Now:       reportsTestNow,
	})
	if !errors.Is(err, authdomain.ErrForbidden) {
		t.Fatalf("support role must not run the sweep, got %v", err)
	}
}

func TestRunDueSchedules_GeneratesDeliversAndMarksSent(t *testing.T) {
	repo := &fakeReportsRepo{
		financial: seededFinancial(),
		due:       []ports.ReportSchedule{studioSchedule("biz-1")},
	}
	emails := &fakeEmailSender{}
	service := newReportsService(repo, studioProfile, emails)

	result, err := service.RunDueSchedules(context.Background(), RunSchedulesCommand{
		ActorRole: admindomain.RoleOperator,
		Now:       reportsTestNow,
	})
	if err != nil {
		t.Fatalf("RunDueSchedules: %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("items: %+v", result.Items)
	}
	item := result.Items[0]
	if !item.Generated || !item.Delivered {
		t.Fatalf("item: %+v", item)
	}
	if len(emails.sent) != 1 || emails.sent[0].To != "owner@example.com" {
		t.Fatalf("emails: %+v", emails.sent)
	}
	if len(emails.sent[0].Body) == 0 {
		t.Fatal("email body must carry the report digest")
	}
	// §14.1 "delivered by email": the generated FILE rides as an attachment,
	// not only a digest.
	if len(emails.sent[0].Attachments) != 1 {
		t.Fatalf("expected the report file attached, got %+v", emails.sent[0].Attachments)
	}
	attachment := emails.sent[0].Attachments[0]
	if attachment.Filename != "xtiitch-financial-2026-07-19.csv" ||
		!strings.HasPrefix(attachment.ContentType, "text/csv") ||
		len(attachment.Content) == 0 {
		t.Fatalf("unexpected attachment: %+v", attachment)
	}
	if _, ok := repo.markedSent["biz-1"]; !ok {
		t.Fatal("delivered schedule must be marked sent")
	}
}

// A failed send must NOT mark the schedule sent — the next sweep retries the
// delivery instead of the report silently going missing.
func TestRunDueSchedules_EmailFailureNotMarkedSent(t *testing.T) {
	repo := &fakeReportsRepo{
		financial: seededFinancial(),
		due:       []ports.ReportSchedule{studioSchedule("biz-1")},
	}
	service := newReportsService(repo, studioProfile, &failingEmailSender{})

	result, err := service.RunDueSchedules(context.Background(), RunSchedulesCommand{
		ActorRole: admindomain.RoleOperator,
		Now:       reportsTestNow,
	})
	if err != nil {
		t.Fatalf("RunDueSchedules: %v", err)
	}
	item := result.Items[0]
	if !item.Generated || item.Delivered {
		t.Fatalf("failed-delivery item: %+v", item)
	}
	if len(repo.markedSent) != 0 {
		t.Fatal("a schedule whose email failed must not be marked sent")
	}
}

func TestRunDueSchedules_UnentitledPlanSkippedNotMarked(t *testing.T) {
	// Due schedule, but the business's plan no longer entitles scheduled
	// reports (service fixture resolves starterProfile for every scope).
	repo := &fakeReportsRepo{
		financial: seededFinancial(),
		due:       []ports.ReportSchedule{studioSchedule("biz-1")},
	}
	emails := &fakeEmailSender{}
	service := newReportsService(repo, starterProfile, emails)

	result, err := service.RunDueSchedules(context.Background(), RunSchedulesCommand{
		ActorRole: admindomain.RoleOperator,
		Now:       reportsTestNow,
	})
	if err != nil {
		t.Fatalf("RunDueSchedules: %v", err)
	}
	if result.Items[0].Generated {
		t.Fatal("unentitled schedule must be skipped, not generated")
	}
	if len(emails.sent) != 0 {
		t.Fatal("no email may leave for a skipped schedule")
	}
	if len(repo.markedSent) != 0 {
		t.Fatal("skipped schedule must not be marked sent")
	}
}

func TestRunDueSchedules_NoSenderStillRecordsRun(t *testing.T) {
	repo := &fakeReportsRepo{
		financial: seededFinancial(),
		due:       []ports.ReportSchedule{studioSchedule("biz-1")},
	}
	service := newReportsService(repo, studioProfile, nil)

	result, err := service.RunDueSchedules(context.Background(), RunSchedulesCommand{
		ActorRole: admindomain.RoleOwner,
		Now:       reportsTestNow,
	})
	if err != nil {
		t.Fatalf("RunDueSchedules: %v", err)
	}
	item := result.Items[0]
	if !item.Generated || item.Delivered {
		t.Fatalf("no-sender item: %+v", item)
	}
	if _, ok := repo.markedSent["biz-1"]; !ok {
		t.Fatal("generated run must advance last_sent_at even without a sender")
	}
}

func TestPlainTextBody_RendersDigest(t *testing.T) {
	service := newReportsService(&fakeReportsRepo{financial: seededFinancial()}, studioProfile, nil)
	generated, err := service.GenerateForSchedule(context.Background(), studioSchedule("biz-1"))
	if err != nil {
		t.Fatalf("GenerateForSchedule: %v", err)
	}
	body := plainTextBody(generated)
	for _, want := range []string{"financial", "xtiitch-financial-2026-07-19.csv", "Payments", "ref_1"} {
		if !strings.Contains(body, want) {
			t.Fatalf("digest missing %q:\n%s", want, body)
		}
	}
}
