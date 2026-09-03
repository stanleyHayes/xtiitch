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
import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import AdsClickRounded from "@mui/icons-material/AdsClickRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import ChatRounded from "@mui/icons-material/ChatRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import HourglassTopRounded from "@mui/icons-material/HourglassTopRounded";
import LocationOnRounded from "@mui/icons-material/LocationOnRounded";
import MailOutlineRounded from "@mui/icons-material/MailOutlineRounded";
import PaidRounded from "@mui/icons-material/PaidRounded";
import PauseCircleRounded from "@mui/icons-material/PauseCircleRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PercentRounded from "@mui/icons-material/PercentRounded";
import PersonOffRounded from "@mui/icons-material/PersonOffRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import PublishedWithChangesRounded from "@mui/icons-material/PublishedWithChangesRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import ToggleOnRounded from "@mui/icons-material/ToggleOnRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";

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
        icon={<PercentRounded />}
      />
      <DetailLine
        label="Cookie window"
        value={`${affiliate.cookieWindowDays} days`}
        icon={<ScheduleRounded />}
      />
      <DetailLine
        label="Payout mode"
        value={affiliatePayoutLabel(affiliate.payoutMode)}
        icon={<AccountBalanceWalletRounded />}
      />
      <DetailLine label="Email" value={affiliate.email || "Not recorded"} icon={<EmailRounded />} />
      <DetailLine label="WhatsApp" value={affiliate.phone || "Not recorded"} icon={<ChatRounded />} />
      <DetailLine label="Region" value={affiliate.region || "Not recorded"} icon={<LocationOnRounded />} />
      <DetailLine label="Joined" value={shortTime(affiliate.createdAt)} icon={<CalendarMonthRounded />} />
      <DetailLine
        label="Status"
        value={affiliate.status.replaceAll("_", " ")}
        icon={<ToggleOnRounded />}
      />
      <DetailLine
        label="Milestone status"
        value={
          reachedMilestone
            ? `${reachedMilestone.title} · ${reachedMilestone.rewardDescription}`
            : `${paidReferrals} paid referrals · no milestone reached`
        }
        icon={<EmojiEventsRounded />}
      />
      <DetailLine
        label="Tracked clicks"
        value={String(performance?.clickCount ?? 0)}
        icon={<AdsClickRounded />}
      />
      <DetailLine
        label="Conversions"
        value={`${performance?.conversionCount ?? 0} total · ${
          performance?.pendingConversionCount ?? 0
        } pending`}
        icon={<PublishedWithChangesRounded />}
      />
      <DetailLine label="Active referrals" value={String(performance?.activeReferralCount ?? 0)} icon={<GroupsRounded />} />
      <DetailLine label="Inactive referrals" value={String(performance?.inactiveReferralCount ?? 0)} icon={<PersonOffRounded />} />
      <DetailLine label="Not Activated referrals" value={String(performance?.notActivatedCount ?? 0)} icon={<PersonSearchRounded />} />
      <DetailLine label="Affiliate invitations" value={`${performance?.invitations.length ?? 0} sent · ${performance?.invitations.filter((item) => item.acceptedAt).length ?? 0} joined`} icon={<MailOutlineRounded />} />
      <DetailLine
        label="Gross attributed"
        value={formatGHS(performance?.grossMinor ?? 0)}
        icon={<TrendingUpRounded />}
      />
      <DetailLine
        label="Pending earnings"
        value={formatGHS(performance?.pendingCommissionMinor ?? 0)}
        icon={<HourglassTopRounded />}
      />
      <DetailLine
        label="Available earnings"
        value={formatGHS(performance?.availableCommissionMinor ?? 0)}
        icon={<PaymentsRounded />}
      />
      <DetailLine
        label="Lifetime paid earnings"
        value={formatGHS(performance?.paidCommissionMinor ?? 0)}
        icon={<PaidRounded />}
      />
      <DetailLine
        label="Held earnings"
        value={`${formatGHS(performance?.heldCommissionMinor ?? 0)} · ${
          performance?.heldConversionCount ?? 0
        } on hold`}
        icon={<PauseCircleRounded />}
      />
      <DetailLine
        label="Reversed / adjusted"
        value={formatGHS(performance?.reversedCommissionMinor ?? 0)}
        icon={<UndoRounded />}
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
        icon={<ReceiptLongRounded />}
      />
    </Box>
  );
}
