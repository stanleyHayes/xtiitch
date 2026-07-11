import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { AdminAdCampaign } from "../../../lib/api";
import { Panel } from "../../../components/ui/Panel";
import { formatGHS, formatPercentBps } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import { CardDetailAction } from "../../shared/CardDetailAction";
import {
  adCampaignStatusColor,
  adCampaignStatusLabel,
  adPlacementLabel,
} from "../utils";

export function AdCampaignDetail({
  campaign,
  onOpen,
}: {
  campaign: AdminAdCampaign;
  onOpen: () => void;
}) {
  const archived = campaign.status === "archived";
  const color = adCampaignStatusColor(campaign.status);
  const paidMinor = campaign.payments.reduce(
    (total, payment) =>
      total + (payment.status === "paid" ? payment.amountMinor : 0),
    0,
  );
  const dueMinor = Math.max(campaign.budgetMinor - paidMinor, 0);
  const openPayment = campaign.payments.find(
    (payment) => payment.status === "initiated",
  );

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(color, archived ? 0.12 : 0.2),
        backgroundImage: `linear-gradient(180deg, ${alpha(
          color,
          archived ? 0.035 : 0.075,
        )}, transparent 42%)`,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          sx={{
            justifyContent: "space-between",
            alignItems: { sm: "flex-start" },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Typography variant="h6">{campaign.headline}</Typography>
              <Chip
                size="small"
                label={adPlacementLabel(campaign.placementType)}
                variant="outlined"
              />
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {campaign.businessName} · {campaign.businessHandle}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={adCampaignStatusLabel(campaign.status)}
            sx={{
              bgcolor: alpha(color, 0.12),
              color,
              fontWeight: 900,
            }}
          />
        </Stack>

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

        <CardDetailAction
          onClick={onOpen}
          hint={
            openPayment
              ? "Payment link open"
              : dueMinor > 0
                ? `${formatGHS(dueMinor)} due · awaiting collection`
                : "Budget collected"
          }
        />
      </Stack>
    </Panel>
  );
}
