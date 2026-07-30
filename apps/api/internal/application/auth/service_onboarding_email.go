package authapp

import (
	"context"
	"fmt"
	"html"
	"strings"

	"github.com/xcreativs/xtiitch/apps/api/internal/application/ports"
	"github.com/xcreativs/xtiitch/apps/api/internal/domain/notification"
)

const (
	onboardingVerificationPath = "/dashboard/settings#verification"
	onboardingPayoutsPath      = "/dashboard/settings#payouts"
)

// sendRegistrationWelcomeEmail is the post-signup nudge from noreply@: finish
// Ghana Card verification (and then payouts once approved). Best-effort — a
// Resend outage must never roll back a successful registration.
func (s Service) sendRegistrationWelcomeEmail(
	ctx context.Context,
	ownerEmail string,
	ownerName string,
	businessName string,
) {
	if s.emails == nil {
		return
	}
	to, err := normalizeEmail(ownerEmail)
	if err != nil {
		return
	}
	displayName := strings.TrimSpace(ownerName)
	if displayName == "" {
		displayName = to
	}
	shop := strings.TrimSpace(businessName)
	if shop == "" {
		shop = "your store"
	}
	verifyURL := s.dashboardDeepLink(onboardingVerificationPath)
	payoutURL := s.dashboardDeepLink(onboardingPayoutsPath)

	subject := "Finish verifying " + shop + " on Xtiitch"
	body := fmt.Sprintf(
		"Hi %s,\n\n"+
			"Welcome to Xtiitch — %s is ready for the next step.\n\n"+
			"1. Verify your business with your Ghana Card (name + front/back photos).\n"+
			"2. After an admin approves you, add your MoMo payout details so customer payments can settle to you.\n\n"+
			"Verify now: %s\n"+
			"Payout setup (after approval): %s\n\n"+
			"Need a hand? Reply to this email — support@xtiitch.com will pick it up.\n\n"+
			"Thanks,\nXtiitch",
		displayName,
		shop,
		verifyURL,
		payoutURL,
	)
	htmlBody := onboardingEmailHTML(displayName, shop, verifyURL, payoutURL, false)

	if err := s.emails.Send(ctx, ports.EmailMessage{
		To:       to,
		Subject:  subject,
		Body:     body,
		HTMLBody: htmlBody,
		ReplyTo:  notification.ReplyToOperational,
	}); err != nil {
		s.logger.Warn("registration welcome email failed",
			"email", to,
			"error", err.Error(),
		)
	}
}

func (s Service) dashboardDeepLink(path string) string {
	base := s.dashboardURL
	if base == "" {
		base = "https://app.xtiitch.com"
	}
	return strings.TrimRight(base, "/") + path
}

func onboardingEmailHTML(displayName, shop, verifyURL, payoutURL string, isNudge bool) string {
	intro := fmt.Sprintf(
		"Welcome to Xtiitch — <strong>%s</strong> is ready for the next step.",
		html.EscapeString(shop),
	)
	if isNudge {
		intro = fmt.Sprintf(
			"Quick check-in: <strong>%s</strong> is still waiting on Ghana Card verification. "+
				"Finish it so we can approve you and unlock payouts.",
			html.EscapeString(shop),
		)
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.5;">
  <p>Hi %s,</p>
  <p>%s</p>
  <ol>
    <li>Submit your Ghana Card (full legal name + front and back photos).</li>
    <li>Once an admin approves you, add your MoMo payout number under Settings → Payouts.</li>
  </ol>
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
		intro,
		html.EscapeString(verifyURL),
		html.EscapeString(payoutURL),
		html.EscapeString(payoutURL),
	)
}
