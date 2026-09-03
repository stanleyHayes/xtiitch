import { formatDate } from "./format";
import type { Dashboard } from "./types";

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export function MilestonesSection({ dashboard }: { dashboard: Dashboard }) {
  const next = dashboard.next_milestone_threshold;
  const achievements = dashboard.milestone_achievements ?? [];
  const progress =
    next > 0 ? Math.min(100, (dashboard.active_referrals / next) * 100) : 100;
  return (
    <div className="section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Progress and recognition</p>
          <h1>Milestones & rewards</h1>
          <p className="muted">
            Rewards are based only on active paid business referrals.
          </p>
        </div>
      </div>
      <section className="conversion-story">
        <div className="conversion-story-head">
          <div>
            <span className="stat-label">Next achievement</span>
            <h2>
              {dashboard.next_milestone_title || "All milestones reached"}
            </h2>
          </div>
          <span className="period-badge">
            {next > 0 ? `${dashboard.active_referrals} / ${next}` : "Complete"}
          </span>
        </div>
        <div
          className="bar"
          aria-label={`${Math.round(progress)}% milestone progress`}
        >
          <div className="bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted">
          {next > 0
            ? `${Math.max(0, next - dashboard.active_referrals)} more active paid referrals to reach this reward.`
            : "You have reached every configured milestone."}
        </p>
      </section>
      <h2 className="section-subhead">Achievements</h2>
      {achievements.length === 0 ? (
        <section className="card empty-state">
          <p className="empty-title">Your first achievement is ahead</p>
          <p className="muted">
            Keep sharing your link; unlocked rewards and their fulfilment status
            will appear here.
          </p>
        </section>
      ) : (
        <section className="card list">
          {achievements.map((achievement) => (
            <article className="list-row" key={achievement.achievement_id}>
              <div className="list-main">
                <strong>{achievement.title}</strong>
                <span className="muted">
                  {achievement.threshold} active referrals · achieved{" "}
                  {formatDate(achievement.achieved_at)}
                </span>
                <span className="muted">{achievement.reward_description}</span>
              </div>
              <span
                className={`pill ${achievement.reward_status === "fulfilled" ? "pill-positive" : "pill-pending"}`}
              >
                {label(achievement.reward_status)}
              </span>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
