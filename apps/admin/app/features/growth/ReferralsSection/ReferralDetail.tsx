import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { AdminReferralProgramme } from "../../../lib/api";
import { Panel } from "../../../components/ui/Panel";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import { CardDetailAction } from "../../shared/CardDetailAction";
import {
  referralAudienceLabel,
  referralRefereeRewardKindLabel,
  referralRewardKindLabel,
  referralRewardLabel,
  referralRewardTypeLabel,
  referralStatusColor,
  referralStatusLabel,
} from "../utils";

export function ReferralDetail({
  programme,
  onOpen,
}: {
  programme: AdminReferralProgramme;
  onOpen: () => void;
}) {
  const color = referralStatusColor(programme.status);
  const archived = programme.status === "archived";
  const windowText =
    programme.startsAt || programme.endsAt
      ? `${programme.startsAt ? shortTime(programme.startsAt) : "Now"} to ${
          programme.endsAt ? shortTime(programme.endsAt) : "open"
        }`
      : "Always available";

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
              <Typography variant="h6">{programme.title}</Typography>
              <Chip
                size="small"
                label={programme.codePrefix}
                variant="outlined"
              />
            </Stack>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {referralAudienceLabel(programme.audience)} ·{" "}
              {referralRewardTypeLabel(programme.rewardType)}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={referralStatusLabel(programme.status)}
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
          <DetailLine
            label="Reward"
            value={referralRewardLabel(programme)}
          />
          <DetailLine
            label="Reward route"
            value={`${referralRewardKindLabel(
              programme.referrerRewardKind,
            )} / ${referralRefereeRewardKindLabel(programme.refereeRewardKind)}`}
          />
          <DetailLine
            label="Minimum order"
            value={formatGHS(programme.qualifyingOrderMinMinor)}
          />
          <DetailLine
            label="Hold"
            value={`${programme.rewardHoldDays} days`}
          />
          <DetailLine label="Window" value={windowText} />
          <DetailLine
            label="Updated"
            value={shortTime(programme.updatedAt)}
          />
        </Box>

        <CardDetailAction
          onClick={onOpen}
          hint={
            programme.codes.length
              ? `${programme.codes.length} issued code${
                  programme.codes.length === 1 ? "" : "s"
                }`
              : "No codes issued"
          }
        />
      </Stack>
    </Panel>
  );
}
