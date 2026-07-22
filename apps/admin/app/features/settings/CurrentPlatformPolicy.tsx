import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import { tokens } from "../../theme";
import { AdminPlatformSettings } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";

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
      <Stack spacing={2}>
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
        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
          {[
            ["Verification SLA", `${platformSettings.verificationSlaHours} hours`],
            ["Payout threshold", formatGHS(platformSettings.payoutReviewThresholdPesewas)],
            ["Maintenance", platformSettings.maintenanceMode ? "Enabled" : "Disabled"],
            ["Updated", platformSettings.updatedAt ? shortTime(platformSettings.updatedAt) : "Default"],
          ].map(([label, value]) => (
            <Box key={label} sx={{ p: 1.5, borderRadius: 1.5, border: "1px solid", borderColor: "divider", bgcolor: "rgba(var(--surface-rgb), .55)" }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>{label}</Typography>
              <Typography sx={{ mt: .25, fontWeight: 900 }}>{value}</Typography>
            </Box>
          ))}
        </Box>
      </Stack>
    </Panel>
  );
}
