package affiliateauth

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

func (s Service) InvitePartner(ctx context.Context, affiliateID common.ID, inviteeEmail string) (ports.PartnerInvitationRecord, error) {
	if affiliateID.IsZero() || s.invitations == nil || s.ids == nil || s.emails == nil || s.portalURL == "" {
		return ports.PartnerInvitationRecord{}, ErrInvalidInput
	}
	email, err := normalizeEmail(inviteeEmail)
	if err != nil {
		return ports.PartnerInvitationRecord{}, ErrInvalidInput
	}
	code := s.ids.NewID().String()
	record, err := s.invitations.CreatePartnerInvitation(ctx, ports.CreatePartnerInvitationInput{InvitationID: s.ids.NewID(), InviterAffiliateID: affiliateID, InviteCode: code, InviteeEmail: email})
	if errors.Is(err, ports.ErrNotFound) {
		return ports.PartnerInvitationRecord{}, ErrInvalidInput
	}
	if err != nil {
		return ports.PartnerInvitationRecord{}, err
	}
	inviteURL := s.portalURL + "/signup?invite=" + url.QueryEscape(code) + "&email=" + url.QueryEscape(email)
	err = s.emails.Send(ctx, ports.EmailMessage{To: email, Subject: "You are invited to join the Xtiitch Affiliate Program", Body: "You have been invited to become a Xtiitch affiliate. Create your own account and referral code here:\n\n" + inviteURL + "\n\nAffiliate invitations do not create commissions or downstream rewards.", ReplyTo: notification.ReplyToOperational})
	if err != nil {
		return ports.PartnerInvitationRecord{}, err
	}
	record.InviteeEmail = strings.ToLower(record.InviteeEmail)
	return record, nil
}
