package marketingwaitlist

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type fakeWaitlistRepo struct {
	created   ports.CreateWaitlistLeadInput
	createErr error
	listLimit int
	leads     []ports.WaitlistLeadRecord
}

func (r *fakeWaitlistRepo) CreateWaitlistLead(_ context.Context, input ports.CreateWaitlistLeadInput) (ports.WaitlistLeadRecord, error) {
	r.created = input
	if r.createErr != nil {
		return ports.WaitlistLeadRecord{}, r.createErr
	}
	return ports.WaitlistLeadRecord{
		LeadID:    input.LeadID,
		Name:      input.Name,
		Business:  input.Business,
		Phone:     input.Phone,
		Email:     input.Email,
		City:      input.City,
		Message:   input.Message,
		Source:    input.Source,
		UserAgent: input.UserAgent,
		CreatedAt: time.Date(2026, 6, 22, 12, 0, 0, 0, time.UTC),
	}, nil
}

func (r *fakeWaitlistRepo) ListWaitlistLeads(_ context.Context, limit int) ([]ports.WaitlistLeadRecord, error) {
	r.listLimit = limit
	return r.leads, nil
}

type fakeEmailSender struct {
	message ports.EmailMessage
	sent    bool
	err     error
}

func (s *fakeEmailSender) Send(_ context.Context, message ports.EmailMessage) error {
	s.sent = true
	s.message = message
	return s.err
}

type staticIDs struct{ id common.ID }

func (s staticIDs) NewID() common.ID { return s.id }

func newTestService(repo ports.MarketingWaitlistRepository, emails ports.EmailSender, emailTo string) Service {
	return NewService(Dependencies{
		Repo:    repo,
		Emails:  emails,
		IDs:     staticIDs{id: common.ID("lead-1")},
		EmailTo: emailTo,
	})
}

func validCommand() SubmitCommand {
	return SubmitCommand{
		Name:      "Ama Mensah",
		Business:  "Ama Couture",
		Phone:     "0241234567",
		Email:     "ama@example.com",
		City:      "Accra",
		Message:   "Excited to join!",
		Source:    "homepage",
		UserAgent: "Mozilla/5.0",
	}
}

func TestSubmitStoresLeadAndEmailsTeam(t *testing.T) {
	repo := &fakeWaitlistRepo{}
	emails := &fakeEmailSender{}
	service := newTestService(repo, emails, "team@xtiitch.com")

	lead, err := service.Submit(context.Background(), validCommand())
	if err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}
	if repo.created.LeadID != common.ID("lead-1") {
		t.Fatalf("expected generated lead id, got %q", repo.created.LeadID)
	}
	if repo.created.Name != "Ama Mensah" || repo.created.Business != "Ama Couture" {
		t.Fatalf("unexpected stored lead: %+v", repo.created)
	}
	if repo.created.Email != "ama@example.com" {
		t.Fatalf("expected normalized email, got %q", repo.created.Email)
	}
	if lead.LeadID != common.ID("lead-1") {
		t.Fatalf("returned lead id mismatch: %q", lead.LeadID)
	}
	if !emails.sent {
		t.Fatal("expected the team email to be sent")
	}
	if emails.message.To != "team@xtiitch.com" {
		t.Fatalf("email sent to wrong address: %q", emails.message.To)
	}
	if emails.message.Subject != "New Xtiitch waitlist lead" {
		t.Fatalf("unexpected subject: %q", emails.message.Subject)
	}
}

func TestSubmitSkipsEmailWhenRecipientMissing(t *testing.T) {
	repo := &fakeWaitlistRepo{}
	emails := &fakeEmailSender{}
	service := newTestService(repo, emails, "")

	if _, err := service.Submit(context.Background(), validCommand()); err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}
	if emails.sent {
		t.Fatal("email must not be sent without a configured recipient")
	}
}

func TestSubmitSkipsEmailWhenSenderNil(t *testing.T) {
	repo := &fakeWaitlistRepo{}
	service := newTestService(repo, nil, "team@xtiitch.com")

	if _, err := service.Submit(context.Background(), validCommand()); err != nil {
		t.Fatalf("Submit must succeed with no email sender: %v", err)
	}
	if repo.created.Name == "" {
		t.Fatal("lead should still be stored")
	}
}

func TestSubmitEmailFailureDoesNotFailRequest(t *testing.T) {
	repo := &fakeWaitlistRepo{}
	emails := &fakeEmailSender{err: errors.New("resend down")}
	service := newTestService(repo, emails, "team@xtiitch.com")

	if _, err := service.Submit(context.Background(), validCommand()); err != nil {
		t.Fatalf("a failed email must not fail the request: %v", err)
	}
	if repo.created.Name == "" {
		t.Fatal("lead should still be stored despite email failure")
	}
}

func TestSubmitValidationRejectsMissingRequiredFields(t *testing.T) {
	cases := map[string]SubmitCommand{
		"missing name":     {Business: "B", Phone: "024"},
		"missing business": {Name: "N", Phone: "024"},
		"missing phone":    {Name: "N", Business: "B"},
		"bad email":        {Name: "N", Business: "B", Phone: "024", Email: "not-an-email"},
	}
	for name, cmd := range cases {
		t.Run(name, func(t *testing.T) {
			repo := &fakeWaitlistRepo{}
			service := newTestService(repo, &fakeEmailSender{}, "team@xtiitch.com")
			_, err := service.Submit(context.Background(), cmd)
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("expected ErrInvalidInput, got %v", err)
			}
			if repo.created.Name != "" {
				t.Fatal("invalid submission must not be stored")
			}
		})
	}
}

func TestSubmitAcceptsOptionalEmptyEmailAndCity(t *testing.T) {
	repo := &fakeWaitlistRepo{}
	service := newTestService(repo, &fakeEmailSender{}, "")
	cmd := SubmitCommand{Name: "N", Business: "B", Phone: "024"}

	if _, err := service.Submit(context.Background(), cmd); err != nil {
		t.Fatalf("submission without email/city should be valid: %v", err)
	}
	if repo.created.Email != "" || repo.created.City != "" {
		t.Fatalf("expected empty optional fields, got email=%q city=%q", repo.created.Email, repo.created.City)
	}
}

func TestListLeadsClampsLimit(t *testing.T) {
	repo := &fakeWaitlistRepo{}
	service := newTestService(repo, nil, "")

	if _, err := service.ListLeads(context.Background(), 0); err != nil {
		t.Fatalf("ListLeads error: %v", err)
	}
	if repo.listLimit != defaultLimit {
		t.Fatalf("expected clamp to %d, got %d", defaultLimit, repo.listLimit)
	}

	if _, err := service.ListLeads(context.Background(), 100000); err != nil {
		t.Fatalf("ListLeads error: %v", err)
	}
	if repo.listLimit != defaultLimit {
		t.Fatalf("expected clamp to %d, got %d", defaultLimit, repo.listLimit)
	}

	if _, err := service.ListLeads(context.Background(), 25); err != nil {
		t.Fatalf("ListLeads error: %v", err)
	}
	if repo.listLimit != 25 {
		t.Fatalf("expected limit 25, got %d", repo.listLimit)
	}
}
