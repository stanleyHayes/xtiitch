import Box from "@mui/material/Box";
import { tokens } from "../../theme";
import type {
  AdminBusiness,
  AdminCustomer,
  AdminSubscription,
  AdminRiskReview,
  AdminSupportTicket,
  AdminMoneyRails,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
} from "../../lib/api";
import { AuditEvent, Section } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { OverviewBar } from "./types";
import { buildOverviewSeries, overviewParseMs } from "./utils";
import { OverviewTrendCard } from "./OverviewTrendCard";
import { OverviewBreakdownCard } from "./OverviewBreakdownCard";

export function OverviewCharts({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  businesses,
  customers,
  subscriptions,
  riskReviews,
  supportTickets,
  moneyRails,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
  auditEvents,
  onSelect,
}: {
  businesses: AdminBusiness[];
  customers: AdminCustomer[];
  subscriptions: AdminSubscription[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  moneyRails: AdminMoneyRails | null;
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
  auditEvents: AuditEvent[];
  onSelect: (section: Section) => void;
}) {
  const webhookEvents = moneyRails?.webhookEvents ?? [];
  const openRisk = riskReviews.filter((review) => review.status === "open");
  const openSupport = supportTickets.filter(
    (ticket) => ticket.status === "open",
  );
  const urgentSupport = openSupport.filter(
    (ticket) => ticket.priority === "urgent",
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
  const supportNew = supportSeries.reduce(
    (sum, point) => sum + point.value,
    0,
  );

  const countBy = <T,>(items: T[], predicate: (item: T) => boolean): number =>
    items.filter(predicate).length;

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

  return (
    <>
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
          subtitle={`${formatGHS(
            subscriptions
              .filter((sub) => sub.status === "active")
              .reduce((sum, sub) => sum + sub.monthlyFeeMinor, 0),
          )} MRR`}
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
    </>
  );
}
