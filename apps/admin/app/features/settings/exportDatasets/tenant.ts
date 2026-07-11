import {
  AdminExportDataset,
  AdminBusiness,
  AdminCustomer,
  AdminVerificationCase,
  AdminMoneyRails,
  AdminRiskReview,
  AdminSupportTicket,
} from "../../shared/types";
import { formatGHS } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";

export function buildTenantDatasets({
  adminBusinesses,
  adminCustomers,
  verificationCases,
  moneyRails,
  riskReviews,
  supportTickets,
}: {
  adminBusinesses: AdminBusiness[];
  adminCustomers: AdminCustomer[];
  verificationCases: AdminVerificationCase[];
  moneyRails: AdminMoneyRails | null;
  riskReviews: AdminRiskReview[];
  supportTickets: AdminSupportTicket[];
}): AdminExportDataset[] {
  const timeOrFallback = (value?: string) => (value ? shortTime(value) : "");
  const moneyWebhookEvents = moneyRails?.webhookEvents ?? [];
  const moneyPayoutReviews = moneyRails?.payoutReviews ?? [];

  return [
    {
      id: "businesses",
      title: "Businesses",
      helper:
        "Tenant status, owner, GMV, commission, risk, and subaccount data.",
      source: "businesses",
      sourceLabel: "Open businesses",
      tone: adminBusinesses.some(
        (business) => business.operationalStatus === "suspended",
      )
        ? "watch"
        : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Owner",
          "Status",
          "Operational",
          "Plan",
          "Orders",
          "GMV",
          "Commission",
          "Risk",
          "Subaccount",
          "Last active",
        ],
        ...adminBusinesses.map((business) => [
          business.name,
          business.handle,
          business.ownerEmail,
          business.status,
          business.operationalStatus,
          business.plan,
          business.orders,
          formatGHS(business.gmvMinor),
          formatGHS(business.commissionMinor),
          business.riskLevel,
          business.subaccountRef || "Not provisioned",
          shortTime(business.lastActive),
        ]),
      ],
    },
    {
      id: "customers",
      title: "Customers",
      helper:
        "Client identity, contact, cross-tenant relationships, order volume, and GMV.",
      source: "customers",
      sourceLabel: "Open customers",
      tone: adminCustomers.some((customer) => customer.tenantCount > 1)
        ? "watch"
        : "ready",
      rows: [
        [
          "Customer",
          "Email",
          "Phone",
          "Businesses",
          "Orders",
          "Custom orders",
          "GMV",
          "Last business",
          "Last active",
        ],
        ...adminCustomers.map((customer) => [
          customer.displayName || customer.id,
          customer.email,
          customer.phone,
          customer.tenantCount,
          customer.orderCount,
          customer.customOrderCount,
          formatGHS(customer.gmvMinor),
          customer.lastBusinessName || customer.lastBusinessHandle,
          shortTime(customer.lastActive),
        ]),
      ],
    },
    {
      id: "verification",
      title: "Verification queue",
      helper: "KYC status, risk level, owner contact, documents, and notes.",
      source: "verification",
      sourceLabel: "Open KYC",
      tone: verificationCases.some(
        (item) => item.riskLevel === "high" && item.status !== "verified",
      )
        ? "blocked"
        : verificationCases.length > 0
          ? "watch"
          : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Owner",
          "Email",
          "Status",
          "Risk",
          "Plan",
          "Documents",
          "Submitted",
          "Updated",
          "Notes",
        ],
        ...verificationCases.map((item) => [
          item.businessName,
          item.handle,
          item.ownerName,
          item.ownerEmail,
          item.status,
          item.riskLevel,
          item.plan,
          item.documents.join("; "),
          shortTime(item.submittedAt),
          shortTime(item.updatedAt),
          item.notes,
        ]),
      ],
    },
    {
      id: "money",
      title: "Money rails",
      helper:
        "Webhook events and settlement review rows for Paystack operations.",
      source: "money",
      sourceLabel: "Open money",
      tone:
        moneyWebhookEvents.some((event) => event.status === "failed") ||
        moneyPayoutReviews.some(
          (review) => review.holdActive || review.status === "blocked",
        )
          ? "blocked"
          : moneyWebhookEvents.length + moneyPayoutReviews.length > 0
            ? "watch"
            : "ready",
      rows: [
        [
          "Kind",
          "Business",
          "Reference",
          "Status",
          "Amount",
          "Attempts",
          "Received/Updated",
          "Note",
        ],
        ...moneyWebhookEvents.map((event) => [
          "Webhook",
          event.business,
          event.providerReference,
          event.status,
          formatGHS(event.amountMinor),
          event.attempts,
          shortTime(event.receivedAt),
          event.note,
        ]),
        ...moneyPayoutReviews.map((review) => [
          "Settlement",
          review.business,
          review.subaccountRef,
          review.holdActive ? "held" : review.status,
          formatGHS(review.settlementMinor),
          "",
          timeOrFallback(review.holdUpdatedAt),
          review.holdReason || review.nextAction,
        ]),
      ],
    },
    {
      id: "risk",
      title: "Risk reviews",
      helper:
        "Open and closed trust, safety, payout, and verification signals.",
      source: "risk",
      sourceLabel: "Open risk",
      tone: riskReviews.some(
        (review) => review.level === "high" && review.status === "open",
      )
        ? "blocked"
        : riskReviews.some((review) => review.status === "open")
          ? "watch"
          : "ready",
      rows: [
        ["Title", "Business", "Level", "Status", "Owner", "Updated", "Reason"],
        ...riskReviews.map((review) => [
          review.title,
          review.business,
          review.level,
          review.status,
          review.owner,
          shortTime(review.updatedAt),
          review.reason,
        ]),
      ],
    },
    {
      id: "support",
      title: "Support tickets",
      helper: "Priority, assignment, status, category, and issue summary.",
      source: "support",
      sourceLabel: "Open support",
      tone: supportTickets.some(
        (ticket) => ticket.priority === "urgent" && ticket.status === "open",
      )
        ? "blocked"
        : supportTickets.some((ticket) => ticket.status === "open")
          ? "watch"
          : "ready",
      rows: [
        [
          "Subject",
          "Business",
          "Category",
          "Priority",
          "Status",
          "Assigned",
          "Created",
          "Updated",
          "Summary",
        ],
        ...supportTickets.map((ticket) => [
          ticket.subject,
          ticket.business,
          ticket.category,
          ticket.priority,
          ticket.status,
          ticket.assignedAdminName || ticket.assignedAdminEmail || "Unassigned",
          shortTime(ticket.createdAt),
          shortTime(ticket.updatedAt),
          ticket.summary,
        ]),
      ],
    },
  ];
}
