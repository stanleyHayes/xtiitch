import Box from "@mui/material/Box";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import { affiliateCommissionLabel, affiliatePayoutLabel } from "../utils";
import type {
  AdminAffiliate,
  AdminAffiliateAttribution,
  AdminPartnerMilestone,
} from "../../../lib/api";

// eslint-disable-next-line complexity -- large presentational component; refactor in follow-up
export function AffiliateSummary({
  affiliate,
  performance,
  milestones,
}: {
  affiliate: AdminAffiliate;
  performance?: AdminAffiliateAttribution;
  milestones: AdminPartnerMilestone[];
}) {
  const lastPayout = performance?.recentPayouts[0];
  const paidReferrals = performance?.activeReferralCount ?? 0;
  const reachedMilestone = [...milestones]
    .filter(
      (milestone) =>
        milestone.status === "active" && milestone.threshold <= paidReferrals,
    )
    .sort((left, right) => right.threshold - left.threshold)[0];

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
      }}
    >
      <DetailLine
        label="Commission"
        value={affiliateCommissionLabel(affiliate)}
      />
      <DetailLine
        label="Cookie window"
        value={`${affiliate.cookieWindowDays} days`}
      />
      <DetailLine
        label="Payout mode"
        value={affiliatePayoutLabel(affiliate.payoutMode)}
      />
      <DetailLine label="Email" value={affiliate.email || "Not recorded"} />
      <DetailLine label="WhatsApp" value={affiliate.phone || "Not recorded"} />
      <DetailLine label="Region" value={affiliate.region || "Not recorded"} />
      <DetailLine label="Joined" value={shortTime(affiliate.createdAt)} />
      <DetailLine
        label="Status"
        value={affiliate.status.replaceAll("_", " ")}
      />
      <DetailLine
        label="Milestone status"
        value={
          reachedMilestone
            ? `${reachedMilestone.title} · ${reachedMilestone.rewardDescription}`
            : `${paidReferrals} paid referrals · no milestone reached`
        }
      />
      <DetailLine
        label="Tracked clicks"
        value={String(performance?.clickCount ?? 0)}
      />
      <DetailLine
        label="Conversions"
        value={`${performance?.conversionCount ?? 0} total · ${
          performance?.pendingConversionCount ?? 0
        } pending`}
      />
      <DetailLine label="Active referrals" value={String(performance?.activeReferralCount ?? 0)} />
      <DetailLine label="Inactive referrals" value={String(performance?.inactiveReferralCount ?? 0)} />
      <DetailLine label="Not Activated referrals" value={String(performance?.notActivatedCount ?? 0)} />
      <DetailLine label="Affiliate invitations" value={`${performance?.invitations.length ?? 0} sent · ${performance?.invitations.filter((item) => item.acceptedAt).length ?? 0} joined`} />
      <DetailLine
        label="Gross attributed"
        value={formatGHS(performance?.grossMinor ?? 0)}
      />
      <DetailLine
        label="Pending earnings"
        value={formatGHS(performance?.pendingCommissionMinor ?? 0)}
      />
      <DetailLine
        label="Available earnings"
        value={formatGHS(performance?.availableCommissionMinor ?? 0)}
      />
      <DetailLine
        label="Lifetime paid earnings"
        value={formatGHS(performance?.paidCommissionMinor ?? 0)}
      />
      <DetailLine
        label="Held earnings"
        value={`${formatGHS(performance?.heldCommissionMinor ?? 0)} · ${
          performance?.heldConversionCount ?? 0
        } on hold`}
      />
      <DetailLine
        label="Reversed / adjusted"
        value={formatGHS(performance?.reversedCommissionMinor ?? 0)}
      />
      <DetailLine
        label="Last payout"
        value={
          lastPayout
            ? `${formatGHS(lastPayout.commissionMinor)} · ${shortTime(
                lastPayout.createdAt,
              )}`
            : "None"
        }
      />
    </Box>
  );
}
