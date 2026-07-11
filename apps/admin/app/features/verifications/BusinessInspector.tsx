import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { AdminBusiness } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { statusColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { DetailLine } from "../shared/DetailLine";



export function BusinessInspector({
  business,
  onReviewPayments,
  onOpenAudit,
  onClose,
}: {
  business: AdminBusiness | null;
  onReviewPayments: () => void;
  onOpenAudit: () => void;
  onClose: () => void;
}) {
  if (!business) {
    return (
      <Panel
        sx={{
          p: 2.5,
          position: { xl: "sticky" },
          top: { xl: 118 },
          borderColor: alpha(tokens.burgundy, 0.16),
          backgroundImage: `
            radial-gradient(circle at 92% 0%, ${alpha(tokens.burgundy, 0.12)}, transparent 34%),
            linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
          `,
        }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
            }}
          >
            <PersonSearchRounded />
          </Box>
          <Typography variant="h6">Select a business</Typography>
          <Typography sx={{ color: "text.secondary" }}>
            Inspect one tenant to see its settlement reference, activity, risk
            posture, and admin-safe actions.
          </Typography>
        </Stack>
      </Panel>
    );
  }

  const isSuspended = business.operationalStatus === "suspended";
  const accent = statusColor(business.status);

  return (
    <Panel
      sx={{
        p: 2.5,
        position: { xl: "sticky" },
        top: { xl: 118 },
        borderColor: alpha(accent, 0.24),
        backgroundImage: `
          radial-gradient(circle at 95% 5%, ${alpha(accent, 0.14)}, transparent 32%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">{business.name}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {business.handle}.xtiitch.com
            </Typography>
          </Box>
          <Button size="small" onClick={onClose}>
            Close
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <StatusChip status={business.status} />
          <RiskChip level={business.riskLevel} />
          <Chip size="small" label={business.plan} variant="outlined" />
        </Stack>
        <Divider />
        <Stack spacing={1.25}>
          <DetailLine label="Owner" value={business.ownerEmail} />
          <DetailLine
            label="Subaccount"
            value={business.subaccountRef || "Not provisioned"}
          />
          <DetailLine label="Orders" value={String(business.orders)} />
          <DetailLine label="GMV" value={formatGHS(business.gmvMinor)} />
          <DetailLine
            label="Commission"
            value={formatGHS(business.commissionMinor)}
          />
          <DetailLine
            label="Last active"
            value={shortTime(business.lastActive)}
          />
          {business.suspensionReason ? (
            <DetailLine
              label="Suspension reason"
              value={business.suspensionReason}
            />
          ) : null}
        </Stack>
        <Divider />
        <Stack spacing={1}>
          <Typography variant="subtitle2">Admin-safe actions</Typography>
          <Form method="post">
            <input
              type="hidden"
              name="intent"
              value="admin-business-status:update"
            />
            <input type="hidden" name="business_id" value={business.id} />
            <input
              type="hidden"
              name="operational_status"
              value={isSuspended ? "active" : "suspended"}
            />
            <Stack spacing={1}>
              {!isSuspended ? (
                <TextField
                  name="reason"
                  label="Suspension reason"
                  placeholder="Why should this tenant be paused?"
                  multiline
                  minRows={2}
                  fullWidth
                />
              ) : (
                <input
                  type="hidden"
                  name="reason"
                  value="Operator reactivated tenant activity after review."
                />
              )}
              <Button
                type="submit"
                variant="outlined"
                color={isSuspended ? "primary" : "error"}
                startIcon={
                  isSuspended ? <CheckCircleRounded /> : <BlockRounded />
                }
              >
                {isSuspended ? "Reactivate business" : "Suspend business"}
              </Button>
            </Stack>
          </Form>
          <Button
            variant="outlined"
            startIcon={<PaymentsRounded />}
            onClick={onReviewPayments}
          >
            Review payments
          </Button>
          <Button
            variant="outlined"
            startIcon={<HistoryRounded />}
            onClick={onOpenAudit}
          >
            Open audit trail
          </Button>
          <Button
            variant="outlined"
            startIcon={<StorefrontRounded />}
            href={`https://${business.handle}.xtiitch.com`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View public storefront
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}
