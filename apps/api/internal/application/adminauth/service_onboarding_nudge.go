package adminauth

import (
	"context"
	"fmt"
	"html"
	"net/mail"
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
	verificationNudgeKind = "verification_nudge"
	// verificationNudgeAge is how long after registration we wait before the
	// follow-up email — long enough that a serious owner would have tried, short
	// enough that we still catch stalled signups.
	verificationNudgeAge        = 12 * time.Hour
	onboardingVerificationPath  = "/dashboard/settings#verification"
	onboardingPayoutsPath       = "/dashboard/settings#payouts"
	defaultBusinessDashboardURL = "https://app.xtiitch.com"
	verificationNudgeBatchLimit = 200
)

type RunVerificationNudgeSweepCommand struct {
	ActorUserID common.ID
	ActorRole   admindomain.Role
	Reason      string
	UserAgent   string
	IPAddress   string
}

// RunVerificationNudgeSweep emails unverified tenants that registered at least
// 12 hours ago and have not submitted Ghana Card details yet. Idempotent per
// business via business_onboarding_reminders.
func (s Service) RunVerificationNudgeSweep(
	ctx context.Context,
	cmd RunVerificationNudgeSweepCommand,
) (ports.AdminVerificationNudgeSweepRecord, error) {
	if cmd.ActorUserID.IsZero() {
		return ports.AdminVerificationNudgeSweepRecord{}, authdomain.ErrInvalidInput
	}
	if err := s.authorizePermission(ctx, cmd.ActorRole, admindomain.PermissionReviewBusinesses); err != nil {
		return ports.AdminVerificationNudgeSweepRecord{}, err
	}
	if s.businesses == nil {
		return ports.AdminVerificationNudgeSweepRecord{}, authdomain.ErrForbidden
	}

	reason := normalizeOperatorNote(cmd.Reason)
	if reason == "" {
		reason = "Scheduled verification onboarding nudge."
	}

	now := s.clock.Now()
	record := ports.AdminVerificationNudgeSweepRecord{RanAt: now}
	candidates, err := s.businesses.ListBusinessesForVerificationNudge(
		ctx,
		now.Add(-verificationNudgeAge),
		verificationNudgeKind,
		verificationNudgeBatchLimit,
	)
	if err != nil {
		return ports.AdminVerificationNudgeSweepRecord{}, err
	}
	record.Candidates = len(candidates)

	for _, candidate := range candidates {
		claimed, err := s.businesses.ClaimOnboardingReminder(ctx, candidate.BusinessID, verificationNudgeKind)
		if err != nil {
			record.EmailsFailed++
			continue
		}
		if !claimed {
			continue
		}
		sent, err := s.sendVerificationNudgeEmail(ctx, candidate)
		if err != nil || !sent {
			record.EmailsFailed++
			continue
		}
		record.EmailsSent++
	}

	severity := admindomain.AuditSeverityInfo
	if record.EmailsFailed > 0 {
		severity = admindomain.AuditSeverityWarning
	}
	if err := s.recordAudit(ctx, auditInput{
		ActorUserID: cmd.ActorUserID,
		ActorRole:   cmd.ActorRole,
		Action:      "Ran verification onboarding nudge sweep",
		TargetType:  "business",
		TargetID:    "verification_nudge_sweep",
		TargetLabel: "Verification onboarding nudges",
		Summary: "Verification nudge sweep emailed " + strconv.Itoa(record.EmailsSent) +
			" owners (" + strconv.Itoa(record.EmailsFailed) + " failures) from " +
			strconv.Itoa(record.Candidates) + " stalled unverified stores.",
		Severity: severity,
		Metadata: map[string]string{
			"candidates":    strconv.Itoa(record.Candidates),
			"emails_sent":   strconv.Itoa(record.EmailsSent),
			"emails_failed": strconv.Itoa(record.EmailsFailed),
			"reason":        reason,
		},
		UserAgent: cmd.UserAgent,
		IPAddress: cmd.IPAddress,
	}); err != nil {
		return ports.AdminVerificationNudgeSweepRecord{}, err
	}

	return record, nil
}

func (s Service) sendVerificationNudgeEmail(
	ctx context.Context,
	candidate ports.BusinessOnboardingNudgeCandidate,
) (bool, error) {
	if s.emails == nil {
		return false, nil
	}
	to := strings.TrimSpace(strings.ToLower(candidate.OwnerEmail))
	if _, err := mail.ParseAddress(to); err != nil {
		return false, nil
	}
	displayName := strings.TrimSpace(candidate.OwnerName)
	if displayName == "" {
		displayName = to
	}
	shop := strings.TrimSpace(candidate.BusinessName)
	if shop == "" {
		shop = "your store"
	}
	verifyURL := s.dashboardDeepLink(onboardingVerificationPath)
	payoutURL := s.dashboardDeepLink(onboardingPayoutsPath)

	subject := "Still need to verify " + shop + " on Xtiitch?"
	body := fmt.Sprintf(
		"Hi %s,\n\n"+
			"Quick check-in: %s registered on Xtiitch but Ghana Card verification is still outstanding.\n\n"+
			"Finish verification here: %s\n"+
			"After an admin approves you, add MoMo payout details: %s\n\n"+
			"Need a hand? Reply to this email — support@xtiitch.com will help you finish.\n\n"+
			"Thanks,\nXtiitch",
		displayName,
		shop,
		verifyURL,
		payoutURL,
	)
	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.5;">
  <p>Hi %s,</p>
  <p>Quick check-in: <strong>%s</strong> is still waiting on Ghana Card verification. Finish it so we can approve you and unlock payouts.</p>
  <p style="margin: 28px 0;">
    <a href="%s" style="display:inline-block;background:#6b1d2a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;">
      Verify your business
    </a>
  </p>
  <p style="color:#555;font-size:14px;">After approval, set payouts here: <a href="%s">%s</a></p>
  <p style="color:#555;font-size:14px;">Need help? Reply to this email — support@xtiitch.com will pick it up.</p>
  <p>Thanks,<br/>Xtiitch</p>
</body></html>`,
		html.EscapeString(displayName),
		html.EscapeString(shop),
		html.EscapeString(verifyURL),
		html.EscapeString(payoutURL),
		html.EscapeString(payoutURL),
	)

	if err := s.emails.Send(ctx, ports.EmailMessage{
		To:       to,
		Subject:  subject,
		Body:     body,
		HTMLBody: htmlBody,
		ReplyTo:  notification.ReplyToOperational,
	}); err != nil {
		return false, err
	}
	return true, nil
}

func (s Service) dashboardDeepLink(path string) string {
	base := strings.TrimRight(strings.TrimSpace(s.dashboardURL), "/")
	if base == "" {
		base = defaultBusinessDashboardURL
	}
	return base + path
}
