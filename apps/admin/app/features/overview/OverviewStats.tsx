import Box from "@mui/material/Box";
import { MetricCard } from "../../components/ui/MetricCard";
import { formatGHS, formatPercentBps } from "../shared/formatting";
import type {
  AdminPlatformMetrics,
  AdminBusiness,
  AdminCustomer,
  AdminSubscription,
  AdminRiskReview,
  AdminSupportTicket,
  AdminOperationsHealth,
} from "../../lib/api";

export function OverviewStats({
  platformMetrics,
  businesses,
  customers,
  subscriptions,
  riskReviews,
  supportTickets,
  operationsHealth,
  pendingCount,
}: {
  platformMetrics: AdminPlatformMetrics | null;
  businesses: AdminBusiness[];
  customers: AdminCustomer[];
  subscriptions: AdminSubscription[];
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
  operationsHealth: AdminOperationsHealth | null;
  pendingCount: number;
}) {
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
  const suspendedCount = businesses.filter(
    (business) => business.operationalStatus === "suspended",
  ).length;
  const verifiedCount = businesses.filter(
    (business) => business.verificationStatus === "verified",
  ).length;
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

  return (
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
  );
}
