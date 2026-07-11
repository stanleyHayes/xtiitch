import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import { tokens } from "../../theme";
import { AdminBusiness, AdminBusinessOperationalStatus } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { statusColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";



export function BusinessRow({
  business,
  selected,
  onInspect,
  compact = false,
}: {
  business: AdminBusiness;
  selected: boolean;
  onInspect: (business: AdminBusiness) => void;
  compact?: boolean;
}) {
  const isSuspended = business.operationalStatus === "suspended";
  const accent = statusColor(business.status);
  const nextStatus: AdminBusinessOperationalStatus = isSuspended
    ? "active"
    : "suspended";

  return (
    <Panel
      sx={{
        p: 2,
        position: "relative",
        borderColor: selected
          ? alpha(tokens.burgundy, 0.42)
          : alpha(accent, 0.2),
        backgroundImage: `
          linear-gradient(90deg, ${alpha(accent, selected ? 0.11 : 0.065)}, transparent 34%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "14px auto 14px 0",
          width: 4,
          borderRadius: "0 8px 8px 0",
          bgcolor: selected ? tokens.burgundy : alpha(accent, 0.68),
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: selected
            ? alpha(tokens.burgundy, 0.52)
            : alpha(accent, 0.32),
          boxShadow: `0 20px 52px ${alpha(tokens.ink, 0.09)}`,
        },
      }}
    >
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: compact
            ? "1fr"
            : {
                xs: "1fr",
                md: "minmax(220px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto",
              },
          alignItems: compact ? "stretch" : "center",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {business.name}
            </Typography>
            <StatusChip status={business.status} />
            <RiskChip level={business.riskLevel} />
          </Stack>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mt: 0.5, overflowWrap: "anywhere" }}
          >
            {business.handle}.xtiitch.com · {business.ownerEmail}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            GMV
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            {formatGHS(business.gmvMinor)}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            Commission
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            {formatGHS(business.commissionMinor)}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            Last active
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            {shortTime(business.lastActive)}
          </Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row", md: "column" }}
          spacing={1}
        >
          <Button
            variant={selected ? "contained" : "outlined"}
            startIcon={<PersonSearchRounded />}
            onClick={() => onInspect(business)}
          >
            Inspect
          </Button>
          <Button
            variant={isSuspended ? "contained" : "outlined"}
            color={isSuspended ? "primary" : "error"}
            type="submit"
            form={`business-status-${business.id}`}
          >
            {isSuspended ? "Reactivate" : "Suspend"}
          </Button>
          <Form
            id={`business-status-${business.id}`}
            method="post"
            style={{ display: "contents" }}
          >
            <input
              type="hidden"
              name="intent"
              value="admin-business-status:update"
            />
            <input type="hidden" name="business_id" value={business.id} />
            <input type="hidden" name="operational_status" value={nextStatus} />
            <input
              type="hidden"
              name="reason"
              value={
                isSuspended
                  ? "Quick reactivation from the businesses list."
                  : "Quick suspension from the businesses list."
              }
            />
          </Form>
        </Stack>
      </Box>
    </Panel>
  );
}
