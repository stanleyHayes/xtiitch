package affiliateauth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
)

type invitationRepositoryFake struct {
	input ports.CreatePartnerInvitationInput
}

func (repo *invitationRepositoryFake) CreatePartnerInvitation(_ context.Context, input ports.CreatePartnerInvitationInput) (ports.PartnerInvitationRecord, error) {
	repo.input = input
	return ports.PartnerInvitationRecord{InvitationID: input.InvitationID, InviteeEmail: input.InviteeEmail, InviteCode: input.InviteCode, CreatedAt: time.Now()}, nil
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
