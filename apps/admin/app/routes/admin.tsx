import { Form, redirect } from "react-router";
import { useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import CancelRounded from "@mui/icons-material/CancelRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import NotesRounded from "@mui/icons-material/NotesRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import type { Route } from "./+types/admin";
import {
  auditEvents,
  businesses,
  payoutReviews,
  platformMetrics,
  riskReviews,
  supportTickets,
  verificationCases,
  webhookEvents,
  type AuditEvent,
  type AuditSeverity,
  type BusinessRecord,
  type PayoutStatus,
  type RiskLevel,
  type VerificationCase,
  type VerificationStatus,
  type WebhookStatus,
} from "../mocks/admin";
import { logOut, requireAdmin } from "../lib/session";
import { tokens } from "../theme";

type Section =
  | "overview"
  | "verification"
  | "businesses"
  | "money"
  | "risk"
  | "support"
  | "audit";
type Decision = "approved" | "rejected" | "held";
type StatusFilter = "all" | VerificationStatus;
type AuditFilter = "all" | AuditSeverity;

type AdminNavItem = {
  id: Section;
  label: string;
  helper: string;
  icon: ReactNode;
};

const adminRailWidth = 296;

const navItems: AdminNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    helper: "Platform pulse",
    icon: <TrendingUpRounded />,
  },
  {
    id: "verification",
    label: "Verification",
    helper: "KYC decisions",
    icon: <VerifiedUserRounded />,
  },
  {
    id: "businesses",
    label: "Businesses",
    helper: "Tenant control",
    icon: <StorefrontRounded />,
  },
  {
    id: "money",
    label: "Money rails",
    helper: "Paystack watch",
    icon: <PaymentsRounded />,
  },
  {
    id: "risk",
    label: "Risk",
    helper: "Trust review",
    icon: <ShieldRounded />,
  },
  {
    id: "support",
    label: "Support",
    helper: "Customer issues",
    icon: <SupportAgentRounded />,
  },
  {
    id: "audit",
    label: "Audit log",
    helper: "Operator trail",
    icon: <HistoryRounded />,
  },
];

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

const auditFilters: { value: AuditFilter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

const ghs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Admin console · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireAdmin(request);
  return { admin };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (String(form.get("intent") ?? "") === "logout") {
    return logOut(request);
  }
  return redirect("/admin");
}

function formatGHS(minor: number): string {
  return ghs.format(minor / 100);
}

function riskColor(level: RiskLevel): string {
  switch (level) {
    case "high":
      return tokens.danger;
    case "medium":
      return tokens.warning;
    default:
      return tokens.success;
  }
}

function statusColor(status: VerificationStatus): string {
  switch (status) {
    case "verified":
      return tokens.success;
    case "pending":
      return tokens.warning;
    case "suspended":
      return tokens.danger;
    default:
      return tokens.mutedText;
  }
}

function webhookColor(status: WebhookStatus): string {
  switch (status) {
    case "verified":
      return tokens.success;
    case "replayed":
      return tokens.info;
    default:
      return tokens.danger;
  }
}

function payoutColor(status: PayoutStatus): string {
  switch (status) {
    case "ready":
      return tokens.success;
    case "review":
      return tokens.warning;
    default:
      return tokens.danger;
  }
}

function auditColor(severity: AuditSeverity): string {
  switch (severity) {
    case "critical":
      return tokens.danger;
    case "warning":
      return tokens.warning;
    default:
      return tokens.info;
  }
}

