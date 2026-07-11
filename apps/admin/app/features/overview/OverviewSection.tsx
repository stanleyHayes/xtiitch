import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import type {
  AdminPlatformMetrics,
  AdminOperationsHealth,
  AdminBusiness,
  AdminCustomer,
  AdminSubscription,
  AdminVerificationCase,
  AdminSupportTicket,
  AdminRiskReview,
  AdminMoneyRails,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
} from "../../lib/api";
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
import { AuditEvent, Section } from "../shared/types";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import { auditColor, riskColor } from "../shared/colors";
import { webhookColor } from "../money/utils";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { CardDetailAction } from "../shared/CardDetailAction";
import { OverviewBar } from "./types";
import { buildOverviewSeries, overviewParseMs } from "./utils";
import { OverviewTrendCard } from "./OverviewTrendCard";
import { OverviewBreakdownCard } from "./OverviewBreakdownCard";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function OverviewSection({
  platformMetrics,
  platformMetricsError,
  operationsHealth,
  businesses,
  customers,
  subscriptions,
  verificationCases,
  supportTickets,
  riskReviews,
  auditEvents,
  moneyRails,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  pendingCount,
  onSelect,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  platformMetricsError: string | null;
  operationsHealth: AdminOperationsHealth | null;
  businesses: AdminBusiness[];
  customers: AdminCustomer[];
  subscriptions: AdminSubscription[];
  verificationCases: AdminVerificationCase[];
  supportTickets: AdminSupportTicket[];
  riskReviews: AdminRiskReview[];
  auditEvents: AuditEvent[];
  moneyRails: AdminMoneyRails | null;
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  pendingCount: number;
  onSelect: (section: Section) => void;
}) {
  const countBy = <T,>(items: T[], predicate: (item: T) => boolean): number =>
    items.filter(predicate).length;

  const webhookEvents = moneyRails?.webhookEvents ?? [];
  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "active" || sub.status === "trialing",
  );
  const mrrMinor = subscriptions
    .filter((sub) => sub.status === "active")
    .reduce((sum, sub) => sum + sub.monthlyFeeMinor, 0);
  const openRisk = riskReviews.filter((review) => review.status === "open");
  const openSupport = supportTickets.filter(
    (ticket) => ticket.status === "open",
  );
  const urgentSupport = openSupport.filter(
    (ticket) => ticket.priority === "urgent",
  );
  const suspendedCount = countBy(
    businesses,
    (business) => business.operationalStatus === "suspended",
  );
  const verifiedCount = countBy(
    businesses,
    (business) => business.verificationStatus === "verified",
  );
  const customerGmvMinor = customers.reduce((sum, c) => sum + c.gmvMinor, 0);
  const customerOrders = customers.reduce((sum, c) => sum + c.orderCount, 0);

  const kpiCards: {
    label: string;
    value: string;
    helper: string;
    trend: string;
  }[] = [];
  if (platformMetrics) {
    kpiCards.push(
      {
        label: "GMV this month",
        value: formatGHS(platformMetrics.gmvMonthMinor),
        helper: "Succeeded platform payments",
        trend: `${platformMetrics.totalPayments30d} payments · 30d`,
      },
      {
        label: "Platform revenue",
        value: formatGHS(platformMetrics.platformRevenueMonthMinor),
        helper: "Commission collected",
        trend: "Month to date",
      },
      {
        label: "Payment health",
        value: formatPercentBps(platformMetrics.paymentHealthBps),
        helper: `${platformMetrics.failedPayments30d} failed · 30d`,
        trend: "Live",
      },
    );
  }
  kpiCards.push(
    {
      label: "Businesses",
      value: String(businesses.length),
      helper: `${verifiedCount} verified · ${suspendedCount} suspended`,
      trend: `${pendingCount} pending KYC`,
    },
    {
      label: "Customers",
      value: String(customers.length),
      helper: `${formatGHS(customerGmvMinor)} lifetime GMV`,
      trend: `${customerOrders} orders`,
    },
    {
      label: "Active subscriptions",
      value: String(activeSubscriptions.length),
      helper: `${formatGHS(mrrMinor)} MRR`,
      trend: `${subscriptions.length} total`,
    },
    {
      label: "Open issues",
      value: String(openRisk.length + openSupport.length),
      helper: `${openRisk.length} risk · ${openSupport.length} support`,
      trend: `${urgentSupport.length} urgent`,
    },
    {
      label: "Operations health",
      value: operationsHealth ? `${operationsHealth.healthScore}%` : "—",
      helper: operationsHealth
        ? `${operationsHealth.blockedCount} blocked · ${operationsHealth.watchCount} watch`
        : "Awaiting signals",
      trend: operationsHealth
        ? `${operationsHealth.failedWebhooks} webhook fails`
        : "—",
    },
  );

  const moneySeries = buildOverviewSeries(
    webhookEvents
      .filter(
        (event) => event.status === "verified" || event.status === "replayed",
      )
      .map((event) => ({
        ts: overviewParseMs(event.receivedAt),
        value: event.amountMinor,
      })),
    14,
  );
  const moneyTotal = moneySeries.reduce((sum, point) => sum + point.value, 0);
  const customerSeries = buildOverviewSeries(
    customers.map((customer) => ({
      ts: overviewParseMs(customer.createdAt),
      value: 1,
    })),
    30,
  );
  const customerNew = customerSeries.reduce(
    (sum, point) => sum + point.value,
    0,
  );
  const auditSeries = buildOverviewSeries(
    auditEvents.map((event) => ({
      ts: overviewParseMs(event.createdAt),
      value: 1,
    })),
    14,
  );
  const auditTotal = auditSeries.reduce((sum, point) => sum + point.value, 0);
  const supportSeries = buildOverviewSeries(
    supportTickets.map((ticket) => ({
      ts: overviewParseMs(ticket.createdAt),
      value: 1,
    })),
    14,
  );
  const supportNew = supportSeries.reduce((sum, point) => sum + point.value, 0);

  const businessBars: OverviewBar[] = [
    {
      label: "Verified",
      value: countBy(businesses, (b) => b.status === "verified"),
      color: tokens.success,
    },
    {
      label: "Pending",
      value: countBy(businesses, (b) => b.status === "pending"),
      color: tokens.warning,
    },
    {
      label: "Unverified",
      value: countBy(businesses, (b) => b.status === "unverified"),
      color: tokens.info,
    },
    {
      label: "Suspended",
      value: countBy(businesses, (b) => b.status === "suspended"),
      color: tokens.danger,
    },
    {
      label: "Rejected",
      value: countBy(businesses, (b) => b.status === "rejected"),
      color: tokens.mauve,
    },
  ];
  const subscriptionBars: OverviewBar[] = [
    {
      label: "Active",
      value: countBy(subscriptions, (s) => s.status === "active"),
      color: tokens.success,
    },
    {
      label: "Trialing",
      value: countBy(subscriptions, (s) => s.status === "trialing"),
      color: tokens.info,
    },
    {
      label: "Past due",
      value: countBy(subscriptions, (s) => s.status === "past_due"),
      color: tokens.warning,
    },
    {
      label: "Grace period",
      value: countBy(subscriptions, (s) => s.status === "grace_period"),
      color: tokens.gold,
    },
    {
      label: "Ending",
      value: countBy(subscriptions, (s) => s.status === "cancel_at_period_end"),
      color: tokens.mauve,
    },
    {
      label: "Canceled",
      value: countBy(subscriptions, (s) => s.status === "canceled"),
      color: tokens.danger,
    },
  ];
  const trustBars: OverviewBar[] = [
    {
      label: "High risk (open)",
      value: countBy(openRisk, (r) => r.level === "high"),
      color: tokens.danger,
    },
    {
      label: "Medium risk (open)",
      value: countBy(openRisk, (r) => r.level === "medium"),
      color: tokens.warning,
    },
    {
      label: "Low risk (open)",
      value: countBy(openRisk, (r) => r.level === "low"),
      color: tokens.info,
    },
    {
      label: "Urgent support",
      value: urgentSupport.length,
      color: tokens.danger,
    },
    {
      label: "Open support",
      value: openSupport.length,
      color: tokens.burgundy,
    },
  ];
  const growthBars: OverviewBar[] = [
    {
      label: "Promotions live",
      value: countBy(promotions, (p) => p.status === "active"),
      color: tokens.burgundy,
    },
    {
      label: "Ad placements live",
      value: countBy(adCampaigns, (a) => a.status === "active"),
      color: tokens.info,
    },
    {
      label: "Affiliates active",
      value: countBy(affiliates, (a) => a.status === "active"),
      color: tokens.success,
    },
    {
      label: "Referral programmes",
      value: countBy(referralProgrammes, (r) => r.status === "active"),
      color: tokens.gold,
    },
  ];

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
    <Stack spacing={3}>
      <SectionHeader
        eyebrow="Platform pulse"
        title="Everything at a glance"
        helper="A live snapshot across the admin, business, and customer platforms — money flow, growth, trust & safety, and the latest activity."
      />

      {platformMetricsError ? (
        <Alert severity="warning">{platformMetricsError}</Alert>
      ) : null}

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
        {kpiCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        <OverviewTrendCard
          title="Settled payment volume"
          subtitle="Verified Paystack webhooks · 14 days"
          total={formatGHS(moneyTotal)}
          series={moneySeries}
          color={tokens.burgundy}
          emptyLabel="No settled webhooks recorded yet."
        />
        <OverviewTrendCard
          title="New customers"
          subtitle="First seen · 30 days"
          total={`+${customerNew}`}
          series={customerSeries}
          color={tokens.success}
          emptyLabel="No new customers in this window."
        />
        <OverviewTrendCard
          title="Admin activity"
          subtitle="Operator audit events · 14 days"
          total={String(auditTotal)}
          series={auditSeries}
          color={tokens.info}
          emptyLabel="No operator activity recorded yet."
        />
        <OverviewTrendCard
          title="Support load"
          subtitle="Tickets opened · 14 days"
          total={String(supportNew)}
          series={supportSeries}
          color={tokens.warning}
          emptyLabel="No support tickets opened."
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
          alignItems: "start",
        }}
      >
        <OverviewBreakdownCard
          title="Businesses"
          subtitle={`${businesses.length} tenants`}
          items={businessBars}
          onView={() => onSelect("businesses")}
        />
        <OverviewBreakdownCard
          title="Subscriptions"
          subtitle={`${formatGHS(mrrMinor)} MRR`}
          items={subscriptionBars}
          onView={() => onSelect("subscriptions")}
        />
        <OverviewBreakdownCard
          title="Trust & safety"
          subtitle={`${openRisk.length + openSupport.length} open`}
          items={trustBars}
          onView={() => onSelect("risk")}
        />
        <OverviewBreakdownCard
          title="Growth"
          subtitle="Live programmes"
          items={growthBars}
          onView={() => onSelect("promotions")}
        />
      </Box>

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
    </Stack>
  );
}
