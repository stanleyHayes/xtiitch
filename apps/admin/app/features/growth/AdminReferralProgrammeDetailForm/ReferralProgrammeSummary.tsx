import Box from "@mui/material/Box";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import { DetailLine } from "../../shared/DetailLine";
import {
  referralRefereeRewardKindLabel,
  referralRewardKindLabel,
  referralRewardLabel,
} from "../utils";
import type { AdminReferralProgramme } from "../../../lib/api";

export function ReferralProgrammeSummary({
  programme,
}: {
  programme: AdminReferralProgramme;
}) {
  const windowText =
    programme.startsAt || programme.endsAt
      ? `${programme.startsAt ? shortTime(programme.startsAt) : "Now"} to ${
          programme.endsAt ? shortTime(programme.endsAt) : "open"
        }`
      : "Always available";

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
      }}
    >
      <DetailLine label="Reward" value={referralRewardLabel(programme)} />
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
      <DetailLine label="Hold" value={`${programme.rewardHoldDays} days`} />
      <DetailLine label="Window" value={windowText} />
      <DetailLine label="Updated" value={shortTime(programme.updatedAt)} />
    </Box>
  );
}
