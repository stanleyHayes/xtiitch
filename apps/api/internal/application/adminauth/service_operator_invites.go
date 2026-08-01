package adminauth

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

// Operator invites: the invited person sets their own password from a one-time
// link, instead of an existing operator typing a temporary password and reading
// it out. That old flow put a working credential into a chat message or a phone
// call and left it valid until somebody remembered to change it.
//
// The token is minted here and only its HASH is stored, mirroring affiliate
// activation — a database read cannot mint access.
const (
	operatorInviteTTL = 48 * time.Hour
	// Long enough to type comfortably on a phone; the password rules are the
	// same ones the rest of the admin surface enforces.
	minOperatorPasswordLength = 8
)

type InviteOperatorCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Email       string
	DisplayName string
	// Phone is optional. When present and SMS is configured, the link is texted
	// as well — an email can sit unread for a day.
	Phone     string
	Role      admindomain.Role
	UserAgent string
	IPAddress string
}

// InviteOperator creates the operator inactive and without a password, then
// sends them a one-time link to set one.
func (s Service) InviteOperator(
	ctx context.Context,
	cmd InviteOperatorCommand,
) (ports.AdminUserRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageAdminUsers); err != nil {
		return ports.AdminUserRecord{}, err
	}

	email := strings.ToLower(strings.TrimSpace(cmd.Email))
	displayName := strings.TrimSpace(cmd.DisplayName)
	if email == "" || !strings.Contains(email, "@") || displayName == "" {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	if !cmd.Role.Valid() {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	token, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	now := s.clock.Now()

	user, err := s.users.CreateAdminUserInvite(ctx, ports.CreateAdminUserInviteInput{
		UserID:      s.ids.NewID(),
		InviteID:    s.ids.NewID(),
		Email:       email,
		DisplayName: displayName,
		Role:        cmd.Role,
		TokenHash:   s.refreshTokens.HashRefreshToken(token),
		SentToEmail: email,
		SentToPhone: strings.TrimSpace(cmd.Phone),
		InvitedBy:   cmd.ActorUserID,
		ExpiresAt:   now.Add(operatorInviteTTL),
		Now:         now,
	})
	if err != nil {
		return ports.AdminUserRecord{}, err
	}

	s.deliverOperatorInvite(ctx, user, strings.TrimSpace(cmd.Phone), token)

	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Invited an operator",
		TargetType:  "admin_user",
		TargetID:    user.UserID.String(),
		TargetLabel: user.Email,
		Summary:     "Sent a one-time link for " + user.Email + " to set their own password.",
		Severity:    admindomain.AuditSeverityInfo,
		UserAgent:   cmd.UserAgent,
		IPAddress:   cmd.IPAddress,
	}); err != nil {
		return ports.AdminUserRecord{}, err
	}
	return user, nil
}

// deliverOperatorInvite sends the link by email, and by SMS too when a number
// was given. Delivery failures do not fail the invite: the operator row and the
// token exist, and the link can be re-sent.
func (s Service) deliverOperatorInvite(
	ctx context.Context,
	user ports.AdminUserRecord,
	phone string,
	token string,
) {
	link := s.operatorInviteURL(token)
	if link == "" {
		return
	}
	if s.emails != nil {
		_ = s.emails.Send(ctx, ports.EmailMessage{
			To:      user.Email,
			Subject: "You have been invited to the Xtiitch operations console",
			Body: "Hi " + user.DisplayName + ",\n\n" +
				"You have been given " + string(user.Role) + " access to the Xtiitch operations console. " +
				"Set your password using the link below — it works once and expires in 48 hours:\n\n" +
				link + "\n\nIf you were not expecting this, ignore it and tell the Xtiitch team.\n",
			ReplyTo: notification.ReplyToOperational,
		})
	}
	if phone != "" && s.sms != nil {
		_ = s.sms.SendSMS(ctx, phone,
			"Xtiitch: you have been invited to the operations console. "+
				"Set your password (link expires in 48h): "+link)
	}
}

func (s Service) operatorInviteURL(token string) string {
	if s.adminConsoleURL == "" {
		return ""
	}
	return s.adminConsoleURL + "/accept-invite?token=" + url.QueryEscape(token)
}

// LookupOperatorInvite resolves a token so the accept page can greet the person
// by name and show which account it is for. Returns ErrInvalidInput for an
// unknown, expired or already-used token — the page must not distinguish them.
func (s Service) LookupOperatorInvite(
	ctx context.Context,
	token string,
) (ports.AdminUserInviteRecord, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return ports.AdminUserInviteRecord{}, authdomain.ErrInvalidInput
	}
	record, err := s.users.FindAdminUserInvite(
		ctx,
		s.refreshTokens.HashRefreshToken(token),
		s.clock.Now(),
	)
	if err != nil {
		return ports.AdminUserInviteRecord{}, authdomain.ErrInvalidInput
	}
	return record, nil
}

// AcceptOperatorInvite sets the password and activates the operator. Public: the
// bearer of the token is the authorisation, which is why the token is single-use
// and short-lived.
func (s Service) AcceptOperatorInvite(
	ctx context.Context,
	token string,
	password string,
) (ports.AdminUserRecord, error) {
	token = strings.TrimSpace(token)
	if token == "" || len([]rune(password)) < minOperatorPasswordLength {
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	passwordHash, err := s.passwords.Hash(password)
	if err != nil {
		return ports.AdminUserRecord{}, err
	}
	user, err := s.users.ConsumeAdminUserInvite(ctx, ports.ConsumeAdminUserInviteInput{
		TokenHash:    s.refreshTokens.HashRefreshToken(token),
		PasswordHash: passwordHash,
		Now:          s.clock.Now(),
	})
	if err != nil {
		// Consuming is atomic and filters on "not yet consumed", so a replayed
		// link lands here rather than resetting a password already in use.
		return ports.AdminUserRecord{}, authdomain.ErrInvalidInput
	}
	return user, nil
}
