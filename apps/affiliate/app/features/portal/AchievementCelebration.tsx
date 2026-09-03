import { useEffect, useState } from "react";
import { CheckIcon } from "../../components/Icons";
import type { MilestoneAchievement } from "./types";

const SEEN_KEY = "xtiitch-affiliate-seen-achievements";

export function AchievementCelebration({
  achievements,
  onView,
}: {
  achievements: MilestoneAchievement[];
  onView: () => void;
}) {
  const [unlocked, setUnlocked] = useState<MilestoneAchievement | null>(null);

  useEffect(() => {
    if (achievements.length === 0) return;
    let seen: string[] = [];
    try {
      seen = JSON.parse(
        window.localStorage.getItem(SEEN_KEY) ?? "[]",
      ) as string[];
    } catch {
      seen = [];
    }
    const next = achievements.find(
      (achievement) => !seen.includes(achievement.achievement_id),
    );
    if (!next) return;
    setUnlocked(next);
    try {
      window.localStorage.setItem(
        SEEN_KEY,
        JSON.stringify([
          ...new Set([
            ...seen,
            ...achievements.map((item) => item.achievement_id),
          ]),
        ]),
      );
    } catch {
      // Private browsing and hardened storage policies may reject writes. The
      // recognition still works for this render without blocking the portal.
    }
  }, [achievements]);

  if (!unlocked) return null;
  return (
    <section
      className="achievement-celebration"
      role="status"
      aria-live="polite"
    >
      <span className="achievement-mark">
        <CheckIcon size={22} />
      </span>
      <div>
        <span className="stat-label">Achievement unlocked</span>
        <strong>{unlocked.title}</strong>
        <p>{unlocked.reward_description}</p>
      </div>
      <button
        className="small-button"
        type="button"
        onClick={() => {
          setUnlocked(null);
          onView();
        }}
      >
        View reward
      </button>
      <button
        className="celebration-dismiss"
        type="button"
        aria-label="Dismiss achievement"
        onClick={() => setUnlocked(null)}
      >
        ×
      </button>
    </section>
  );
}
