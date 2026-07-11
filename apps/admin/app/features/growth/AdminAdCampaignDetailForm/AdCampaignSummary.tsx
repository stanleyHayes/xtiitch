import Box from "@mui/material/Box";
import { formatGHS, formatPercentBps } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import type { AdminAdCampaign } from "../../../lib/api";

export function AdCampaignSummary({ campaign }: { campaign: AdminAdCampaign }) {
  const paidMinor = campaign.payments.reduce(
    (total, payment) =>
      total + (payment.status === "paid" ? payment.amountMinor : 0),
    0,
  );

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
      }}
    >
      <DetailLine label="Target" value={campaign.targetLabel} />
      <DetailLine
        label="Budget"
        value={`${formatGHS(paidMinor)} collected / ${formatGHS(
          campaign.budgetMinor,
        )} booked`}
      />
      <DetailLine
        label="Daily cap"
        value={
          typeof campaign.dailyCapMinor === "number"
            ? formatGHS(campaign.dailyCapMinor)
            : "No cap"
        }
      />
      <DetailLine
        label="Window"
        value={`${shortTime(campaign.startsAt)} - ${shortTime(
          campaign.endsAt,
        )}`}
      />
      <DetailLine
        label="Impressions"
        value={`${campaign.impressionCount} views`}
      />
      <DetailLine
        label="Clicks"
        value={`${campaign.clickCount} · ${formatPercentBps(
          campaign.clickRateBps,
        )}`}
      />
    </Box>
  );
}
