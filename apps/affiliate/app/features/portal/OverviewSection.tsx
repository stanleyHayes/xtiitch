import { formatMoney, formatRateBps } from "./format";
import { ShareCard } from "./ShareCard";
import type { Dashboard, ShareLinks } from "./types";

// Money the affiliate can reason about, ordered the way they think about it:
// what is coming, what is claimable, what has landed.
function balances(dashboard: Dashboard) {
  return [
    {
      label: "Available now",
      value: formatMoney(dashboard.available_commission_minor),
      hint: "Cleared and ready for the next payout run",
      tone: "positive" as const,
    },
    {
      label: "Pending",
      value: formatMoney(dashboard.pending_commission_minor),
      hint: "Still inside the approval window",
      tone: "neutral" as const,
    },
    {
      label: "Paid out",
      value: formatMoney(dashboard.paid_commission_minor),
      hint: "Already sent to your payout account",
      tone: "neutral" as const,
    },
    {
      label: "Reversed",
      value: formatMoney(dashboard.reversed_commission_minor),
      hint: "Refunded or cancelled after approval",
      tone: "negative" as const,
    },
  ];
}

export function OverviewSection({
  dashboard,
  share,
  displayName,
}: {
  dashboard: Dashboard;
  share: ShareLinks;
  displayName?: string;
}) {
  const firstName = displayName?.trim().split(/\s+/)[0];
	const nextMilestone = dashboard.next_milestone_threshold;
	const progress = nextMilestone > 0
		? Math.min(100, (dashboard.active_referrals / nextMilestone) * 100)
		: 100;

  return (
    <div className="section">
      <div className="section-head">
        <div>
			<p className="eyebrow">Affiliate performance</p>
          <h1>{firstName ? `Welcome back, ${firstName}` : "Your overview"}</h1>
          <p className="muted">
            Your last 30 days of momentum, with lifetime earnings.
          </p>
        </div>
      </div>

      <div className="overview-grid">
        <section className="hero-stat" aria-label="Lifetime earnings">
          <span className="hero-label">Lifetime earnings</span>
          <strong className="hero-value">
            {formatMoney(dashboard.lifetime_earnings_minor)}
          </strong>
          <span className="hero-hint">
            {formatMoney(dashboard.available_commission_minor)} available to be
            paid out
          </span>
        </section>

        <ShareCard
          code={share.code}
          url={share.canonical_url}
          cookieWindowDays={share.cookie_window_days}
        />
      </div>

      <section className="stat-row" aria-label="Affiliate referral progress">
        <article className="stat">
          <span className="stat-label">Link clicks</span>
          <strong className="stat-value">
            {dashboard.clicks.toLocaleString()}
          </strong>
        </article>
        <article className="stat">
			<span className="stat-label">Referred businesses</span>
			<strong className="stat-value">{dashboard.business_signups.toLocaleString()}</strong>
          <span className="stat-hint">
				{dashboard.active_referrals.toLocaleString()} active
          </span>
        </article>
        <article className="stat">
			<span className="stat-label">Subscription payments</span>
          <strong className="stat-value">
				{dashboard.paid_plan_signups.toLocaleString()}
          </strong>
			<span className="stat-hint">20% recurring on eligible payments</span>
        </article>
        <article className="stat">
			<span className="stat-label">Affiliates invited</span>
          <strong className="stat-value">
				{dashboard.partners_invited.toLocaleString()}
          </strong>
			<span className="stat-hint">Community growth · no commission</span>
        </article>
      </section>

		<section className="conversion-story" aria-labelledby="conversion-title">
        <div className="conversion-story-head">
          <div>
				<span className="stat-label">Next achievement</span>
				<h2 id="conversion-title">{dashboard.next_milestone_title || "Top milestone reached"}</h2>
          </div>
			<span className="period-badge">{nextMilestone > 0 ? `${dashboard.active_referrals} / ${nextMilestone}` : "Complete"}</span>
        </div>
		<div className="bar" aria-label={`${Math.round(progress)}% milestone progress`}><div className="bar-fill" style={{ width: `${progress}%` }} /></div>
		<p className="muted">{nextMilestone > 0 ? `${Math.max(0, nextMilestone - dashboard.active_referrals)} more active paid referrals to unlock your next configured reward.` : "You have reached every configured milestone."}</p>
        <div className="funnel">
          <article>
            <span className="stat-label">Click → signup</span>
            <strong>{formatRateBps(dashboard.click_to_signup_rate_bps)}</strong>
            <Bar bps={dashboard.click_to_signup_rate_bps} />
          </article>
        </div>
      </section>

      <h2 className="section-subhead">Commission balance</h2>
      <section className="balance-grid" aria-label="Commission balance">
        {balances(dashboard).map((item) => (
          <article className={`balance balance-${item.tone}`} key={item.label}>
            <span className="stat-label">{item.label}</span>
            <strong className="balance-value">{item.value}</strong>
            <span className="stat-hint">{item.hint}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

// Basis points cap at 10000 (100%), but a rate is only legible against a
// realistic range — a 3% click-to-purchase rate against a 100% axis is an
// invisible sliver. Anything at or above 25% fills the bar.
function Bar({ bps }: { bps: number }) {
  const percent = Math.min(100, Math.max(0, (bps / 2500) * 100));
  return (
    <div className="bar" aria-hidden="true">
      <div className="bar-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
