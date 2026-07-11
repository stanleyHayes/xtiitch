import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { tokens } from "../../theme";
import { AdminPlatformSettings } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { DetailLine } from "../shared/DetailLine";

export function CurrentPlatformPolicy({
  platformSettings,
}: {
  platformSettings: AdminPlatformSettings;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.info, 0.16),
        backgroundImage: `
          linear-gradient(135deg, ${alpha(tokens.info, 0.08)}, transparent 38%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={1.25}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center" }}
        >
          <SettingsRounded sx={{ color: tokens.burgundy }} />
          <Box>
            <Typography variant="h6">Current platform policy</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {platformSettings.platformName} routes support through{" "}
              {platformSettings.supportEmail}.
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <DetailLine
          label="Verification SLA"
          value={`${platformSettings.verificationSlaHours} hours`}
        />
        <DetailLine
          label="Payout review threshold"
          value={formatGHS(platformSettings.payoutReviewThresholdPesewas)}
        />
        <DetailLine
          label="Maintenance"
          value={
            platformSettings.maintenanceMode ? "Enabled" : "Disabled"
          }
        />
        <DetailLine
          label="Updated"
          value={
            platformSettings.updatedAt
              ? shortTime(platformSettings.updatedAt)
              : "Default"
          }
        />
      </Stack>
    </Panel>
  );
}
