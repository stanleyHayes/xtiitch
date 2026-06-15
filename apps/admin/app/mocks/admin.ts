export type VerificationStatus = "pending" | "verified" | "rejected" | "suspended";
export type RiskLevel = "low" | "medium" | "high";
export type TicketPriority = "normal" | "urgent";
export type WebhookStatus = "verified" | "failed" | "replayed";
export type PayoutStatus = "ready" | "review" | "blocked";
export type AuditSeverity = "info" | "warning" | "critical";

export type PlatformMetric = {
  label: string;
  value: string;
  helper: string;
  trend: string;
};

export type VerificationCase = {
  id: string;
  businessName: string;
  handle: string;
  ownerName: string;
  ownerEmail: string;
  submittedAt: string;
  plan: string;
  riskLevel: RiskLevel;
  documents: string[];
  checks: string[];
  evidence: string[];
  notes: string;
};

export type BusinessRecord = {
  id: string;
  name: string;
  handle: string;
  ownerEmail: string;
  status: VerificationStatus;
  plan: string;
  orders: number;
  gmvMinor: number;
  commissionMinor: number;
  riskLevel: RiskLevel;
  lastActive: string;
  subaccountRef: string;
};

export type RiskReview = {
  id: string;
  title: string;
  business: string;
  level: RiskLevel;
  reason: string;
  owner: string;
};

export type SupportTicket = {
  id: string;
  subject: string;
  business: string;
  priority: TicketPriority;
  age: string;
  summary: string;
};

export type WebhookEvent = {
  id: string;
  providerReference: string;
  business: string;
  status: WebhookStatus;
  purpose: string;
  amountMinor: number;
  attempts: number;
  receivedAt: string;
  note: string;
};

export type PayoutReview = {
  id: string;
  business: string;
  subaccountRef: string;
  status: PayoutStatus;
  settlementMinor: number;
  commissionMinor: number;
  nextAction: string;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
  severity: AuditSeverity;
};

export const platformMetrics: PlatformMetric[] = [
  { label: "GMV this month", value: "GHS 184.2k", helper: "Across verified stores", trend: "+18.4%" },
  { label: "Platform revenue", value: "GHS 5.5k", helper: "Commission collected", trend: "+11.7%" },
  { label: "Active businesses", value: "142", helper: "Verified or pending", trend: "+9" },
  { label: "Payment health", value: "99.1%", helper: "Webhook success rate", trend: "Stable" },
];

export const verificationCases: VerificationCase[] = [
  {
    id: "ver-1028",
    businessName: "Akosua's Atelier",
    handle: "akosuas-atelier",
    ownerName: "Akosua Mensah",
    ownerEmail: "akosua@example.com",
    submittedAt: "2026-06-14T09:20:00.000Z",
    plan: "Growth",
    riskLevel: "low",
    documents: ["Ghana Card", "Business registration", "Bank statement"],
    checks: ["Handle clean", "Bank name match", "No duplicate owner"],
    evidence: ["Ghana Card number ends 4421", "Bank account holder: Akosua Mensah", "CAC record matches business name"],
    notes: "Tailor has existing customer base and a clean Paystack subaccount match.",
  },
  {
    id: "ver-1029",
    businessName: "Yaa Bridal Studio",
    handle: "yaa-bridal",
    ownerName: "Yaa Boateng",
    ownerEmail: "yaa@example.com",
    submittedAt: "2026-06-14T12:45:00.000Z",
    plan: "Starter",
    riskLevel: "medium",
    documents: ["Ghana Card", "Utility bill"],
    checks: ["Address needs review", "Phone verified"],
    evidence: ["Utility bill address differs from store city", "Phone OTP verified at signup", "Settlement bank pending"],
    notes: "Manual KYC review needed before enabling deposit payments.",
  },
  {
    id: "ver-1030",
    businessName: "Kumasi Fit House",
    handle: "k-fit-house",
    ownerName: "Kwame Appiah",
    ownerEmail: "kwame@example.com",
    submittedAt: "2026-06-15T08:15:00.000Z",
    plan: "Free",
    riskLevel: "high",
    documents: ["Ghana Card"],
    checks: ["Duplicate handle pattern", "Missing bank evidence"],
    evidence: ["Owner email resembles prior rejected store", "No bank statement uploaded", "Two handle attempts in 24 hours"],
    notes: "Hold payment verification until owner identity and settlement account are reconciled.",
  },
];

export const businesses: BusinessRecord[] = [
  {
    id: "biz-201",
    name: "Sika Stitches",
    handle: "sika-stitches",
    ownerEmail: "ops@sikastitches.example",
    status: "verified",
    plan: "Growth",
    orders: 218,
    gmvMinor: 8420000,
    commissionMinor: 252600,
    riskLevel: "low",
    lastActive: "2026-06-15T11:16:00.000Z",
    subaccountRef: "ACCT_8M8TN",
  },
  {
    id: "biz-202",
    name: "Aba Couture",
    handle: "aba-couture",
    ownerEmail: "aba@example.com",
    status: "verified",
    plan: "Starter",
    orders: 76,
    gmvMinor: 3110000,
    commissionMinor: 93300,
    riskLevel: "medium",
    lastActive: "2026-06-15T10:05:00.000Z",
    subaccountRef: "ACCT_2F7RB",
  },
  {
    id: "biz-203",
    name: "Needle Room Lab",
    handle: "needle-room",
    ownerEmail: "hello@needleroom.example",
    status: "pending",
    plan: "Free",
    orders: 12,
    gmvMinor: 420000,
    commissionMinor: 0,
    riskLevel: "low",
    lastActive: "2026-06-14T16:42:00.000Z",
    subaccountRef: "",
  },
  {
    id: "biz-204",
    name: "Tema Alterations",
    handle: "tema-alter",
    ownerEmail: "admin@temaalter.example",
    status: "suspended",
    plan: "Growth",
    orders: 39,
    gmvMinor: 1440000,
    commissionMinor: 43200,
    riskLevel: "high",
    lastActive: "2026-06-13T19:10:00.000Z",
    subaccountRef: "ACCT_77KQW",
  },
];

