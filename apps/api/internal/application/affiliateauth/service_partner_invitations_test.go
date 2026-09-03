package affiliateauth

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type invitationRepositoryFake struct {
	input  ports.CreatePartnerInvitationInput
	record *ports.PartnerInvitationRecord
	err    error
}

func (repo *invitationRepositoryFake) CreatePartnerInvitation(_ context.Context, input ports.CreatePartnerInvitationInput) (ports.PartnerInvitationRecord, error) {
	repo.input = input
	if repo.err != nil {
		return ports.PartnerInvitationRecord{}, repo.err
	}
	if repo.record != nil {
		return *repo.record, nil
	}
	return ports.PartnerInvitationRecord{InvitationID: input.InvitationID, InviteeEmail: input.InviteeEmail, InviteCode: input.InviteCode, CreatedAt: time.Now()}, nil
}

func TestInvitePartnerMapsExistingAccountWithoutCallingEmail(t *testing.T) {
	repo := &invitationRepositoryFake{err: ports.ErrAffiliateEmailTaken}
	emails := &invitationEmailFake{}
	service := Service{invitations: repo, emails: emails, ids: &invitationIDs{values: []common.ID{"invite-code", "invitation-id"}}, portalURL: "https://affiliate.xtiitch.com"}
	_, err := service.InvitePartner(context.Background(), "affiliate-id", "joined@example.com")
	if !errors.Is(err, ErrInviteeAlreadyAffiliate) {
		t.Fatalf("expected existing Affiliate error, got %v", err)
	}
	if emails.message.To != "" {
		t.Fatalf("existing Affiliate must not receive a signup invitation: %+v", emails.message)
	}
}

type invitationEmailFake struct{ message ports.EmailMessage }

func (sender *invitationEmailFake) Send(_ context.Context, message ports.EmailMessage) error {
	sender.message = message
	return nil
}

type invitationIDs struct{ values []common.ID }

func (ids *invitationIDs) NewID() common.ID {
	value := ids.values[0]
	ids.values = ids.values[1:]
	return value
}

func TestInvitePartnerPersistsAndEmailsAffiliateSignupLink(t *testing.T) {
	repo := &invitationRepositoryFake{}
	emails := &invitationEmailFake{}
	service := Service{invitations: repo, emails: emails, ids: &invitationIDs{values: []common.ID{"invite-code", "invitation-id"}}, portalURL: "https://affiliate.xtiitch.com"}
	record, err := service.InvitePartner(context.Background(), "affiliate-id", " FRIEND@Example.com ")
	if err != nil {
		t.Fatal(err)
	}
	if record.InviteeEmail != "friend@example.com" || repo.input.InviterAffiliateID != "affiliate-id" {
		t.Fatalf("unexpected invitation: %+v input=%+v", record, repo.input)
	}
	if emails.message.To != "friend@example.com" || !strings.Contains(emails.message.Body, "https://affiliate.xtiitch.com/signup?invite=invite-code&email=friend%40example.com") || !strings.Contains(emails.message.Body, "do not create commissions") {
		t.Fatalf("unexpected invitation email: %+v", emails.message)
	}
}

func TestInvitePartnerResendEmailsPersistedPendingInviteCode(t *testing.T) {
	repo := &invitationRepositoryFake{record: &ports.PartnerInvitationRecord{
		InvitationID: "existing-invitation", InviteeEmail: "friend@example.com",
		InviteCode: "existing-pending-code", CreatedAt: time.Now(),
	}}
	emails := &invitationEmailFake{}
	service := Service{
		invitations: repo, emails: emails,
		ids:       &invitationIDs{values: []common.ID{"unused-new-code", "unused-new-invitation-id"}},
		portalURL: "https://affiliate.xtiitch.com",
	}

	_, err := service.InvitePartner(context.Background(), "affiliate-id", "friend@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(emails.message.Body, "invite=existing-pending-code") {
		t.Fatalf("resend must email the persisted pending code: %+v", emails.message)
	}
	if strings.Contains(emails.message.Body, "unused-new-code") {
		t.Fatalf("resend emailed an unstored replacement code: %+v", emails.message)
	}
}
