package adminauth

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	admindomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/admin"
	authdomain "github.com/xcreativs/xtiitch/apps/api/internal/domain/auth"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/common"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

const (
	affiliateActivationTTL = 48 * time.Hour
	affiliatePortalURL     = "https://affiliate.xtiitch.com"
)

type ListAffiliateApplicationsCommand struct {
	ActorRole admindomain.Role
}

type DecideAffiliateApplicationCommand struct {
	ActorUserID                common.ID
	ActorRole                  admindomain.Role
	ApplicationID              common.ID
	Decision                   string
	ReviewNote                 string
	PurchaseCommissionBPS      int
	FirstPaidPlanCommissionBPS int
	CookieWindowDays           int
	PayoutMode                 string
	UserAgent                  string
	IPAddress                  string
}

func (s Service) ListAffiliateApplications(
	ctx context.Context,
	cmd ListAffiliateApplicationsCommand,
) ([]ports.AdminAffiliateApplicationRecord, error) {
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return nil, err
	}
	if s.businesses == nil {
		return nil, authdomain.ErrForbidden
	}
	return s.businesses.ListAdminAffiliateApplications(ctx)
}

func (s Service) DecideAffiliateApplication(
	ctx context.Context,
	cmd DecideAffiliateApplicationCommand,
) (ports.AdminAffiliateApplicationRecord, error) {
	if cmd.ActorUserID.IsZero() || cmd.ApplicationID.IsZero() {
		return ports.AdminAffiliateApplicationRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionManageGrowth); err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminAffiliateApplicationRecord{}, authdomain.ErrForbidden
	}

	input, activationToken, err := s.normalizeAffiliateApplicationDecision(cmd)
	if err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}
	record, err := s.businesses.DecideAdminAffiliateApplication(ctx, input)
	if err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}

	action := "Rejected affiliate application"
	severity := admindomain.AuditSeverityWarning
	if input.Decision == "approved" {
		action = "Approved affiliate application"
		severity = admindomain.AuditSeverityInfo
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      action,
		TargetType:  "affiliate_application",
		TargetID:    record.ApplicationID.String(),
		TargetLabel: record.DisplayName,
		Summary:     action + " for " + record.RequestedCode + ".",
		Severity:    severity,
		Metadata: map[string]string{
			"decision":                       input.Decision,
			"requested_code":                 record.RequestedCode,
			"purchase_commission_bps":        strconv.Itoa(input.PurchaseCommissionBPS),
			"first_paid_plan_commission_bps": strconv.Itoa(input.FirstPaidPlanCommissionBPS),
			"review_note":                    input.ReviewNote,
		},
		IPAddress: cmd.IPAddress,
		UserAgent: cmd.UserAgent,
	}); err != nil {
		return ports.AdminAffiliateApplicationRecord{}, err
	}

	s.sendAffiliateDecisionEmail(ctx, record, activationToken)
	return record, nil
}

func (s Service) normalizeAffiliateApplicationDecision(
	cmd DecideAffiliateApplicationCommand,
) (ports.DecideAdminAffiliateApplicationInput, string, error) {
	decision := strings.ToLower(strings.TrimSpace(cmd.Decision))
	if decision != "approved" && decision != "rejected" {
		return ports.DecideAdminAffiliateApplicationInput{}, "", authdomain.ErrInvalidInput
	}
	reviewNote := normalizeOperatorNote(cmd.ReviewNote)
	if decision == "rejected" && reviewNote == "" {
		return ports.DecideAdminAffiliateApplicationInput{}, "", authdomain.ErrInvalidInput
	}

	input := ports.DecideAdminAffiliateApplicationInput{
		ApplicationID:  cmd.ApplicationID,
		Decision:       decision,
		ReviewNote:     reviewNote,
		ActorAdminUser: cmd.ActorUserID,
	}
	if decision == "rejected" {
		return input, "", nil
	}
	if s.ids == nil || s.refreshTokens == nil || s.clock == nil {
		return ports.DecideAdminAffiliateApplicationInput{}, "", authdomain.ErrForbidden
	}
	if cmd.PurchaseCommissionBPS < 1 || cmd.PurchaseCommissionBPS > 10000 ||
		cmd.FirstPaidPlanCommissionBPS < 0 || cmd.FirstPaidPlanCommissionBPS > 10000 {
		return ports.DecideAdminAffiliateApplicationInput{}, "", authdomain.ErrInvalidInput
	}
	cookieWindow := cmd.CookieWindowDays
	if cookieWindow == 0 {
		cookieWindow = 30
	}
	if cookieWindow < 1 || cookieWindow > 365 {
		return ports.DecideAdminAffiliateApplicationInput{}, "", authdomain.ErrInvalidInput
	}
	payoutMode := strings.ToLower(strings.TrimSpace(cmd.PayoutMode))
	if payoutMode == "" {
		payoutMode = "manual"
	}
	if payoutMode != "manual" && payoutMode != "voucher" &&
		payoutMode != "paystack_transfer" && payoutMode != "paystack_split" {
		return ports.DecideAdminAffiliateApplicationInput{}, "", authdomain.ErrInvalidInput
	}

	activationToken, err := s.refreshTokens.NewRefreshToken()
	if err != nil {
		return ports.DecideAdminAffiliateApplicationInput{}, "", err
	}
	input.PurchaseCommissionBPS = cmd.PurchaseCommissionBPS
	input.FirstPaidPlanCommissionBPS = cmd.FirstPaidPlanCommissionBPS
	input.CookieWindowDays = cookieWindow
	input.PayoutMode = payoutMode
	input.AffiliateID = s.ids.NewID()
	input.AffiliateAccountID = s.ids.NewID()
	input.ActivationTokenID = s.ids.NewID()
	input.ActivationTokenHash = s.refreshTokens.HashRefreshToken(activationToken)
	input.ActivationTokenExpiresAt = s.clock.Now().Add(affiliateActivationTTL)
	return input, activationToken, nil
}

func (s Service) sendAffiliateDecisionEmail(
	ctx context.Context,
	record ports.AdminAffiliateApplicationRecord,
	activationToken string,
) {
	if s.emails == nil || strings.TrimSpace(record.Email) == "" {
		return
	}
	if record.Status == "rejected" {
		body := "Hi " + record.ContactName + ",\n\nWe could not approve your Xtiitch affiliate application"
		if record.ReviewNote != "" {
			body += ".\n\nReview note: " + record.ReviewNote
		}
		_ = s.emails.Send(ctx, ports.EmailMessage{
			To:      record.Email,
			Subject: "Update on your Xtiitch affiliate application",
			Body:    body,
			ReplyTo: notification.ReplyToOperational,
		})
		return
	}
	if activationToken == "" {
		return
	}
	activationURL := affiliatePortalURL + "/activate?token=" + url.QueryEscape(activationToken)
	_ = s.emails.Send(ctx, ports.EmailMessage{
		To:      record.Email,
		Subject: "Your Xtiitch affiliate application is approved",
		Body: "Hi " + record.ContactName + ",\n\nYour affiliate code " +
			record.RequestedCode + " has been approved. Activate your private dashboard within 48 hours:\n" +
			activationURL + "\n\nFor security, do not share this activation link.",
		ReplyTo: notification.ReplyToOperational,
	})
}