export const riskReviews: RiskReview[] = [
  {
    id: "risk-710",
    title: "Repeated webhook mismatch",
    business: "Aba Couture",
    level: "medium",
    reason: "Three provider references reached webhook verification but did not map cleanly to expected order ids.",
    owner: "Money rails",
  },
  {
    id: "risk-711",
    title: "High-value deposit spike",
    business: "Tema Alterations",
    level: "high",
    reason: "Deposit totals jumped 420% after a status complaint; keep suspension until support clears delivery evidence.",
    owner: "Trust review",
  },
  {
    id: "risk-712",
    title: "Tenant-boundary audit",
    business: "Needle Room Lab",
    level: "low",
    reason: "New app activity has no cross-tenant reads; keep scheduled audit open until first verified payment.",
    owner: "Security",
  },
];

export const supportTickets: SupportTicket[] = [
  {
    id: "SUP-4019",
    subject: "Customer cannot see green status",
    business: "Sika Stitches",
    priority: "normal",
    age: "18m",
    summary: "Customer has the tracking link but stage event has not advanced after pickup.",
  },
  {
    id: "SUP-4020",
    subject: "Owner requests payout account correction",
    business: "Aba Couture",
    priority: "urgent",
    age: "42m",
    summary: "Do not change settlement data until the KYC re-check is complete.",
  },
  {
    id: "SUP-4021",
    subject: "Subscription upgrade not reflected",
    business: "Needle Room Lab",
    priority: "normal",
    age: "1h",
    summary: "Billing path is pending final subscription mechanics; mark as waiting on payments feature.",
  },
];

export const webhookEvents: WebhookEvent[] = [
  {
    id: "wh-7001",
    providerReference: "xt_live_84F2Q",
    business: "Sika Stitches",
    status: "verified",
    purpose: "standard_full",
    amountMinor: 64000,
    attempts: 1,
    receivedAt: "2026-06-15T11:41:00.000Z",
    note: "Signature verified and order confirmed at first ready-made stage.",
  },
  {
    id: "wh-7002",
    providerReference: "xt_dep_2DF8K",
    business: "Aba Couture",
    status: "failed",
    purpose: "deposit",
    amountMinor: 12000,
    attempts: 3,
    receivedAt: "2026-06-15T10:58:00.000Z",
    note: "Provider reference not mapped to the expected draft custom order.",
  },
  {
    id: "wh-7003",
    providerReference: "xt_dep_98KJ1",
    business: "Tema Alterations",
    status: "replayed",
    purpose: "deposit",
    amountMinor: 15000,
    attempts: 2,
    receivedAt: "2026-06-15T09:20:00.000Z",
    note: "Replay safely deduped by payment_provider_events ledger.",
  },
];

export const payoutReviews: PayoutReview[] = [
  {
    id: "pay-501",
    business: "Sika Stitches",
    subaccountRef: "ACCT_8M8TN",
    status: "ready",
    settlementMinor: 8167400,
    commissionMinor: 252600,
    nextAction: "No action needed; split settlement is healthy.",
  },
  {
    id: "pay-502",
    business: "Aba Couture",
    subaccountRef: "ACCT_2F7RB",
    status: "review",
    settlementMinor: 3016700,
    commissionMinor: 93300,
    nextAction: "Review webhook mismatch before account changes.",
  },
  {
    id: "pay-503",
    business: "Tema Alterations",
    subaccountRef: "ACCT_77KQW",
    status: "blocked",
    settlementMinor: 1396800,
    commissionMinor: 43200,
    nextAction: "Keep suspended until delivery complaint is resolved.",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "audit-9001",
    actor: "owner@xtiitch.com",
    action: "Verified webhook",
    target: "xt_live_84F2Q",
    detail: "Payment succeeded, order advanced to confirmed.",
    createdAt: "2026-06-15T11:42:00.000Z",
    severity: "info",
  },
  {
    id: "audit-9002",
    actor: "system",
    action: "Blocked payout",
    target: "Tema Alterations",
    detail: "Suspension state prevents further operator payout changes.",
    createdAt: "2026-06-15T10:28:00.000Z",
    severity: "critical",
  },
  {
    id: "audit-9003",
    actor: "support@xtiitch.com",
    action: "Escalated ticket",
    target: "SUP-4020",
    detail: "Owner requested settlement-account correction before KYC review.",
    createdAt: "2026-06-15T09:52:00.000Z",
    severity: "warning",
  },
];
