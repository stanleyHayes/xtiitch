import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
  AdminPartnerMilestone,
} from "../../../lib/api";
import { Panel } from "../../../components/ui/Panel";
import { AdminEmptyState } from "../../../components/ui/AdminEmptyState";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import { formatGHS } from "../../shared/formatting";

const LEADERBOARD_SIZE = 5;

type AffiliateStanding = {
  affiliateId: string;
  displayName: string;
  code: string;
  status: string;
  paidReferrals: number;
  lifetimeCommissionMinor: number;
};

type MilestoneApproach = AffiliateStanding & {
  milestone: AdminPartnerMilestone;
  remaining: number;
};

// A milestone counts as "approaching" once the Affiliate is within a fifth of
// the way to it, with a floor of two referrals so the smallest rungs on the
// ladder still surface before they are reached. Proportional rather than fixed
// because the ladder spans 10 to 1,000 paid referrals: "5 away" is imminent at
// the bottom and meaningless at the top.
function approachWindow(threshold: number): number {
  return Math.max(2, Math.ceil(threshold * 0.2));
}

function buildStandings(
  affiliates: AdminAffiliate[],
  attribution: AdminAffiliateAttribution[],
): AffiliateStanding[] {
  return attribution
    .map((item) => {
      const affiliate = affiliates.find(
        (candidate) => candidate.affiliateId === item.affiliateId,
      );
      return {
        affiliateId: item.affiliateId,
        displayName: item.displayName,
        code: item.code,
        status: affiliate?.status ?? "unknown",
        // Milestones are earned on paid referrals, so the same measure ranks
        // performance: a business that never subscribed earns nobody a rung.
        paidReferrals: item.activeReferralCount,
        lifetimeCommissionMinor: item.commissionMinor,
      };
    })
    .filter((standing) => standing.status !== "archived");
}

function nextMilestone(
  milestones: AdminPartnerMilestone[],
  paidReferrals: number,
): AdminPartnerMilestone | undefined {
  return milestones
    .filter(
      (milestone) =>
        milestone.status === "active" && milestone.threshold > paidReferrals,
    )
    .sort((left, right) => left.threshold - right.threshold)[0];
}

function StandingRow({
  standing,
  detail,
  onSelect,
}: {
  standing: AffiliateStanding;
  detail: string;
  onSelect: (affiliateId: string) => void;
}) {
  return (
    <Stack
      component="button"
      type="button"
      onClick={() => onSelect(standing.affiliateId)}
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{
        p: 1.25,
        width: "100%",
        border: 0,
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 1,
        bgcolor: "rgba(var(--surface-rgb), 0.76)",
        justifyContent: "space-between",
        alignItems: { sm: "center" },
        "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.92)" },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900 }}>{standing.displayName}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {standing.code} · {detail}
        </Typography>
      </Box>
      <Chip
        size="small"
        variant="outlined"
        label={standing.status.replaceAll("_", " ")}
      />
    </Stack>
  );
}

export function AffiliatePerformancePanel({
  affiliates,
  affiliateAttribution,
  milestones,
  onSelect,
}: {
  affiliates: AdminAffiliate[];
  affiliateAttribution: AdminAffiliateAttribution[];
  milestones: AdminPartnerMilestone[];
  onSelect: (affiliateId: string) => void;
}) {
  const standings = buildStandings(affiliates, affiliateAttribution);

  const topPerformers = [...standings]
    .filter((standing) => standing.paidReferrals > 0)
    .sort(
      (left, right) =>
        right.paidReferrals - left.paidReferrals ||
        right.lifetimeCommissionMinor - left.lifetimeCommissionMinor,
    )
    .slice(0, LEADERBOARD_SIZE);

  const approaching: MilestoneApproach[] = standings
    .flatMap((standing) => {
      const milestone = nextMilestone(milestones, standing.paidReferrals);
      if (!milestone) return [];
      const remaining = milestone.threshold - standing.paidReferrals;
      if (remaining > approachWindow(milestone.threshold)) return [];
      return [{ ...standing, milestone, remaining }];
    })
    .sort((left, right) => left.remaining - right.remaining)
    .slice(0, LEADERBOARD_SIZE);

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
      }}
    >
      <Panel sx={{ p: 2.5 }}>
        <Typography variant="overline">Programme standings</Typography>
        <Typography variant="h6">Top-performing Affiliates</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Ranked by paid referrals, then lifetime commission.
        </Typography>
        {topPerformers.length ? (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {topPerformers.map((standing) => (
              <StandingRow
                key={standing.affiliateId}
                standing={standing}
                detail={`${standing.paidReferrals} paid referrals · ${formatGHS(
                  standing.lifetimeCommissionMinor,
                )} lifetime`}
                onSelect={onSelect}
              />
            ))}
          </Stack>
        ) : (
          <AdminEmptyState
            compact
            icon={<EmojiEventsRounded />}
            title="No paid referrals yet"
            helper="An Affiliate appears here once a referred business starts a paid plan."
          />
        )}
      </Panel>

      <Panel sx={{ p: 2.5 }}>
        <Typography variant="overline">Reward pipeline</Typography>
        <Typography variant="h6">Approaching a milestone</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Within reach of their next rung. Reaching one unlocks a reward; it
          does not fulfil it.
        </Typography>
        {approaching.length ? (
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {approaching.map((standing) => (
              <Box key={standing.affiliateId}>
                <StandingRow
                  standing={standing}
                  detail={`${standing.remaining} to go · ${standing.milestone.title} at ${standing.milestone.threshold}`}
                  onSelect={onSelect}
                />
                <LinearProgress
                  variant="determinate"
                  value={Math.min(
                    100,
                    (standing.paidReferrals / standing.milestone.threshold) *
                      100,
                  )}
                  sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                />
              </Box>
            ))}
          </Stack>
        ) : (
          <AdminEmptyState
            compact
            icon={<TrendingUpRounded />}
            title="Nobody is close to a milestone"
            helper="Affiliates appear here as they near the next threshold on the ladder."
          />
        )}
      </Panel>
    </Box>
  );
}
