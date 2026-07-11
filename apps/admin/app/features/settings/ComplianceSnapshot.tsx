import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { tokens } from "../../theme";
import { AdminPlatformSettings } from "../shared/types";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { DetailLine } from "../shared/DetailLine";

export function ComplianceSnapshot({
  pendingKyc,
  payoutReviews,
  failedWebhooks,
  openRisks,
  urgentSupport,
  platformSettings,
}: {
  pendingKyc: number;
  payoutReviews: number;
  failedWebhooks: number;
  openRisks: number;
  urgentSupport: number;
  platformSettings: AdminPlatformSettings;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.info, 0.16),
        backgroundImage: `
          radial-gradient(circle at 96% 0%, ${alpha(tokens.info, 0.14)}, transparent 34%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center" }}
        >
          <ShieldRounded sx={{ color: tokens.burgundy }} />
          <Box>
            <Typography variant="h6">Compliance snapshot</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              KYC, settlement, support, and operator traceability.
            </Typography>
          </Box>
        </Stack>
        <Divider />
        <DetailLine label="Pending KYC" value={String(pendingKyc)} />
        <DetailLine
          label="Payout holds"
          value={String(payoutReviews)}
        />
        <DetailLine
          label="Failed webhooks"
          value={String(failedWebhooks)}
        />
        <DetailLine label="Open risks" value={String(openRisks)} />
        <DetailLine
          label="Urgent support"
          value={String(urgentSupport)}
        />
        <DetailLine
          label="Policy updated"
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
