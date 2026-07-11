import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import { tokens } from "../../theme";
import type {
  AdminOperationsHealth,
  AdminSubscription,
  AdminVerificationCase,
  AdminSupportTicket,
  AdminMoneyRails,
} from "../../lib/api";
import { AuditEvent, Section } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { auditColor, riskColor } from "../shared/colors";
import { webhookColor } from "../money/utils";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { CardDetailAction } from "../shared/CardDetailAction";
import { overviewParseMs } from "./utils";

export function OverviewRecentActivity({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  operationsHealth,
  subscriptions,
  verificationCases,
  supportTickets,
  auditEvents,
  moneyRails,
  onSelect,
}: {
  operationsHealth: AdminOperationsHealth | null;
  subscriptions: AdminSubscription[];
  verificationCases: AdminVerificationCase[];
  supportTickets: AdminSupportTicket[];
  auditEvents: AuditEvent[];
  moneyRails: AdminMoneyRails | null;
  onSelect: (section: Section) => void;
}) {
  const webhookEvents = moneyRails?.webhookEvents ?? [];

  type FeedItem = {
    id: string;
    at: string;
    ts: number;
    tone: string;
    icon: ReactNode;
    title: string;
    meta: string;
    section: Section;
  };
  const feed: FeedItem[] = [];
  for (const event of auditEvents) {
    feed.push({
      id: `audit-${event.id}`,
      at: event.createdAt,
      ts: overviewParseMs(event.createdAt),
      tone: auditColor(event.severity),
      icon: <HistoryRounded fontSize="small" />,
      title: event.action,
      meta: `${event.actor} · ${event.target}`,
      section: "audit",
    });
  }
  for (const event of webhookEvents) {
    feed.push({
      id: `wh-${event.id}`,
      at: event.receivedAt,
      ts: overviewParseMs(event.receivedAt),
      tone: webhookColor(event.status),
      icon: <PaymentsRounded fontSize="small" />,
      title: `${formatGHS(event.amountMinor)} · ${event.status}`,
      meta: `${event.business} · ${event.purpose}`,
      section: "money",
    });
  }
  for (const ticket of supportTickets) {
    feed.push({
      id: `st-${ticket.id}`,
      at: ticket.createdAt,
      ts: overviewParseMs(ticket.createdAt),
      tone: ticket.priority === "urgent" ? tokens.danger : tokens.info,
      icon: <SupportAgentRounded fontSize="small" />,
      title: ticket.subject,
      meta: `${ticket.business} · ${ticket.priority}`,
      section: "support",
    });
  }
  for (const kase of verificationCases) {
    feed.push({
      id: `vc-${kase.id}`,
      at: kase.submittedAt,
      ts: overviewParseMs(kase.submittedAt),
      tone: riskColor(kase.riskLevel),
      icon: <VerifiedUserRounded fontSize="small" />,
      title: `${kase.businessName} submitted verification`,
      meta: `${kase.handle} · ${kase.riskLevel} risk`,
      section: "verification",
    });
  }
  for (const sub of subscriptions) {
    for (const event of (sub.events ?? []).slice(0, 2)) {
      feed.push({
        id: `se-${event.id}`,
        at: event.createdAt,
        ts: overviewParseMs(event.createdAt),
        tone: tokens.burgundy,
        icon: <WorkspacePremiumRounded fontSize="small" />,
        title: event.summary,
        meta: `${sub.businessName} · ${sub.planName}`,
        section: "subscriptions",
      });
    }
  }
  const feedItems = feed
    .filter((item) => Number.isFinite(item.ts))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 14);

  const healthTone = operationsHealth
    ? operationsHealth.blockedCount > 0
      ? tokens.danger
      : operationsHealth.watchCount > 0
        ? tokens.warning
        : tokens.success
    : tokens.graphite;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", xl: "0.85fr 1.15fr" },
        alignItems: "start",
      }}
    >
      <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={1.75}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }}>
                Operations health
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {operationsHealth
                  ? `${operationsHealth.failedWebhooks} webhook fails · ${operationsHealth.payoutHolds} payout holds`
                  : "Awaiting signals"}
              </Typography>
            </Box>
            <Typography
              variant="h4"
              sx={{ color: healthTone, lineHeight: 1, whiteSpace: "nowrap" }}
            >
              {operationsHealth ? `${operationsHealth.healthScore}%` : "—"}
            </Typography>
          </Stack>
          {operationsHealth && operationsHealth.signals.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              }}
            >
              {operationsHealth.signals.slice(0, 6).map((signal) => {
                const tone =
                  signal.status === "blocked"
                    ? tokens.danger
                    : signal.status === "watch"
                      ? tokens.warning
                      : tokens.success;
                return (
                  <Box
                    key={signal.id}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: alpha(tone, 0.22),
                      bgcolor: alpha(tone, 0.06),
                    }}
                  >
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", fontWeight: 800 }}
                      >
                        {signal.label}
                      </Typography>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: tone,
                        }}
                      />
                    </Stack>
                    <Typography sx={{ fontWeight: 900, color: tone }}>
                      {signal.value}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {signal.helper}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Alert severity="info">
              Operations health signals are not available right now.
            </Alert>
          )}
          <CardDetailAction
            onClick={() => onSelect("health")}
            label="Open operations"
          />
        </Stack>
      </Panel>

      <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Live activity</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Latest events across every platform.
              </Typography>
            </Box>
            <Chip
              size="small"
              label={`${feedItems.length} recent`}
              variant="outlined"
            />
          </Stack>
          {feedItems.length === 0 ? (
            <Alert severity="info">No recent activity to show yet.</Alert>
          ) : (
            <Stack spacing={1}>
              {feedItems.map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1.25}
                  onClick={() => onSelect(item.section)}
                  sx={{
                    alignItems: "flex-start",
                    p: 1,
                    borderRadius: 1.25,
                    bgcolor: "rgba(var(--surface-rgb), 0.6)",
                    borderLeft: "3px solid",
                    borderColor: item.tone,
                    cursor: "pointer",
                    transition:
                      "transform 160ms ease, background-color 160ms",
                    "&:hover": { transform: "translateX(3px)" },
                  }}
                >
                  <Box
                    sx={{
                      color: item.tone,
                      mt: 0.25,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, overflowWrap: "anywhere" }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {item.meta}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
                  >
                    {shortTime(item.at)}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
          <CardDetailAction
            onClick={() => onSelect("audit")}
            label="Open audit trail"
          />
        </Stack>
      </Panel>
    </Box>
  );
}
