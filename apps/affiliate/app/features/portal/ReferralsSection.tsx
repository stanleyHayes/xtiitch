import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import { FormStatus } from "./FormStatus";
import type { Dashboard, PartnerReferral, PortalActionResult } from "./types";

const labels = {
  active: "Active",
  inactive: "Inactive",
  not_activated: "Not Activated",
} as const;

export function ReferralsSection({
  referrals,
  dashboard,
	result,
}: {
  referrals: PartnerReferral[];
  dashboard: Dashboard;
	result?: PortalActionResult;
}) {
  return (
    <div className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Direct business referrals</p>
          <h1>My referrals</h1>
          <p className="muted">
            Privacy-safe status only. Business owner and payment details are never shown.
          </p>
        </div>
      </div>
      <section className="stat-row" aria-label="Referral status totals">
        <article className="stat"><span className="stat-label">Total</span><strong className="stat-value">{referrals.length}</strong></article>
        <article className="stat"><span className="stat-label">Active</span><strong className="stat-value">{dashboard.active_referrals}</strong></article>
        <article className="stat"><span className="stat-label">Inactive</span><strong className="stat-value">{dashboard.inactive_referrals}</strong></article>
        <article className="stat"><span className="stat-label">Not Activated</span><strong className="stat-value">{dashboard.not_activated_referrals}</strong></article>
      </section>
      <section className="card">
        {referrals.length === 0 ? (
          <div className="empty-state"><p className="empty-title">No referred businesses yet</p><p className="muted">Share your Affiliate link to get started.</p></div>
        ) : (
          <div className="list">
            {referrals.map((referral) => (
              <article className="list-row" key={referral.handle}>
                <div className="list-main"><strong>@{referral.handle}</strong></div>
                <span className={`pill ${referral.status === "active" ? "pill-positive" : referral.status === "inactive" ? "pill-neutral" : "pill-pending"}`}>
                  {labels[referral.status]}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
		<section className="card">
			<div className="card-head">
				<div><h2>Invite affiliates</h2><p className="muted">Invite someone by email to create their own affiliate account. Invitations never create downstream commission.</p></div>
			</div>
			<InviteAffiliateForm result={result} />
			<p className="field-hint">{dashboard.partners_invited} invitation{dashboard.partners_invited === 1 ? "" : "s"} accepted.</p>
		</section>
    </div>
  );
}

function InviteAffiliateForm({ result }: { result?: PortalActionResult }) {
	const navigation = useNavigation();
	const formRef = useRef<HTMLFormElement>(null);
	const [copied, setCopied] = useState(false);
	const submitting = navigation.state === "submitting" && navigation.formData?.get("intent") === "invite";
	const invitationSent = result?.intent === "invite" && Boolean(result.success);

	useEffect(() => {
		if (invitationSent) {
			formRef.current?.reset();
		}
	}, [invitationSent, result]);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timer);
	}, [copied]);

	const copyInvitationLink = async () => {
		const url = new URL("/signup", window.location.origin).toString();
		try {
			if (!navigator.clipboard) throw new Error("clipboard unavailable");
			await navigator.clipboard.writeText(url);
			setCopied(true);
		} catch {
			window.prompt("Copy this Affiliate invitation link", url);
		}
	};

	return <Form ref={formRef} method="post" className="compact-form">
		<input type="hidden" name="intent" value="invite" />
		<label>Email address<input type="email" name="invitee_email" placeholder="friend@example.com" autoComplete="email" required /></label>
		<FormStatus intent="invite" result={result} />
		<div className="share-actions">
			<button className="button" type="submit" disabled={submitting}>{submitting ? "Sending..." : "Send invitation"}</button>
			<button className="small-button secondary" type="button" onClick={copyInvitationLink}>{copied ? "Link copied" : "Copy invitation link"}</button>
		</div>
		<p className="field-hint">The copied link opens Affiliate signup directly. Invitations never create downstream commission.</p>
	</Form>;
}
