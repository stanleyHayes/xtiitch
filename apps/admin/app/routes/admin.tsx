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
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { alpha, type SxProps, type Theme } from "@mui/material/styles";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CancelRounded from "@mui/icons-material/CancelRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PersonSearchRounded from "@mui/icons-material/PersonSearchRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import type { Route } from "./+types/admin";
import {
  businesses,
  platformMetrics,
  riskReviews,
  supportTickets,
  verificationCases,
  type BusinessRecord,
  type RiskLevel,
  type VerificationCase,
  type VerificationStatus,
} from "../data/admin";
import { logOut, requireAdmin } from "../lib/session";
import { tokens } from "../theme";

type Section = "overview" | "verification" | "businesses" | "risk" | "support";
type Decision = "approved" | "rejected";
type StatusFilter = "all" | VerificationStatus;

const navItems: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <TrendingUpRounded /> },
  { id: "verification", label: "Verification", icon: <VerifiedUserRounded /> },
  { id: "businesses", label: "Businesses", icon: <StorefrontRounded /> },
  { id: "risk", label: "Risk", icon: <ShieldRounded /> },
  { id: "support", label: "Support", icon: <SupportAgentRounded /> },
];

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

const ghs = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 0,
});

export function meta(): Route.MetaDescriptors {
  return [{ title: "Admin console · Xtiitch" }, { name: "robots", content: "noindex" }];
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

function shortTime(value: string): string {
  return new Intl.DateTimeFormat("en-GH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Panel({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: SxProps<Theme>;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function MetricCard({ label, value, helper, trend }: { label: string; value: string; helper: string; trend: string }) {
  return (
    <Panel sx={{ p: 2.5 }}>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="h5">{value}</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {helper}
          </Typography>
          <Chip size="small" label={trend} sx={{ bgcolor: alpha(tokens.success, 0.12), color: tokens.success }} />
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

function VerificationCard({
  item,
  decision,
  onDecide,
}: {
  item: VerificationCase;
  decision?: Decision;
  onDecide: (id: string, nextDecision: Decision) => void;
}) {
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between" }}
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
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Documents
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {item.documents.map((documentName) => (
                <Chip key={documentName} size="small" icon={<ReceiptLongRounded />} label={documentName} />
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Checks
            </Typography>
            <Stack spacing={0.75}>
              {item.checks.map((check) => (
                <Stack key={check} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <CheckCircleRounded sx={{ color: tokens.success, fontSize: 18 }} />
                  <Typography variant="body2">{check}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Box>
        <Divider />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Submitted {shortTime(item.submittedAt)}
          </Typography>
          {decision ? (
            <Chip
              icon={decision === "approved" ? <CheckCircleRounded /> : <CancelRounded />}
              label={decision === "approved" ? "Approved in this review" : "Rejected in this review"}
              sx={{ bgcolor: alpha(decision === "approved" ? tokens.success : tokens.danger, 0.12) }}
            />
          ) : (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" color="error" startIcon={<CancelRounded />} onClick={() => onDecide(item.id, "rejected")}>
                Reject
              </Button>
              <Button variant="contained" startIcon={<CheckCircleRounded />} onClick={() => onDecide(item.id, "approved")}>
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
  onToggle,
}: {
  business: BusinessRecord;
  status: VerificationStatus;
  onToggle: (id: string, nextStatus: VerificationStatus) => void;
}) {
  const isSuspended = status === "suspended";
  return (
    <Panel sx={{ p: 2 }}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto" },
          alignItems: "center",
        }}
      >
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
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
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            GMV
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>{formatGHS(business.gmvMinor)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Commission
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>{formatGHS(business.commissionMinor)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Last active
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>{shortTime(business.lastActive)}</Typography>
        </Box>
        <Button
          variant={isSuspended ? "contained" : "outlined"}
          color={isSuspended ? "primary" : "error"}
          onClick={() => onToggle(business.id, isSuspended ? "verified" : "suspended")}
        >
          {isSuspended ? "Reactivate" : "Suspend"}
        </Button>
      </Box>
    </Panel>
  );
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const { admin } = loaderData;
  const [section, setSection] = useState<Section>("overview");
  const [verificationDecisions, setVerificationDecisions] = useState<Record<string, Decision>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, VerificationStatus>>({});
  const [businessQuery, setBusinessQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const pendingCount = verificationCases.filter((item) => !verificationDecisions[item.id]).length;
  const urgentTickets = supportTickets.filter((ticket) => ticket.priority === "urgent").length;

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

  const decideVerification = (id: string, nextDecision: Decision) => {
    setVerificationDecisions((current) => ({ ...current, [id]: nextDecision }));
  };

  const toggleBusinessStatus = (id: string, nextStatus: VerificationStatus) => {
    setStatusOverrides((current) => ({ ...current, [id]: nextStatus }));
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "280px 1fr" } }}>
        <Box
          component="aside"
          sx={{
            borderRight: { lg: "1px solid" },
            borderColor: "divider",
            bgcolor: tokens.charcoal,
            color: tokens.white,
            minHeight: { lg: "100vh" },
            position: { lg: "sticky" },
            top: 0,
          }}
        >
          <Toolbar sx={{ minHeight: 76 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: tokens.burgundy,
                }}
              >
                <AdminPanelSettingsRounded />
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                  Xtiitch Admin
                </Typography>
                <Typography variant="caption" sx={{ color: alpha(tokens.white, 0.68) }}>
                  Operator console
                </Typography>
              </Box>
            </Stack>
          </Toolbar>
          <List sx={{ px: 1.5, pb: 2, display: { xs: "grid", sm: "flex", lg: "block" }, gap: 0.5, overflowX: "auto" }}>
            {navItems.map((item) => {
              const selected = item.id === section;
              return (
                <ListItemButton
                  key={item.id}
                  selected={selected}
                  onClick={() => setSection(item.id)}
                  sx={{
                    borderRadius: 1.5,
                    minWidth: { xs: 168, lg: "auto" },
                    color: tokens.white,
                    "&.Mui-selected": {
                      bgcolor: alpha(tokens.white, 0.12),
                    },
                    "&.Mui-selected:hover, &:hover": {
                      bgcolor: alpha(tokens.white, 0.16),
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: selected ? tokens.white : alpha(tokens.white, 0.62), minWidth: 38 }}>
                    {item.icon}
                  </ListItemIcon>
                  <Typography component="span" sx={{ fontWeight: selected ? 900 : 700, fontSize: 14 }}>
                    {item.label}
                  </Typography>
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        <Box component="main">
          <Box
            sx={{
              px: { xs: 2, md: 4 },
              py: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: alpha(tokens.white, 0.72),
              position: "sticky",
              top: 0,
              zIndex: 2,
              backdropFilter: "blur(12px)",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}>
              <Box>
                <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 900 }}>
                  admin.xtiitch.com
                </Typography>
                <Typography variant="h4" component="h1">
                  Platform operations
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Chip icon={<ShieldRounded />} label={admin.adminRole} variant="outlined" sx={{ textTransform: "capitalize" }} />
                <Chip label={admin.adminEmail} sx={{ bgcolor: alpha(tokens.burgundy, 0.1), color: tokens.burgundy }} />
                <Form method="post">
                  <input type="hidden" name="intent" value="logout" />
                  <Button type="submit" variant="outlined" startIcon={<LogoutRounded />}>
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
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
                  }}
                >
                  {platformMetrics.map((metric) => (
                    <MetricCard key={metric.label} {...metric} />
                  ))}
                </Box>

                <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", xl: "1.25fr 0.75fr" } }}>
                  <Panel sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", mb: 2 }}>
                      <Box>
                        <Typography variant="h6">Verification queue</Typography>
                        <Typography sx={{ color: "text.secondary" }}>
                          {pendingCount} businesses need an operator decision before money rails are enabled.
                        </Typography>
                      </Box>
                      <Button variant="contained" endIcon={<ArrowForwardRounded />} onClick={() => setSection("verification")}>
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
                            borderColor: "divider",
                            borderRadius: 1.5,
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 900 }}>{item.businessName}</Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              {item.handle}.xtiitch.com · {item.documents.length} docs
                            </Typography>
                          </Box>
                          <RiskChip level={item.riskLevel} />
                        </Stack>
                      ))}
                    </Stack>
                  </Panel>

                  <Panel sx={{ p: { xs: 2, md: 3 }, bgcolor: tokens.panel }}>
                    <Stack spacing={2}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <PaymentsRounded sx={{ color: tokens.burgundy }} />
                        <Box>
                          <Typography variant="h6">Money rail watch</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            Paystack subaccounts, webhooks, and commission settlement.
                          </Typography>
                        </Box>
                      </Stack>
                      <Divider />
                      <Stack spacing={1.5}>
                        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                          <Typography>Webhook failures</Typography>
                          <Typography sx={{ fontWeight: 900, color: tokens.warning }}>3 open</Typography>
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                          <Typography>Suspended stores</Typography>
                          <Typography sx={{ fontWeight: 900, color: tokens.danger }}>1 active</Typography>
                        </Stack>
                        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                          <Typography>Urgent support</Typography>
                          <Typography sx={{ fontWeight: 900 }}>{urgentTickets}</Typography>
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
                      onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
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
                <Stack spacing={1.5}>
                  {filteredBusinesses.map((business) => (
                    <BusinessRow
                      key={business.id}
                      business={business}
                      status={statusOverrides[business.id] ?? business.status}
                      onToggle={toggleBusinessStatus}
                    />
                  ))}
                  {filteredBusinesses.length === 0 ? (
                    <Panel sx={{ p: 3, textAlign: "center" }}>
                      <Typography sx={{ fontWeight: 800 }}>No businesses match this view.</Typography>
                      <Typography sx={{ mt: 0.5, color: "text.secondary" }}>Clear the search or choose another status.</Typography>
                    </Panel>
                  ) : null}
                </Stack>
              </Stack>
            ) : null}

            {section === "risk" ? (
              <Stack spacing={2.5}>
                <SectionHeader
                  eyebrow="Trust and compliance"
                  title="Risk review"
                  helper="Open issues for payment integrity, tenant isolation evidence, complaints, and manual escalation."
                />
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "repeat(3, 1fr)" } }}>
                  {riskReviews.map((item) => (
                    <Panel key={item.id} sx={{ p: 2.5 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                          <RiskChip level={item.level} />
                          <Chip size="small" label={item.owner} variant="outlined" />
                        </Stack>
                        <Box>
                          <Typography variant="h6">{item.title}</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {item.business}
                          </Typography>
                        </Box>
                        <Typography sx={{ color: "text.secondary" }}>{item.reason}</Typography>
                        <Button variant="outlined" startIcon={<PersonSearchRounded />}>
                          Open review
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
                    <Panel key={ticket.id} sx={{ p: 2.5 }}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
                        <Box>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                            <Typography variant="h6">{ticket.subject}</Typography>
                            <Chip
                              size="small"
                              label={ticket.priority}
                              sx={{
                                bgcolor: alpha(ticket.priority === "urgent" ? tokens.danger : tokens.info, 0.12),
                                color: ticket.priority === "urgent" ? tokens.danger : tokens.info,
                                textTransform: "capitalize",
                              }}
                            />
                          </Stack>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {ticket.id} · {ticket.business} · waiting {ticket.age}
                          </Typography>
                          <Typography sx={{ mt: 1 }}>{ticket.summary}</Typography>
                        </Box>
                        <Button variant="contained" startIcon={<SupportAgentRounded />} sx={{ alignSelf: { md: "center" } }}>
                          Assign
                        </Button>
                      </Stack>
                    </Panel>
                  ))}
                </Stack>
              </Stack>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function SectionHeader({ eyebrow, title, helper }: { eyebrow: string; title: string; helper: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 900 }}>
        {eyebrow}
      </Typography>
      <Typography variant="h5">{title}</Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>{helper}</Typography>
    </Stack>
  );
}