function shortTime(value: string): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Panel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: 2,
        bgcolor: alpha(tokens.white, 0.96),
        backgroundImage: `linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})`,
        boxShadow: `0 22px 60px ${alpha(tokens.ink, 0.065)}`,
        backdropFilter: "blur(10px)",
        overflow: "hidden",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "adminSurfaceIn 420ms ease both",
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function MetricCard({
  label,
  value,
  helper,
  trend,
}: {
  label: string;
  value: string;
  helper: string;
  trend: string;
}) {
  return (
    <Panel
      sx={{
        p: 2.5,
        minHeight: 176,
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        borderColor: alpha(tokens.burgundy, 0.16),
        backgroundImage: `
          radial-gradient(circle at 88% 18%, ${alpha(tokens.warning, 0.18)} 0, transparent 30%),
          linear-gradient(135deg, ${alpha(tokens.burgundy, 0.1)}, transparent 48%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.74)})
        `,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto auto 0",
          height: 3,
          width: "100%",
          bgcolor: tokens.burgundy,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          right: -22,
          bottom: -28,
          width: 104,
          height: 104,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: alpha(tokens.burgundy, 0.12),
          boxShadow: `inset 0 0 0 18px ${alpha(tokens.white, 0.42)}`,
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(tokens.burgundy, 0.28),
          boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.11)}`,
        },
      }}
    >
      <Stack spacing={1.2} sx={{ position: "relative", zIndex: 1, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 900,
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          {label}
        </Typography>
        <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
          {value}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "flex-end",
            justifyContent: "space-between",
            mt: "auto",
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", maxWidth: 180 }}
          >
            {helper}
          </Typography>
          <Chip
            size="small"
            label={trend}
            sx={{
              bgcolor: alpha(tokens.success, 0.12),
              color: tokens.success,
              border: "1px solid",
              borderColor: alpha(tokens.success, 0.22),
            }}
          />
        </Stack>
      </Stack>
    </Panel>
  );
}

function RiskChip({ level }: { level: RiskLevel }) {
  return (
    <Chip
      size="small"
      label={`${level} risk`}
      sx={{
        bgcolor: alpha(riskColor(level), 0.12),
        color: riskColor(level),
        border: "1px solid",
        borderColor: alpha(riskColor(level), 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}

function StatusChip({ status }: { status: VerificationStatus }) {
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        bgcolor: alpha(statusColor(status), 0.12),
        color: statusColor(status),
        border: "1px solid",
        borderColor: alpha(statusColor(status), 0.24),
        textTransform: "capitalize",
      }}
    />
  );
}

function decisionLabel(decision: Decision): string {
  switch (decision) {
    case "approved":
      return "Approved in this review";
    case "rejected":
      return "Rejected in this review";
    default:
      return "Held for follow-up";
  }
}

function VerificationCard({
  item,
  decision,
  note,
  onNoteChange,
  onDecide,
}: {
  item: VerificationCase;
  decision?: Decision;
  note: string;
  onNoteChange: (id: string, value: string) => void;
  onDecide: (id: string, nextDecision: Decision) => void;
}) {
  const accent = riskColor(item.riskLevel);

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        position: "relative",
        borderColor: alpha(accent, 0.2),
        backgroundImage: `
          linear-gradient(135deg, ${alpha(accent, 0.08)}, transparent 38%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
        `,
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(accent, 0.34),
          boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
        },
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography variant="h6">{item.businessName}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {item.handle}.xtiitch.com · {item.ownerName} · {item.ownerEmail}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <RiskChip level={item.riskLevel} />
            <Chip size="small" label={item.plan} variant="outlined" />
          </Stack>
        </Stack>
        <Typography sx={{ color: "text.secondary" }}>{item.notes}</Typography>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <Box
            sx={{
              p: 1.5,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
              borderRadius: 1.5,
              bgcolor: alpha(tokens.white, 0.62),
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Documents
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", gap: 1 }}
            >
              {item.documents.map((documentName) => (
                <Chip
                  key={documentName}
                  size="small"
                  icon={<ReceiptLongRounded />}
                  label={documentName}
                />
              ))}
            </Stack>
          </Box>
          <Box
            sx={{
              p: 1.5,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
              borderRadius: 1.5,
              bgcolor: alpha(tokens.white, 0.62),
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Checks
            </Typography>
            <Stack spacing={0.75}>
              {item.checks.map((check) => (
                <Stack
                  key={check}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center" }}
                >
                  <CheckCircleRounded
                    sx={{ color: tokens.success, fontSize: 18 }}
                  />
                  <Typography variant="body2">{check}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <Box
            sx={{
              p: 1.5,
              border: "1px solid",
              borderColor: alpha(tokens.ink, 0.08),
              borderRadius: 1.5,
              bgcolor: alpha(tokens.white, 0.62),
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Evidence
            </Typography>
            <Stack spacing={0.75}>
              {item.evidence.map((line) => (
                <Stack
                  key={line}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "flex-start" }}
                >
                  <NotesRounded
                    sx={{ color: tokens.info, fontSize: 18, mt: 0.2 }}
                  />
                  <Typography variant="body2">{line}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
          <TextField
            label="Operator note"
            value={note}
            onChange={(event) => onNoteChange(item.id, event.target.value)}
            placeholder="Record why this case is approved, rejected, or held."
            multiline
            minRows={3}
            fullWidth
          />
        </Box>
        <Divider />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Submitted {shortTime(item.submittedAt)}
          </Typography>
          {decision ? (
            <Chip
              icon={
                decision === "approved" ? (
                  <CheckCircleRounded />
                ) : decision === "rejected" ? (
                  <CancelRounded />
                ) : (
                  <BlockRounded />
                )
              }
              label={decisionLabel(decision)}
              sx={{
                bgcolor: alpha(
                  decision === "approved"
                    ? tokens.success
                    : decision === "rejected"
                      ? tokens.danger
                      : tokens.warning,
                  0.12,
                ),
              }}
            />
          ) : (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelRounded />}
                onClick={() => onDecide(item.id, "rejected")}
              >
                Reject
              </Button>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<BlockRounded />}
                onClick={() => onDecide(item.id, "held")}
              >
                Hold
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckCircleRounded />}
                onClick={() => onDecide(item.id, "approved")}
              >
                Approve
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Panel>
  );
}

function BusinessRow({
  business,
  status,
  selected,
  onInspect,
  onToggle,
}: {
  business: BusinessRecord;
  status: VerificationStatus;
  selected: boolean;
  onInspect: (business: BusinessRecord) => void;
  onToggle: (id: string, nextStatus: VerificationStatus) => void;
}) {
  const isSuspended = status === "suspended";
  const accent = statusColor(status);

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
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
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
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(220px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto",
          },
          alignItems: "center",
        }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {business.name}
            </Typography>
            <StatusChip status={status} />
            <RiskChip level={business.riskLevel} />
          </Stack>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
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
            onClick={() =>
              onToggle(business.id, isSuspended ? "verified" : "suspended")
            }
          >
            {isSuspended ? "Reactivate" : "Suspend"}
          </Button>
        </Stack>
      </Box>
    </Panel>
  );
}

function BusinessInspector({
  business,
  status,
  onReviewPayments,
  onOpenAudit,
  onClose,
}: {
  business: BusinessRecord | null;
  status?: VerificationStatus;
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
            linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
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

  const accent = statusColor(status ?? business.status);

  return (
    <Panel
      sx={{
        p: 2.5,
        position: { xl: "sticky" },
        top: { xl: 118 },
        borderColor: alpha(accent, 0.24),
        backgroundImage: `
          radial-gradient(circle at 95% 5%, ${alpha(accent, 0.14)}, transparent 32%),
          linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
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
          <StatusChip status={status ?? business.status} />
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
        </Stack>
        <Divider />
        <Stack spacing={1}>
          <Typography variant="subtitle2">Admin-safe actions</Typography>
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
          >
            View public storefront
          </Button>
        </Stack>
      </Stack>
    </Panel>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ justifyContent: "space-between", gap: 2 }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 800, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function AdminRail({
  adminEmail,
  adminRole,
  section,
  pendingCount,
  urgentTickets,
  onSelect,
}: {
  adminEmail: string;
  adminRole: string;
  section: Section;
  pendingCount: number;
  urgentTickets: number;
  onSelect: (section: Section) => void;
}) {
  const navBadge = (id: Section): string | null => {
    if (id === "verification" && pendingCount > 0) {
      return String(pendingCount);
    }
    if (id === "support" && urgentTickets > 0) {
      return String(urgentTickets);
    }
    if (id === "risk") {
      return String(riskReviews.length);
    }
    return null;
  };

  return (
    <Box
      component="aside"
      sx={{
        borderRight: { lg: "1px solid" },
        borderBottom: { xs: "1px solid", lg: "none" },
        borderColor: alpha(tokens.white, 0.12),
        bgcolor: tokens.charcoal,
        color: tokens.white,
        position: { xs: "sticky", lg: "fixed" },
        inset: { lg: "0 auto 0 0" },
        top: 0,
        width: { lg: adminRailWidth },
        height: { lg: "100vh" },
        zIndex: 10,
        overflowX: { xs: "auto", lg: "hidden" },
        overflowY: { lg: "auto" },
        boxShadow: { lg: `18px 0 55px ${alpha(tokens.ink, 0.22)}` },
        backgroundImage: `
          linear-gradient(${alpha(tokens.white, 0.055)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha(tokens.white, 0.055)} 1px, transparent 1px),
          linear-gradient(160deg, ${alpha(tokens.burgundy, 0.42)}, transparent 46%)
        `,
        backgroundSize: "34px 34px, 34px 34px, auto",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: {
            xs: "adminRailDrop 360ms ease both",
            lg: "adminRailSlide 520ms cubic-bezier(.2,.8,.2,1) both",
          },
        },
      }}
    >
      <Stack
        spacing={{ xs: 1, lg: 2 }}
        sx={{
          minWidth: { xs: 980, lg: "auto" },
          minHeight: { lg: "100%" },
          p: { xs: 1.25, lg: 1.5 },
        }}
      >
        <Box
          sx={{
            p: { xs: 0.75, lg: 1 },
            border: "1px solid",
            borderColor: alpha(tokens.white, 0.12),
            borderRadius: 2,
            bgcolor: alpha(tokens.white, 0.075),
            backdropFilter: "blur(14px)",
            minWidth: { xs: 260, lg: "auto" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: tokens.burgundy,
                boxShadow: `0 16px 42px ${alpha(tokens.burgundy, 0.36)}`,
                flexShrink: 0,
              }}
            >
              <AdminPanelSettingsRounded />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }} noWrap>
                Xtiitch Admin
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: alpha(tokens.white, 0.68), fontWeight: 800 }}
                noWrap
              >
                {adminEmail}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
            <Chip
              size="small"
              icon={<ShieldRounded />}
              label={adminRole}
              sx={{
                textTransform: "capitalize",
                color: tokens.white,
                bgcolor: alpha(tokens.white, 0.11),
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.16),
                "& .MuiChip-icon": { color: alpha(tokens.white, 0.78) },
              }}
            />
            <Chip
              size="small"
              label={`${pendingCount} KYC`}
              sx={{
                color: tokens.white,
                bgcolor: alpha(tokens.warning, 0.28),
                border: "1px solid",
                borderColor: alpha(tokens.warning, 0.36),
              }}
            />
          </Stack>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Typography
            variant="caption"
            sx={{
              display: { xs: "none", lg: "block" },
              px: 1,
              color: alpha(tokens.white, 0.58),
              fontWeight: 900,
              textTransform: "uppercase",
            }}
          >
            Console
          </Typography>
          <List
            sx={{
              p: 0,
              mt: { xs: 0, lg: 0.85 },
              display: { xs: "flex", lg: "grid" },
              gap: 0.65,
            }}
          >
            {navItems.map((item) => {
              const selected = item.id === section;
              const badge = navBadge(item.id);
              return (
                <ListItemButton
                  key={item.id}
                  selected={selected}
                  onClick={() => onSelect(item.id)}
                  sx={{
                    borderRadius: 1.5,
                    minWidth: { xs: 176, lg: "auto" },
                    minHeight: 52,
                    position: "relative",
                    overflow: "hidden",
                    color: tokens.white,
                    border: "1px solid",
                    borderColor: selected
                      ? alpha(tokens.white, 0.18)
                      : "transparent",
                    bgcolor: selected
                      ? alpha(tokens.white, 0.13)
                      : alpha(tokens.white, 0.035),
                    transition:
                      "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: 4,
                      bgcolor: selected ? tokens.warning : "transparent",
                    },
                    "&.Mui-selected": {
                      bgcolor: alpha(tokens.white, 0.13),
                    },
                    "&.Mui-selected:hover, &:hover": {
                      bgcolor: alpha(tokens.white, 0.17),
                      transform: "translateX(2px)",
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 38,
                      color: selected
                        ? tokens.white
                        : alpha(tokens.white, 0.62),
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      component="span"
                      sx={{
                        display: "block",
                        fontWeight: selected ? 900 : 760,
                        fontSize: 14,
                      }}
                      noWrap
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        display: { xs: "none", lg: "block" },
                        color: alpha(tokens.white, 0.56),
                      }}
                      noWrap
                    >
                      {item.helper}
                    </Typography>
                  </Box>
                  {badge ? (
                    <Chip
                      size="small"
                      label={badge}
                      sx={{
                        height: 22,
                        color: tokens.white,
                        bgcolor: alpha(tokens.burgundy, 0.72),
                        border: "1px solid",
                        borderColor: alpha(tokens.white, 0.14),
                      }}
                    />
                  ) : null}
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <Form method="post">
            <input type="hidden" name="intent" value="logout" />
            <Button
              type="submit"
              color="inherit"
              startIcon={<LogoutRounded />}
              fullWidth
              sx={{
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.16),
                bgcolor: alpha(tokens.white, 0.06),
                "&:hover": { bgcolor: alpha(tokens.white, 0.12) },
              }}
            >
              Sign out
            </Button>
          </Form>
        </Box>
      </Stack>
    </Box>
  );
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const { admin } = loaderData;
  const [section, setSection] = useState<Section>("overview");
  const [verificationDecisions, setVerificationDecisions] = useState<
    Record<string, Decision>
  >({});
  const [verificationNotes, setVerificationNotes] = useState<
    Record<string, string>
  >({});
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, VerificationStatus>
  >({});
  const [businessQuery, setBusinessQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessRecord | null>(businesses[0] ?? null);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(auditEvents);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [closedRisks, setClosedRisks] = useState<Record<string, boolean>>({});
  const [assignedTickets, setAssignedTickets] = useState<
    Record<string, string>
  >({});
  const [replayedWebhooks, setReplayedWebhooks] = useState<
    Record<string, boolean>
  >({});
  const [heldPayouts, setHeldPayouts] = useState<Record<string, boolean>>({});

  const pendingCount = verificationCases.filter(
    (item) => !verificationDecisions[item.id],
  ).length;
  const urgentTickets = supportTickets.filter(
    (ticket) => ticket.priority === "urgent",
  ).length;

  const filteredBusinesses = useMemo(() => {
    const query = businessQuery.trim().toLowerCase();
    return businesses.filter((business) => {
      const status = statusOverrides[business.id] ?? business.status;
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesQuery =
        !query ||
        business.name.toLowerCase().includes(query) ||
        business.handle.toLowerCase().includes(query) ||
        business.ownerEmail.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [businessQuery, statusFilter, statusOverrides]);

  const filteredAuditLog = useMemo(() => {
    if (auditFilter === "all") {
      return auditLog;
    }
    return auditLog.filter((event) => event.severity === auditFilter);
  }, [auditFilter, auditLog]);

  const appendAudit = (
    action: string,
    target: string,
    detail: string,
    severity: AuditSeverity = "info",
  ) => {
    setAuditLog((current) => [
      {
        id: `audit-local-${Date.now()}`,
        actor: admin.adminEmail,
        action,
        target,
        detail,
        createdAt: new Date().toISOString(),
        severity,
      },
      ...current,
    ]);
  };

  const decideVerification = (id: string, nextDecision: Decision) => {
    setVerificationDecisions((current) => ({ ...current, [id]: nextDecision }));
    const item = verificationCases.find(
      (verificationCase) => verificationCase.id === id,
    );
    const note = verificationNotes[id]?.trim();
    appendAudit(
      nextDecision === "approved"
        ? "Approved verification"
        : nextDecision === "rejected"
          ? "Rejected verification"
          : "Held verification",
      item?.businessName ?? id,
      note ||
        item?.notes ||
        "Operator decision recorded from the verification queue.",
      nextDecision === "approved"
        ? "info"
        : nextDecision === "rejected"
          ? "critical"
          : "warning",
    );
  };

  const toggleBusinessStatus = (id: string, nextStatus: VerificationStatus) => {
    setStatusOverrides((current) => ({ ...current, [id]: nextStatus }));
    const business = businesses.find((item) => item.id === id);
    appendAudit(
      nextStatus === "suspended"
        ? "Suspended business"
        : "Reactivated business",
      business?.name ?? id,
      nextStatus === "suspended"
        ? "Operator suspended tenant activity pending review."
        : "Operator restored tenant activity after review.",
      nextStatus === "suspended" ? "critical" : "info",
    );
  };

  const updateVerificationNote = (id: string, value: string) => {
    setVerificationNotes((current) => ({ ...current, [id]: value }));
  };

  const closeRiskReview = (id: string) => {
    const next = !closedRisks[id];
    const review = riskReviews.find((item) => item.id === id);
    setClosedRisks((current) => ({ ...current, [id]: next }));
    appendAudit(
      next ? "Closed risk review" : "Reopened risk review",
      review?.business ?? id,
      review?.title ?? id,
      next ? "info" : "warning",
    );
  };

  const assignTicket = (id: string) => {
    const ticket = supportTickets.find((item) => item.id === id);
    const assigned = assignedTickets[id] === admin.adminEmail;
    setAssignedTickets((current) => ({
      ...current,
      [id]: assigned ? "" : admin.adminEmail,
    }));
    appendAudit(
      assigned ? "Unassigned support ticket" : "Assigned support ticket",
      ticket?.id ?? id,
      ticket?.subject ?? "Support assignment changed.",
      ticket?.priority === "urgent" ? "warning" : "info",
    );
  };

  const replayWebhook = (id: string) => {
    setReplayedWebhooks((current) => ({ ...current, [id]: true }));
    const webhook = webhookEvents.find((item) => item.id === id);
    appendAudit(
      "Queued webhook replay",
      webhook?.providerReference ?? id,
      webhook?.note ?? "Operator queued a webhook replay.",
      "warning",
    );
  };

  const togglePayoutHold = (id: string) => {
    const payout = payoutReviews.find((item) => item.id === id);
    const current = heldPayouts[id] ?? payout?.status === "blocked";
    const next = !current;
    setHeldPayouts((current) => ({ ...current, [id]: next }));
    appendAudit(
      next ? "Placed payout hold" : "Released payout hold",
      payout?.business ?? id,
      payout?.nextAction ?? "Payout hold changed.",
      next ? "critical" : "info",
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `
          radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.08)}, transparent 30%),
          radial-gradient(circle at 64% 18%, ${alpha(tokens.info, 0.06)}, transparent 28%),
          linear-gradient(180deg, ${tokens.cream}, ${alpha(tokens.panel, 0.78)})
        `,
        "@keyframes adminRailSlide": {
          from: { opacity: 0, transform: "translateX(-18px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "@keyframes adminRailDrop": {
          from: { opacity: 0, transform: "translateY(-10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes adminSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <AdminRail
        adminEmail={admin.adminEmail}
        adminRole={admin.adminRole}
        section={section}
        pendingCount={pendingCount}
        urgentTickets={urgentTickets}
        onSelect={setSection}
      />
      <Box
        component="main"
        sx={{
          minWidth: 0,
          ml: { lg: `${adminRailWidth}px` },
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "adminSurfaceIn 520ms ease both",
          },
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 4 },
            py: 2,
            borderBottom: "1px solid",
            borderColor: alpha(tokens.ink, 0.09),
            bgcolor: alpha(tokens.white, 0.82),
            backgroundImage: `linear-gradient(90deg, ${alpha(tokens.white, 0.94)}, ${alpha(tokens.panel, 0.72)})`,
            position: { xs: "relative", lg: "sticky" },
            top: 0,
            zIndex: 2,
            backdropFilter: "blur(12px)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{
              alignItems: { md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "primary.main", fontWeight: 900 }}
              >
                admin.xtiitch.com
              </Typography>
              <Typography variant="h4" component="h1">
                Platform operations
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Chip
                icon={<ShieldRounded />}
                label={admin.adminRole}
                variant="outlined"
                sx={{ textTransform: "capitalize" }}
              />
              <Chip
                label={admin.adminEmail}
                sx={{
                  bgcolor: alpha(tokens.burgundy, 0.1),
                  color: tokens.burgundy,
                }}
              />
              <Form method="post" style={{ display: "contents" }}>
                <input type="hidden" name="intent" value="logout" />
                <Button
                  type="submit"
                  variant="outlined"
                  startIcon={<LogoutRounded />}
                  sx={{ display: { xs: "inline-flex", lg: "none" } }}
                >
                  Sign out
                </Button>
              </Form>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
          {section === "overview" ? (
            <Stack spacing={3}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, 1fr)",
                    xl: "repeat(4, 1fr)",
                  },
                }}
              >
                {platformMetrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gap: 3,
                  gridTemplateColumns: { xs: "1fr", xl: "1.25fr 0.75fr" },
                }}
              >
                <Panel sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{ justifyContent: "space-between", mb: 2 }}
                  >
                    <Box>
                      <Typography variant="h6">Verification queue</Typography>
                      <Typography sx={{ color: "text.secondary" }}>
                        {pendingCount} businesses need an operator decision
                        before money rails are enabled.
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      endIcon={<ArrowForwardRounded />}
                      onClick={() => setSection("verification")}
                    >
                      Review queue
                    </Button>
                  </Stack>
                  <Stack spacing={1.5}>
                    {verificationCases.slice(0, 2).map((item) => (
                      <Stack
                        key={item.id}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{
                          alignItems: { sm: "center" },
                          justifyContent: "space-between",
                          p: 1.5,
                          border: "1px solid",
                          borderColor: alpha(riskColor(item.riskLevel), 0.2),
                          borderRadius: 1.5,
                          bgcolor: alpha(tokens.white, 0.72),
                          backgroundImage: `linear-gradient(90deg, ${alpha(
                            riskColor(item.riskLevel),
                            0.08,
                          )}, transparent 34%)`,
                          transition:
                            "transform 180ms ease, border-color 180ms ease",
                          "&:hover": {
                            transform: "translateX(3px)",
                            borderColor: alpha(riskColor(item.riskLevel), 0.34),
                          },
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 900 }}>
                            {item.businessName}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {item.handle}.xtiitch.com · {item.documents.length}{" "}
                            docs
                          </Typography>
                        </Box>
                        <RiskChip level={item.riskLevel} />
                      </Stack>
                    ))}
                  </Stack>
                </Panel>

                <Panel
                  sx={{
                    p: { xs: 2, md: 3 },
                    borderColor: alpha(tokens.info, 0.16),
                    backgroundImage: `
                      radial-gradient(circle at 92% 0%, ${alpha(tokens.info, 0.14)}, transparent 34%),
                      linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                    `,
                  }}
                >
                  <Stack spacing={2}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{ alignItems: "center" }}
                    >
                      <PaymentsRounded sx={{ color: tokens.burgundy }} />
                      <Box>
                        <Typography variant="h6">Money rail watch</Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          Paystack subaccounts, webhooks, and commission
                          settlement.
                        </Typography>
                      </Box>
                    </Stack>
                    <Divider />
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>Webhook failures</Typography>
                        <Typography
                          sx={{ fontWeight: 900, color: tokens.warning }}
                        >
                          3 open
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>Suspended stores</Typography>
                        <Typography
                          sx={{ fontWeight: 900, color: tokens.danger }}
                        >
                          1 active
                        </Typography>
                      </Stack>
                      <Stack
                        direction="row"
                        sx={{ justifyContent: "space-between" }}
                      >
                        <Typography>Urgent support</Typography>
                        <Typography sx={{ fontWeight: 900 }}>
                          {urgentTickets}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Panel>
              </Box>
            </Stack>
          ) : null}

          {section === "verification" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="KYC and business review"
                title="Payment verification queue"
                helper="Approve only when business identity, settlement account, and operator notes are clean."
              />
              {verificationCases.map((item) => (
                <VerificationCard
                  key={item.id}
                  item={item}
                  decision={verificationDecisions[item.id]}
                  note={verificationNotes[item.id] ?? ""}
                  onNoteChange={updateVerificationNote}
                  onDecide={decideVerification}
                />
              ))}
            </Stack>
          ) : null}

          {section === "businesses" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Tenant operations"
                title="Businesses"
                helper="Search stores, monitor GMV and commission, and suspend risky tenants without touching customer data."
              />
              <Panel sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                  <TextField
                    label="Search business"
                    value={businessQuery}
                    onChange={(event) => setBusinessQuery(event.target.value)}
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRounded />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <TextField
                    select
                    label="Status"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                    sx={{ minWidth: { md: 220 } }}
                  >
                    {statusFilters.map((filter) => (
                      <MenuItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Panel>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: {
                    xs: "1fr",
                    xl: "minmax(0, 1fr) 380px",
                  },
                }}
              >
                <Stack spacing={1.5}>
                  {filteredBusinesses.map((business) => (
                    <BusinessRow
                      key={business.id}
                      business={business}
                      status={statusOverrides[business.id] ?? business.status}
                      selected={selectedBusiness?.id === business.id}
                      onInspect={setSelectedBusiness}
                      onToggle={toggleBusinessStatus}
                    />
                  ))}
                  {filteredBusinesses.length === 0 ? (
                    <Panel sx={{ p: 3, textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 800 }}>
                        No businesses match this view.
                      </Typography>
                      <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                        Clear the search or choose another status.
                      </Typography>
                    </Panel>
                  ) : null}
                </Stack>
                <BusinessInspector
                  business={selectedBusiness}
                  status={
                    selectedBusiness
                      ? (statusOverrides[selectedBusiness.id] ??
                        selectedBusiness.status)
                      : undefined
                  }
                  onReviewPayments={() => setSection("money")}
                  onOpenAudit={() => setSection("audit")}
                  onClose={() => setSelectedBusiness(null)}
                />
              </Box>
            </Stack>
          ) : null}

          {section === "money" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Paystack operations"
                title="Money rails"
                helper="Watch webhook delivery, split settlement, subaccount health, and payout holds without touching tenant funds."
              />
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", xl: "1.08fr 0.92fr" },
                }}
              >
                <Panel
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderColor: alpha(tokens.info, 0.16),
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", mb: 2 }}
                  >
                    <SyncRounded sx={{ color: tokens.burgundy }} />
                    <Box>
                      <Typography variant="h6">Webhook ledger</Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        Verified events, failed lookups, and safe replays.
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1.5}>
                    {webhookEvents.map((event) => {
                      const replayed = replayedWebhooks[event.id];
                      return (
                        <Box
                          key={event.id}
                          sx={{
                            p: 1.5,
                            border: "1px solid",
                            borderColor: alpha(
                              replayed
                                ? tokens.info
                                : webhookColor(event.status),
                              0.2,
                            ),
                            borderRadius: 1.5,
                            bgcolor: alpha(tokens.white, 0.7),
                            backgroundImage: `linear-gradient(90deg, ${alpha(
                              replayed
                                ? tokens.info
                                : webhookColor(event.status),
                              0.075,
                            )}, transparent 36%)`,
                            transition:
                              "transform 180ms ease, border-color 180ms ease",
                            "&:hover": {
                              transform: "translateX(3px)",
                              borderColor: alpha(
                                replayed
                                  ? tokens.info
                                  : webhookColor(event.status),
                                0.34,
                              ),
                            },
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={1.5}
                            sx={{ justifyContent: "space-between" }}
                          >
                            <Box>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: "center", flexWrap: "wrap" }}
                              >
                                <Typography sx={{ fontWeight: 900 }}>
                                  {event.providerReference}
                                </Typography>
                                <Chip
                                  size="small"
                                  label={
                                    replayed ? "replay queued" : event.status
                                  }
                                  sx={{
                                    bgcolor: alpha(
                                      replayed
                                        ? tokens.info
                                        : webhookColor(event.status),
                                      0.12,
                                    ),
                                    color: replayed
                                      ? tokens.info
                                      : webhookColor(event.status),
                                    textTransform: "capitalize",
                                  }}
                                />
                              </Stack>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", mt: 0.5 }}
                              >
                                {event.business} · {event.purpose} ·{" "}
                                {formatGHS(event.amountMinor)} ·{" "}
                                {event.attempts} attempts
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                {event.note}
                              </Typography>
                            </Box>
                            <Stack
                              spacing={1}
                              sx={{ alignItems: { md: "flex-end" } }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 800,
                                }}
                              >
                                {shortTime(event.receivedAt)}
                              </Typography>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<SyncRounded />}
                                disabled={
                                  event.status === "verified" || replayed
                                }
                                onClick={() => replayWebhook(event.id)}
                              >
                                Replay
                              </Button>
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Panel>

                <Panel
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    borderColor: alpha(tokens.warning, 0.16),
                    backgroundImage: `
                      radial-gradient(circle at 92% 2%, ${alpha(tokens.warning, 0.14)}, transparent 34%),
                      linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                    `,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", mb: 2 }}
                  >
                    <AccountBalanceRounded sx={{ color: tokens.burgundy }} />
                    <Box>
                      <Typography variant="h6">Settlement review</Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        Subaccount status and operator holds.
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={1.5}>
                    {payoutReviews.map((review) => {
                      const held =
                        heldPayouts[review.id] ?? review.status === "blocked";
                      return (
                        <Box
                          key={review.id}
                          sx={{
                            p: 1.5,
                            border: "1px solid",
                            borderColor: held
                              ? alpha(tokens.danger, 0.32)
                              : alpha(payoutColor(review.status), 0.2),
                            borderRadius: 1.5,
                            bgcolor: held
                              ? alpha(tokens.danger, 0.04)
                              : alpha(tokens.white, 0.72),
                            backgroundImage: `linear-gradient(90deg, ${alpha(
                              held ? tokens.danger : payoutColor(review.status),
                              0.075,
                            )}, transparent 38%)`,
                            transition:
                              "transform 180ms ease, border-color 180ms ease",
                            "&:hover": {
                              transform: "translateX(3px)",
                              borderColor: alpha(
                                held
                                  ? tokens.danger
                                  : payoutColor(review.status),
                                0.34,
                              ),
                            },
                          }}
                        >
                          <Stack spacing={1.25}>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <Box>
                                <Typography sx={{ fontWeight: 900 }}>
                                  {review.business}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  sx={{ color: "text.secondary" }}
                                >
                                  {review.subaccountRef}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={held ? "held" : review.status}
                                sx={{
                                  bgcolor: alpha(
                                    held
                                      ? tokens.danger
                                      : payoutColor(review.status),
                                    0.12,
                                  ),
                                  color: held
                                    ? tokens.danger
                                    : payoutColor(review.status),
                                  textTransform: "capitalize",
                                }}
                              />
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: "space-between" }}
                            >
                              <Typography variant="body2">
                                Settlement
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 900 }}
                              >
                                {formatGHS(review.settlementMinor)}
                              </Typography>
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ justifyContent: "space-between" }}
                            >
                              <Typography variant="body2">
                                Commission
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 900 }}
                              >
                                {formatGHS(review.commissionMinor)}
                              </Typography>
                            </Stack>
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {review.nextAction}
                            </Typography>
                            <Button
                              variant={held ? "contained" : "outlined"}
                              color={held ? "primary" : "error"}
                              size="small"
                              startIcon={
                                held ? <CheckCircleRounded /> : <BlockRounded />
                              }
                              onClick={() => togglePayoutHold(review.id)}
                            >
                              {held ? "Release hold" : "Place hold"}
                            </Button>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Panel>
              </Box>
            </Stack>
          ) : null}

          {section === "risk" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Trust and compliance"
                title="Risk review"
                helper="Open issues for payment integrity, tenant isolation evidence, complaints, and manual escalation."
              />
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", xl: "repeat(3, 1fr)" },
                }}
              >
                {riskReviews.map((item) => (
                  <Panel
                    key={item.id}
                    sx={{
                      p: 2.5,
                      minHeight: "100%",
                      borderColor: alpha(riskColor(item.level), 0.22),
                      backgroundImage: `
                        radial-gradient(circle at 100% 0%, ${alpha(riskColor(item.level), 0.12)}, transparent 34%),
                        linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                      `,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: alpha(riskColor(item.level), 0.36),
                        boxShadow: `0 24px 60px ${alpha(tokens.ink, 0.1)}`,
                      },
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Stack direction="row" spacing={1}>
                          <RiskChip level={item.level} />
                          {closedRisks[item.id] ? (
                            <Chip
                              size="small"
                              label="closed"
                              sx={{ color: tokens.success }}
                            />
                          ) : null}
                        </Stack>
                        <Chip
                          size="small"
                          label={item.owner}
                          variant="outlined"
                        />
                      </Stack>
                      <Box>
                        <Typography variant="h6">{item.title}</Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {item.business}
                        </Typography>
                      </Box>
                      <Typography sx={{ color: "text.secondary" }}>
                        {item.reason}
                      </Typography>
                      <Button
                        variant={
                          closedRisks[item.id] ? "contained" : "outlined"
                        }
                        startIcon={
                          closedRisks[item.id] ? (
                            <CheckCircleRounded />
                          ) : (
                            <PersonSearchRounded />
                          )
                        }
                        onClick={() => closeRiskReview(item.id)}
                      >
                        {closedRisks[item.id]
                          ? "Reopen review"
                          : "Close review"}
                      </Button>
                    </Stack>
                  </Panel>
                ))}
              </Box>
            </Stack>
          ) : null}

          {section === "support" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Operator support"
                title="Support queue"
                helper="Prioritise payment, delivery, and tracking issues before they become trust problems."
              />
              <Stack spacing={1.5}>
                {supportTickets.map((ticket) => (
                  <Panel
                    key={ticket.id}
                    sx={{
                      p: 2.5,
                      borderColor: alpha(
                        ticket.priority === "urgent"
                          ? tokens.danger
                          : tokens.info,
                        ticket.priority === "urgent" ? 0.28 : 0.18,
                      ),
                      backgroundImage: `
                        linear-gradient(90deg, ${alpha(
                          ticket.priority === "urgent"
                            ? tokens.danger
                            : tokens.info,
                          ticket.priority === "urgent" ? 0.09 : 0.06,
                        )}, transparent 38%),
                        linear-gradient(180deg, ${alpha(tokens.white, 0.98)}, ${alpha(tokens.panel, 0.72)})
                      `,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.09)}`,
                      },
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <Typography variant="h6">{ticket.subject}</Typography>
                          <Chip
                            size="small"
                            label={ticket.priority}
                            sx={{
                              bgcolor: alpha(
                                ticket.priority === "urgent"
                                  ? tokens.danger
                                  : tokens.info,
                                0.12,
                              ),
                              color:
                                ticket.priority === "urgent"
                                  ? tokens.danger
                                  : tokens.info,
                              textTransform: "capitalize",
                            }}
                          />
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {ticket.id} · {ticket.business} · waiting {ticket.age}
                        </Typography>
                        <Typography sx={{ mt: 1 }}>{ticket.summary}</Typography>
                        {assignedTickets[ticket.id] ? (
                          <Chip
                            size="small"
                            icon={<AssignmentTurnedInRounded />}
                            label={`Assigned to ${assignedTickets[ticket.id]}`}
                            sx={{
                              mt: 1.5,
                              bgcolor: alpha(tokens.success, 0.1),
                              color: tokens.success,
                            }}
                          />
                        ) : null}
                      </Box>
                      <Button
                        variant={
                          assignedTickets[ticket.id] ? "outlined" : "contained"
                        }
                        startIcon={<SupportAgentRounded />}
                        sx={{ alignSelf: { md: "center" } }}
                        onClick={() => assignTicket(ticket.id)}
                      >
                        {assignedTickets[ticket.id]
                          ? "Unassign"
                          : "Assign to me"}
                      </Button>
                    </Stack>
                  </Panel>
                ))}
              </Stack>
            </Stack>
          ) : null}

          {section === "audit" ? (
            <Stack spacing={2.5}>
              <SectionHeader
                eyebrow="Operator accountability"
                title="Audit log"
                helper="Every sensitive operator decision should be attributable, reviewable, and ready for compliance export."
              />
              <Panel sx={{ p: 2 }}>
                <TextField
                  select
                  label="Severity"
                  value={auditFilter}
                  onChange={(event) =>
                    setAuditFilter(event.target.value as AuditFilter)
                  }
                  sx={{ minWidth: { xs: "100%", sm: 220 } }}
                >
                  {auditFilters.map((filter) => (
                    <MenuItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Panel>
              <Stack spacing={1.5}>
                {filteredAuditLog.map((event) => (
                  <Panel
                    key={event.id}
                    sx={{
                      p: 2,
                      borderColor: alpha(auditColor(event.severity), 0.18),
                      backgroundImage: `linear-gradient(90deg, ${alpha(
                        auditColor(event.severity),
                        0.065,
                      )}, transparent 36%)`,
                      "&:hover": {
                        transform: "translateY(-2px)",
                        borderColor: alpha(auditColor(event.severity), 0.32),
                        boxShadow: `0 18px 48px ${alpha(tokens.ink, 0.085)}`,
                      },
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{ justifyContent: "space-between" }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: "flex-start" }}
                      >
                        <Box
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: 1.5,
                            display: "grid",
                            placeItems: "center",
                            bgcolor: alpha(auditColor(event.severity), 0.12),
                            color: auditColor(event.severity),
                            flex: "0 0 auto",
                          }}
                        >
                          <HistoryRounded />
                        </Box>
                        <Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ alignItems: "center", flexWrap: "wrap" }}
                          >
                            <Typography sx={{ fontWeight: 900 }}>
                              {event.action}
                            </Typography>
                            <Chip
                              size="small"
                              label={event.severity}
                              sx={{
                                bgcolor: alpha(
                                  auditColor(event.severity),
                                  0.12,
                                ),
                                color: auditColor(event.severity),
                                textTransform: "capitalize",
                              }}
                            />
                          </Stack>
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary" }}
                          >
                            {event.target} · {event.actor}
                          </Typography>
                          <Typography sx={{ mt: 0.75 }}>
                            {event.detail}
                          </Typography>
                        </Box>
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shortTime(event.createdAt)}
                      </Typography>
                    </Stack>
                  </Panel>
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function SectionHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper: string;
}) {
  return (
    <Stack
      spacing={0.5}
      sx={{
        position: "relative",
        pl: 2,
        py: 0.35,
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 6,
          bottom: 6,
          width: 4,
          borderRadius: 6,
          bgcolor: tokens.burgundy,
          boxShadow: `0 10px 24px ${alpha(tokens.burgundy, 0.24)}`,
        },
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: "primary.main", fontWeight: 900 }}
      >
        {eyebrow}
      </Typography>
      <Typography variant="h5">{title}</Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>
        {helper}
      </Typography>
    </Stack>
  );
}
