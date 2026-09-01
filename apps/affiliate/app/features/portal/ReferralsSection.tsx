import type { Dashboard, PartnerReferral } from "./types";

const labels = {
  active: "Active",
  inactive: "Inactive",
  not_activated: "Not Activated",
} as const;

export function ReferralsSection({
  referrals,
  dashboard,
}: {
  referrals: PartnerReferral[];
  dashboard: Dashboard;
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
          <div className="empty-state"><p className="empty-title">No referred businesses yet</p><p className="muted">Share your Partner link to get started.</p></div>
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
    </div>
  );
}
