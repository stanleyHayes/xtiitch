import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import type { AdminBusiness } from "../../lib/api";
import { tokens } from "../../theme";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { formatGHS } from "../shared/formatting";
import { shortTimeOrFallback } from "../shared/dates";
import { BusinessRecord, OwnerContacts } from "./BusinessRecordDetails";

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: { xs: 0, sm: 2 },
        py: { xs: 1, sm: 0.5 },
        borderLeft: { xs: 0, sm: "1px solid" },
        borderColor: { sm: "divider" },
        "&:first-of-type": { pl: 0, borderLeft: 0 },
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: ".04em" }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.25,
          fontSize: { xs: 20, md: 24 },
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {helper}
      </Typography>
    </Box>
  );
}

function QuickRoute({
  icon,
  title,
  helper,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="text"
      onClick={onClick}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        justifyContent: "flex-start",
        textAlign: "left",
        color: "text.primary",
        "&:hover": { bgcolor: alpha(tokens.burgundy, 0.055) },
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          mr: 1.25,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          color: tokens.burgundy,
          bgcolor: alpha(tokens.burgundy, 0.09),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 900 }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {helper}
        </Typography>
      </Box>
    </Button>
  );
}

function AccountState({
  business,
  onReviewPayments,
  onOpenAudit,
}: {
  business: AdminBusiness;
  onReviewPayments: () => void;
  onOpenAudit: () => void;
}) {
  return (
    <Stack
      component="aside"
      spacing={2}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: alpha(tokens.ink, 0.025),
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
      }}
    >
      <Box>
        <Typography variant="h6">Account state</Typography>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ mt: 1.25, flexWrap: "wrap", rowGap: 0.75 }}
        >
          <StatusChip status={business.status} />
          <RiskChip level={business.riskLevel} />
          <Chip size="small" label={business.plan} variant="outlined" />
        </Stack>
        <Typography variant="body2" sx={{ mt: 1.25, color: "text.secondary" }}>
          {business.verificationStatus === "verified"
            ? "Identity checks are complete."
            : "Verification is incomplete. Contact the owner to help finish setup."}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
          {business.subaccountRef
            ? "Payout account is provisioned."
            : "Payout account has not been provisioned."}
        </Typography>
      </Box>
      <Divider />
      <Stack spacing={0.5}>
        <QuickRoute
          icon={<PaymentsRounded fontSize="small" />}
          title="Payments"
          helper="Review money movement"
          onClick={onReviewPayments}
        />
        <QuickRoute
          icon={<HistoryRounded fontSize="small" />}
          title="Audit trail"
          helper="See operator actions"
          onClick={onOpenAudit}
        />
      </Stack>
    </Stack>
  );
}

export function BusinessOverviewPanel({
  business,
  onReviewPayments,
  onOpenAudit,
}: {
  business: AdminBusiness;
  onReviewPayments: () => void;
  onOpenAudit: () => void;
}) {
  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2.25 },
          borderRadius: 2,
          bgcolor: alpha(tokens.burgundy, 0.035),
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.1),
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            md: "repeat(4, minmax(0, 1fr))",
          },
          rowGap: 1.5,
        }}
      >
        <Metric label="Orders" value={String(business.orders)} helper="All-time" />
        <Metric
          label="Gross volume"
          value={formatGHS(business.gmvMinor)}
          helper="Processed sales"
        />
        <Metric
          label="Commission"
          value={formatGHS(business.commissionMinor)}
          helper="Platform earnings"
        />
        <Metric
          label="Last active"
          value={shortTimeOrFallback(business.lastActive, "Unknown")}
          helper="Latest touch"
        />
      </Paper>
      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 1.35fr) minmax(280px, .65fr)",
          },
          alignItems: "start",
        }}
      >
        <Stack spacing={3}>
          <OwnerContacts business={business} />
          <BusinessRecord business={business} />
        </Stack>
        <AccountState
          business={business}
          onReviewPayments={onReviewPayments}
          onOpenAudit={onOpenAudit}
        />
      </Box>
    </Stack>
  );
}
