import { DownloadIcon, WalletIcon } from "../../components/Icons";
import { formatDate, formatMoney } from "./format";
import type { Conversion, Dashboard, Payout } from "./types";

// The API returns free-form status strings. Map the ones we know to a tone so
// the list reads at a glance, and fall back to neutral for anything new rather
// than dropping the row or guessing wrong.
function toneFor(status: string): string {
  const value = status.toLowerCase();
  if (["paid", "approved", "available", "settled"].includes(value)) {
    return "pill-positive";
  }
  if (["pending", "processing", "queued"].includes(value)) {
    return "pill-pending";
  }
  if (["reversed", "failed", "cancelled", "canceled"].includes(value)) {
    return "pill-negative";
  }
  return "pill-neutral";
}

function labelFor(value: string): string {
  if (!value) {
    return "Unknown";
  }
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function EarningsSection({
  dashboard,
  conversions,
  payouts
}: {
  dashboard: Dashboard;
  conversions: Conversion[];
  payouts: Payout[];
}) {
  return (
    <div className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Money</p>
          <h1>Earnings</h1>
          <p className="muted">
            Every conversion and payout on your account.
          </p>
        </div>
        <a
          className="small-button secondary"
          href="/portal/reports/conversions.csv"
          download
        >
          <DownloadIcon />
          Export CSV
        </a>
      </div>

      <section className="balance-grid" aria-label="Commission balance">
        <article className="balance balance-positive">
          <span className="stat-label">Available now</span>
          <strong className="balance-value">
            {formatMoney(dashboard.available_commission_minor)}
          </strong>
        </article>
        <article className="balance balance-neutral">
          <span className="stat-label">Pending</span>
          <strong className="balance-value">
            {formatMoney(dashboard.pending_commission_minor)}
          </strong>
        </article>
        <article className="balance balance-neutral">
          <span className="stat-label">Paid out</span>
          <strong className="balance-value">
            {formatMoney(dashboard.paid_commission_minor)}
          </strong>
        </article>
        <article className="balance balance-negative">
          <span className="stat-label">Reversed</span>
          <strong className="balance-value">
            {formatMoney(dashboard.reversed_commission_minor)}
          </strong>
        </article>
      </section>

      <div className="ledger-grid">
        <section className="card">
          <div className="card-head">
            <h2>Recent conversions</h2>
            <p className="muted">
              What you earned, and whether it has cleared.
            </p>
          </div>
          {conversions.length === 0 ? (
            <div className="empty-state">
              <WalletIcon size={22} />
              <p className="empty-title">No conversions yet</p>
              <p className="muted">
                Share your link — signups and subscription payments show up here.
              </p>
            </div>
          ) : (
            <div className="list">
              {conversions.map((conversion) => (
                <article className="list-row" key={conversion.conversion_id}>
                  <div className="list-main">
                    <strong>{labelFor(conversion.conversion_type)}</strong>
                    <span className="muted">
                      {formatDate(conversion.occurred_at)} ·{" "}
                      {formatMoney(conversion.gross_minor)} volume
                    </span>
                  </div>
                  <div className="list-side">
                    <strong>{formatMoney(conversion.commission_minor)}</strong>
                    <span className={`pill ${toneFor(conversion.status)}`}>
                      {labelFor(conversion.status)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Payouts</h2>
            <p className="muted">Money already on its way to you.</p>
          </div>
          {payouts.length === 0 ? (
            <div className="empty-state">
              <WalletIcon size={22} />
              <p className="empty-title">No payouts yet</p>
              <p className="muted">
                Cleared commission is paid out on the next run.
              </p>
            </div>
          ) : (
            <div className="list">
              {payouts.map((payout) => (
                <article className="list-row" key={payout.payout_id}>
                  <div className="list-main">
                    <strong>{payout.payout_reference}</strong>
                    <span className="muted">
                      {formatDate(payout.created_at)}
                    </span>
                  </div>
                  <div className="list-side">
                    <strong>{formatMoney(payout.commission_minor)}</strong>
                    <span className={`pill ${toneFor(payout.status)}`}>
                      {labelFor(payout.status)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
