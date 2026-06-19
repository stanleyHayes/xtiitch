export const adminApiBase = (
  process.env.XTIITCH_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const API_BASE = adminApiBase;

export type AdminRole = "owner" | "operator" | "support";

export type AdminAuthResult = {
  adminUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

export type AdminUser = {
  adminUserId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPreferences = {
  timezone: string;
  phoneNumber: string;
  notifyEmail: boolean;
  notifySms: boolean;
  alertVerifications: boolean;
  alertMoneyRails: boolean;
  alertSubscriptions: boolean;
  alertPromotions: boolean;
  alertRisk: boolean;
  alertSupport: boolean;
  dailyDigestTime: string;
  updatedAt?: string;
};

export type AdminProfileSettings = {
  user: AdminUser;
  preferences: AdminPreferences;
};

export type AdminPlatformSettings = {
  platformName: string;
  supportEmail: string;
  verificationSlaHours: number;
  payoutReviewThresholdPesewas: number;
  maintenanceMode: boolean;
  updatedAt?: string;
};

export type AdminPlatformMetrics = {
  gmvMonthMinor: number;
  platformRevenueMonthMinor: number;
  activeBusinesses: number;
  totalBusinesses: number;
  pendingVerifications: number;
  suspendedBusinesses: number;
  paymentHealthBps: number;
  failedPayments30d: number;
  totalPayments30d: number;
  updatedAt: string;
};

export type AdminOperationsHealthStatus = "ready" | "watch" | "blocked";

export type AdminOperationsHealthSignal = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  targetLabel: string;
};

export type AdminOperationsHealth = {
  healthScore: number;
  blockedCount: number;
  watchCount: number;
  paymentHealthBps: number;
  failedWebhooks: number;
  payoutHolds: number;
  openRiskReviews: number;
  openSupportTickets: number;
  urgentSupportTickets: number;
  auditEvents: number;
  criticalAuditEvents: number;
  signals: AdminOperationsHealthSignal[];
  updatedAt: string;
};

export type AdminNotificationFeedTone =
  | "critical"
  | "warning"
  | "info"
  | "success";

export type AdminNotificationFeedCategory =
  | "verification"
  | "money"
  | "subscriptions"
  | "promotions"
  | "ads"
  | "affiliates"
  | "referrals"
  | "risk"
  | "support"
  | "platform"
  | "audit";

export type AdminNotificationFeedItem = {
  id: string;
  tone: AdminNotificationFeedTone;
  category: AdminNotificationFeedCategory;
  title: string;
  helper: string;
  meta: string;
  source: string;
  target: string;
  targetLabel: string;
};

export type AdminNotificationFeed = {
  notifications: AdminNotificationFeedItem[];
  updatedAt: string;
};

export type AdminReportFeedItem = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  targetLabel: string;
};

export type AdminReportFeed = {
  items: AdminReportFeedItem[];
  updatedAt: string;
};

export type AdminLaunchReadinessCheck = {
  id: string;
  category: string;
  label: string;
  status: AdminOperationsHealthStatus;
  summary: string;
  detail: string;
  action: string;
  target: string;
  targetLabel: string;
};

export type AdminLaunchReadiness = {
  environment: string;
  readyCount: number;
  watchCount: number;
  blockedCount: number;
  checks: AdminLaunchReadinessCheck[];
  updatedAt: string;
};

export type AdminMoneyWebhookStatus =
  | "verified"
  | "failed"
  | "replayed"
  | "reversed";
export type AdminMoneyPayoutStatus = "ready" | "review" | "blocked";

export type AdminMoneyWebhookEvent = {
  id: string;
  providerReference: string;
  business: string;
  status: AdminMoneyWebhookStatus;
  purpose: string;
  amountMinor: number;
  attempts: number;
  receivedAt: string;
  note: string;
};

export type AdminMoneyPayoutReview = {
  id: string;
  business: string;
  subaccountRef: string;
  status: AdminMoneyPayoutStatus;
  settlementMinor: number;
  commissionMinor: number;
  nextAction: string;
  holdActive: boolean;
  holdReason: string;
  holdUpdatedAt?: string;
};

export type AdminMoneyRails = {
  webhookEvents: AdminMoneyWebhookEvent[];
  payoutReviews: AdminMoneyPayoutReview[];
  updatedAt: string;
};

export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "grace_period"
  | "cancel_at_period_end"
  | "canceled";

export type AdminSubscriptionBillingMode =
  | "manual"
  | "payment_link"
  | "recurring";

export type AdminSubscriptionEvent = {
  id: string;
  eventType: string;
  summary: string;
  actorEmail: string;
  createdAt: string;
};

export type AdminSubscriptionInvoiceStatus =
  | "issued"
  | "paid"
  | "failed"
  | "void";

export type AdminSubscriptionInvoice = {
  invoiceId: string;
  subscriptionId: string;
  invoiceRef: string;
  status: AdminSubscriptionInvoiceStatus;
  billingMode: AdminSubscriptionBillingMode;
  provider: string;
  providerInvoiceRef: string;
  paymentUrl: string;
  amountMinor: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  paidAt?: string;
  failedAt?: string;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminSubscription = {
  subscriptionId?: string;
  businessId: string;
  businessName: string;
  handle: string;
  ownerEmail: string;
  planCode: string;
  planName: string;
  monthlyFeeMinor: number;
  commissionBps: number;
  designLimit?: number;
  designCount: number;
  status: AdminSubscriptionStatus;
  billingMode: AdminSubscriptionBillingMode;
  provider: string;
  providerCustomerRef: string;
  providerSubscriptionRef: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  graceEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  failedPaymentCount: number;
  lastInvoiceRef: string;
  lastPaymentAt?: string;
  nextBillingAt?: string;
  orders: number;
  gmvMinor: number;
  commissionMinor: number;
  updatedAt: string;
  events: AdminSubscriptionEvent[];
  invoices: AdminSubscriptionInvoice[];
};

export type AdminSubscriptionBillingSweep = {
  overdueInvoicesFailed: number;
  subscriptionsCanceled: number;
  businessesTouched: number;
  ranAt: string;
};

export type AdminSubscriptionRecurringSweep = {
  dueSubscriptions: number;
  chargesAttempted: number;
  chargesPaid: number;
  chargesPending: number;
  chargesFailed: number;
  chargesSkipped: number;
  ranAt: string;
};

export type AdminSubscriptionAuthorizationLink = {
  businessId: string;
  businessName: string;
  ownerEmail: string;
  redirectUrl: string;
  accessCode: string;
  reference: string;
};

// Predefined package benefits an admin can grant. Mirrors the canonical Go
// catalogue in apps/api/internal/domain/business/features.go — keep in sync.
export const PLAN_BENEFITS: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
}> = [
  {
    key: "custom_brand_color",
    label: "Storefront accent colour",
    description: "Set the storefront's accent colour instead of the Xtiitch wine default.",
  },
  {
    key: "custom_logo",
    label: "Custom storefront logo",
    description: "Show the business logo on the storefront in place of the Xtiitch mark.",
  },
  {
    key: "custom_banner",
    label: "Custom hero banner image",
    description: "Replace the default storefront hero with the business's own banner image.",
  },
  {
    key: "custom_layout",
    label: "Storefront layout variants",
    description: "Choose a storefront hero layout (standard, spotlight or minimal).",
  },
  {
    key: "design_waitlist",
    label: "Design waiting lists",
    description: "Open a waiting list on a design so customers can register interest.",
  },
];

export type PlanFeatures = Record<string, boolean>;

export type AdminPlan = {
  planId: string;
  code: string;
  name: string;
  monthlyFeeMinor: number;
  commissionBps: number;
  designLimit?: number;
  features: PlanFeatures;
  isActive: boolean;
  businessCount: number;
  activeSubscriptionCount: number;
  estimatedMrrMinor: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminPromotionDiscountType = "percentage" | "fixed";
export type AdminPromotionFundingSource = "business" | "platform" | "split";
export type AdminPromotionScope = "store" | "collection" | "design";
export type AdminPromotionStatus = "active" | "paused" | "archived";

export type AdminPromotionRedemption = {
  promotionRedemptionId: string;
  promotionId: string;
  businessId: string;
  orderId?: string;
  customerId?: string;
  customerName: string;
  discountMinor: number;
  status: "pending" | "applied" | "void";
  redeemedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminPromotion = {
  promotionId: string;
  businessId?: string;
  businessName: string;
  businessHandle: string;
  code: string;
  title: string;
  description: string;
  discountType: AdminPromotionDiscountType;
  discountValue: number;
  maxDiscountMinor?: number;
  minSpendMinor: number;
  usageLimitGlobal?: number;
  usageLimitPerCustomer?: number;
  fundingSource: AdminPromotionFundingSource;
  scope: AdminPromotionScope;
  targetCollectionId?: string;
  targetDesignId?: string;
  status: AdminPromotionStatus;
  startsAt?: string;
  endsAt?: string;
  redemptionCount: number;
  discountRedeemedMinor: number;
  recentRedemptions: AdminPromotionRedemption[];
  createdAt: string;
  updatedAt: string;
};

export type AdminAdPlacementType =
  | "featured_business"
  | "promoted_design"
  | "homepage_hero";
export type AdminAdCampaignStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "completed"
  | "archived";
export type AdminAdPricingModel = "flat_time";

export type AdminAdCampaign = {
  campaignId: string;
  businessId: string;
  businessName: string;
  businessHandle: string;
  placementType: AdminAdPlacementType;
  targetRefId: string;
  targetLabel: string;
  headline: string;
  description: string;
  status: AdminAdCampaignStatus;
  pricingModel: AdminAdPricingModel;
  budgetMinor: number;
  spendMinor: number;
  dailyCapMinor?: number;
  startsAt: string;
  endsAt: string;
  impressionCount: number;
  clickCount: number;
  clickRateBps: number;
  reviewNote: string;
  payments: AdminAdCampaignPayment[];
  createdAt: string;
  updatedAt: string;
};

export type AdminAdCampaignPayment = {
  paymentId: string;
  campaignId: string;
  businessId: string;
  provider: "paystack";
  providerReference: string;
  paymentUrl: string;
  amountMinor: number;
  currency: string;
  status: "initiated" | "paid" | "failed" | "void";
  paidAt?: string;
  failedAt?: string;
  failureReason: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliateEntityType = "person" | "business" | "agency";
export type AdminAffiliateCommissionModel = "percentage" | "flat";
export type AdminAffiliatePayoutMode =
  | "paystack_split"
  | "paystack_transfer"
  | "voucher"
  | "manual";
export type AdminAffiliateStatus =
  | "pending_review"
  | "active"
  | "paused"
  | "archived";

export type AdminAffiliate = {
  affiliateId: string;
  entityType: AdminAffiliateEntityType;
  code: string;
  displayName: string;
  contactName: string;
  email: string;
  phone: string;
  websiteUrl: string;
  commissionModel: AdminAffiliateCommissionModel;
  commissionRate: number;
  cookieWindowDays: number;
  payoutMode: AdminAffiliatePayoutMode;
  payoutReference: string;
  status: AdminAffiliateStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliateAttribution = {
  affiliateId: string;
  code: string;
  displayName: string;
  clickCount: number;
  conversionCount: number;
  pendingConversionCount: number;
  approvedConversionCount: number;
  settledConversionCount: number;
  reversedConversionCount: number;
  grossMinor: number;
  commissionMinor: number;
  recentConversions: AdminAffiliateConversion[];
  recentPayouts: AdminAffiliatePayout[];
  lastActivityAt?: string;
};

export type AdminAffiliateConversion = {
  conversionId: string;
  affiliateId: string;
  businessId: string;
  businessName: string;
  orderId: string;
  grossMinor: number;
  commissionMinor: number;
  status: "pending" | "approved" | "settled" | "reversed";
  attributionModel: "last_click" | "manual";
  holdUntil?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAffiliatePayout = {
  payoutBatchId: string;
  affiliateId: string;
  displayName: string;
  payoutMode: AdminAffiliatePayoutMode;
  payoutReference: string;
  conversionCount: number;
  grossMinor: number;
  commissionMinor: number;
  status: "settled" | "void";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminReferralAudience = "customers" | "businesses" | "mixed";
export type AdminReferralRewardKind = "voucher" | "commission_rebate" | "none";
export type AdminReferralRefereeRewardKind = "voucher" | "none";
export type AdminReferralRewardType = "percentage" | "fixed";
export type AdminReferralProgrammeStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived";
export type AdminReferralCodeOwnerType = "platform" | "business" | "customer";
export type AdminReferralCodeStatus = "active" | "paused" | "archived";

export type AdminReferralCode = {
  referralCodeId: string;
  programmeId: string;
  businessId?: string;
  businessName: string;
  businessHandle: string;
  ownerType: AdminReferralCodeOwnerType;
  ownerBusinessId?: string;
  ownerCustomerId?: string;
  ownerLabel: string;
  code: string;
  status: AdminReferralCodeStatus;
  referralCount: number;
  qualifiedCount: number;
  rewardedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminReferralProgramme = {
  programmeId: string;
  title: string;
  codePrefix: string;
  audience: AdminReferralAudience;
  referrerRewardKind: AdminReferralRewardKind;
  refereeRewardKind: AdminReferralRefereeRewardKind;
  rewardType: AdminReferralRewardType;
  rewardValue: number;
  maxRewardMinor?: number;
  qualifyingOrderMinMinor: number;
  rewardHoldDays: number;
  status: AdminReferralProgrammeStatus;
  startsAt?: string;
  endsAt?: string;
  notes: string;
  codes: AdminReferralCode[];
  createdAt: string;
  updatedAt: string;
};

export type AdminReferralRewardIssue = {
  referralCount: number;
  rewardCount: number;
  voucherCount: number;
  commissionRebateCount: number;
  totalRewardMinor: number;
  issuedAt: string;
};

export type AdminAuditSeverity = "info" | "warning" | "critical";

export type AdminVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";
export type AdminVerificationDecision = "approved" | "rejected" | "held";
export type AdminRiskLevel = "low" | "medium" | "high";
export type AdminRiskReviewStatus = "open" | "closed";
export type AdminSupportPriority = "normal" | "urgent";
export type AdminSupportTicketStatus = "open" | "resolved";
export type AdminSupportAssignment = "self" | "unassigned" | "unchanged";
export type AdminBusinessOperationalStatus = "active" | "suspended";
export type AdminBusinessStatus = AdminVerificationStatus | "suspended";

export type AdminVerificationCase = {
  id: string;
  businessName: string;
  handle: string;
  ownerName: string;
  ownerEmail: string;
  submittedAt: string;
  updatedAt: string;
  plan: string;
  status: AdminVerificationStatus;
  riskLevel: AdminRiskLevel;
  documents: string[];
  checks: string[];
  evidence: string[];
  notes: string;
};

export type AdminBusiness = {
  id: string;
  name: string;
  handle: string;
  ownerName: string;
  ownerEmail: string;
  status: AdminBusinessStatus;
  verificationStatus: AdminVerificationStatus;
  operationalStatus: AdminBusinessOperationalStatus;
  plan: string;
  orders: number;
  gmvMinor: number;
  commissionMinor: number;
  riskLevel: AdminRiskLevel;
  lastActive: string;
  subaccountRef: string;
  suspensionReason: string;
  suspendedAt?: string;
  updatedAt: string;
};

export type AdminCustomer = {
  id: string;
  email: string;
  phone: string;
  displayName: string;
  tenantCount: number;
  orderCount: number;
  customOrderCount: number;
  gmvMinor: number;
  lastBusinessName: string;
  lastBusinessHandle: string;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminRiskReview = {
  id: string;
  businessId: string;
  title: string;
  business: string;
  level: AdminRiskLevel;
  reason: string;
  owner: string;
  status: AdminRiskReviewStatus;
  updatedAt: string;
};

export type AdminSupportTicket = {
  id: string;
  businessId: string;
  subject: string;
  business: string;
  priority: AdminSupportPriority;
  summary: string;
  category: string;
  status: AdminSupportTicketStatus;
  assignedAdminUserId?: string;
  assignedAdminEmail?: string;
  assignedAdminName?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuditEvent = {
  id: string;
  actor: string;
  actorRole: AdminRole | string;
  action: string;
  targetType: string;
  targetId: string;
  target: string;
  detail: string;
  severity: AdminAuditSeverity;
  createdAt: string;
};

export type AdminRoleDefinition = {
  role: AdminRole;
  label: string;
  permissions: string[];
};

export type AdminPermissionDefinition = {
  permission: string;
  label: string;
};

type AdminAuthPayload = {
  admin_user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

type AdminUserPayload = {
  admin_user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type AdminPreferencesPayload = {
  timezone: string;
  phone_number: string;
  notify_email: boolean;
  notify_sms: boolean;
  alert_verifications: boolean;
  alert_money_rails: boolean;
  alert_subscriptions: boolean;
  alert_promotions: boolean;
  alert_risk: boolean;
  alert_support: boolean;
  daily_digest_time: string;
  updated_at?: string;
};

type AdminProfileSettingsPayload = {
  user: AdminUserPayload;
  preferences: AdminPreferencesPayload;
};

type AdminPlatformSettingsPayload = {
  platform_name: string;
  support_email: string;
  verification_sla_hours: number;
  payout_review_threshold_pesewas: number;
  maintenance_mode: boolean;
  updated_at?: string;
};

type AdminPlatformMetricsPayload = {
  gmv_month_minor: number;
  platform_revenue_month_minor: number;
  active_businesses: number;
  total_businesses: number;
  pending_verifications: number;
  suspended_businesses: number;
  payment_health_bps: number;
  failed_payments_30d: number;
  total_payments_30d: number;
  updated_at: string;
};

type AdminOperationsHealthSignalPayload = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  target_label: string;
};

type AdminOperationsHealthPayload = {
  health_score: number;
  blocked_count: number;
  watch_count: number;
  payment_health_bps: number;
  failed_webhooks: number;
  payout_holds: number;
  open_risk_reviews: number;
  open_support_tickets: number;
  urgent_support_tickets: number;
  audit_events: number;
  critical_audit_events: number;
  signals: AdminOperationsHealthSignalPayload[];
  updated_at: string;
};

type AdminNotificationFeedItemPayload = {
  id: string;
  tone: AdminNotificationFeedTone;
  category: AdminNotificationFeedCategory;
  title: string;
  helper: string;
  meta: string;
  source: string;
  target: string;
  target_label: string;
};

type AdminNotificationFeedPayload = {
  notifications: AdminNotificationFeedItemPayload[];
  updated_at: string;
};

type AdminReportFeedItemPayload = {
  id: string;
  label: string;
  value: string;
  helper: string;
  status: AdminOperationsHealthStatus;
  target: string;
  target_label: string;
};

type AdminReportFeedPayload = {
  items: AdminReportFeedItemPayload[];
  updated_at: string;
};

type AdminLaunchReadinessCheckPayload = {
  id: string;
  category: string;
  label: string;
  status: AdminOperationsHealthStatus;
  summary: string;
  detail: string;
  action: string;
  target: string;
  target_label: string;
};

type AdminLaunchReadinessPayload = {
  environment: string;
  ready_count: number;
  watch_count: number;
  blocked_count: number;
  checks: AdminLaunchReadinessCheckPayload[];
  updated_at: string;
};

type AdminMoneyWebhookEventPayload = {
  id: string;
  provider_reference: string;
  business: string;
  status: AdminMoneyWebhookStatus;
  purpose: string;
  amount_minor: number;
  attempts: number;
  received_at: string;
  note: string;
};

type AdminMoneyPayoutReviewPayload = {
  id: string;
  business: string;
  subaccount_ref: string;
  status: AdminMoneyPayoutStatus;
  settlement_minor: number;
  commission_minor: number;
  next_action: string;
  hold_active: boolean;
  hold_reason: string;
  hold_updated_at?: string;
};

type AdminMoneyReplayRequestPayload = {
  replay_request_id: string;
  provider_reference: string;
  payment_id?: string;
  business: string;
  reason: string;
  status: string;
  created_at: string;
};

type AdminMoneyReversalPayload = {
  payment_id: string;
  provider_reference: string;
  business_id: string;
  business: string;
  order_id?: string;
  payment_reversed: boolean;
  promotion_redemption_count: number;
  affiliate_conversion_count: number;
  referral_count: number;
  referral_reward_count: number;
  generated_promotion_count: number;
  reason: string;
  reversed_at: string;
};

type AdminMoneyRailsPayload = {
  webhook_events: AdminMoneyWebhookEventPayload[];
  payout_reviews: AdminMoneyPayoutReviewPayload[];
  updated_at: string;
};

type AdminSubscriptionEventPayload = {
  subscription_event_id: string;
  event_type: string;
  summary: string;
  actor_email: string;
  created_at: string;
};

type AdminSubscriptionInvoicePayload = {
  invoice_id: string;
  subscription_id: string;
  invoice_ref: string;
  status: AdminSubscriptionInvoiceStatus;
  billing_mode: AdminSubscriptionBillingMode;
  provider: string;
  provider_invoice_ref: string;
  payment_url: string;
  amount_minor: number;
  currency: string;
  period_start: string;
  period_end: string;
  due_at: string;
  paid_at?: string;
  failed_at?: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
};

type AdminSubscriptionPayload = {
  subscription_id?: string;
  business_id: string;
  business_name: string;
  handle: string;
  owner_email: string;
  plan_code: string;
  plan_name: string;
  monthly_fee_minor: number;
  commission_bps: number;
  design_limit?: number;
  design_count?: number;
  status: AdminSubscriptionStatus;
  billing_mode: AdminSubscriptionBillingMode;
  provider: string;
  provider_customer_ref: string;
  provider_subscription_ref: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  grace_ends_at?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  failed_payment_count: number;
  last_invoice_ref: string;
  last_payment_at?: string;
  next_billing_at?: string;
  orders: number;
  gmv_minor: number;
  commission_minor: number;
  updated_at: string;
  events: AdminSubscriptionEventPayload[];
  invoices: AdminSubscriptionInvoicePayload[];
};

type AdminSubscriptionBillingSweepPayload = {
  overdue_invoices_failed: number;
  subscriptions_canceled: number;
  businesses_touched: number;
  ran_at: string;
};

type AdminSubscriptionRecurringSweepPayload = {
  due_subscriptions: number;
  charges_attempted: number;
  charges_paid: number;
  charges_pending: number;
  charges_failed: number;
  charges_skipped: number;
  ran_at: string;
};

type AdminSubscriptionAuthorizationLinkPayload = {
  business_id: string;
  business_name: string;
  owner_email: string;
  redirect_url: string;
  access_code: string;
  reference: string;
};

type AdminPlanPayload = {
  plan_id: string;
  code: string;
  name: string;
  monthly_fee_minor: number;
  commission_bps: number;
  design_limit?: number;
  features?: Record<string, boolean> | null;
  is_active: boolean;
  business_count: number;
  active_subscription_count: number;
  estimated_mrr_minor: number;
  created_at: string;
  updated_at: string;
};

type AdminPromotionPayload = {
  promotion_id: string;
  business_id?: string;
  business_name: string;
  business_handle: string;
  code: string;
  title: string;
  description: string;
  discount_type: AdminPromotionDiscountType;
  discount_value: number;
  max_discount_minor?: number;
  min_spend_minor: number;
  usage_limit_global?: number;
  usage_limit_per_customer?: number;
  funding_source: AdminPromotionFundingSource;
  scope: AdminPromotionScope;
  target_collection_id?: string;
  target_design_id?: string;
  status: AdminPromotionStatus;
  starts_at?: string;
  ends_at?: string;
  redemption_count: number;
  discount_redeemed_minor: number;
  recent_redemptions: {
    promotion_redemption_id: string;
    promotion_id: string;
    business_id: string;
    order_id?: string;
    customer_id?: string;
    customer_name: string;
    discount_minor: number;
    status: "pending" | "applied" | "void";
    redeemed_at?: string;
    created_at: string;
    updated_at: string;
  }[];
  created_at: string;
  updated_at: string;
};

type AdminAdCampaignPayload = {
  campaign_id: string;
  business_id: string;
  business_name: string;
  business_handle: string;
  placement_type: AdminAdPlacementType;
  target_ref_id: string;
  target_label: string;
  headline: string;
  description: string;
  status: AdminAdCampaignStatus;
  pricing_model: AdminAdPricingModel;
  budget_minor: number;
  spend_minor: number;
  daily_cap_minor?: number;
  starts_at: string;
  ends_at: string;
  impression_count: number;
  click_count: number;
  click_rate_bps: number;
  review_note: string;
  payments: AdminAdCampaignPaymentPayload[];
  created_at: string;
  updated_at: string;
};

type AdminAdCampaignPaymentPayload = {
  payment_id: string;
  campaign_id: string;
  business_id: string;
  provider: "paystack";
  provider_reference: string;
  payment_url: string;
  amount_minor: number;
  currency: string;
  status: "initiated" | "paid" | "failed" | "void";
  paid_at?: string;
  failed_at?: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
};

type AdminAdCampaignPaymentCollectPayload = {
  payment: AdminAdCampaignPaymentPayload;
  created: boolean;
  authorization_url: string;
};

type AdminAffiliatePayload = {
  affiliate_id: string;
  entity_type: AdminAffiliateEntityType;
  code: string;
  display_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website_url: string;
  commission_model: AdminAffiliateCommissionModel;
  commission_rate: number;
  cookie_window_days: number;
  payout_mode: AdminAffiliatePayoutMode;
  payout_reference: string;
  status: AdminAffiliateStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

type AdminAffiliateAttributionPayload = {
  affiliate_id: string;
  code: string;
  display_name: string;
  click_count: number;
  conversion_count: number;
  pending_conversion_count: number;
  approved_conversion_count: number;
  settled_conversion_count: number;
  reversed_conversion_count: number;
  gross_minor: number;
  commission_minor: number;
  recent_conversions: AdminAffiliateConversionPayload[];
  recent_payouts: AdminAffiliatePayoutPayload[];
  last_activity_at?: string;
};

type AdminAffiliateConversionPayload = {
  conversion_id: string;
  affiliate_id: string;
  business_id: string;
  business_name: string;
  order_id: string;
  gross_minor: number;
  commission_minor: number;
  status: AdminAffiliateConversion["status"];
  attribution_model: AdminAffiliateConversion["attributionModel"];
  hold_until?: string;
  created_at: string;
  updated_at: string;
};

type AdminAffiliatePayoutPayload = {
  payout_batch_id: string;
  affiliate_id: string;
  display_name: string;
  payout_mode: AdminAffiliatePayoutMode;
  payout_reference: string;
  conversion_count: number;
  gross_minor: number;
  commission_minor: number;
  status: AdminAffiliatePayout["status"];
  notes: string;
  created_at: string;
  updated_at: string;
};

type AdminReferralProgrammePayload = {
  programme_id: string;
  title: string;
  code_prefix: string;
  audience: AdminReferralAudience;
  referrer_reward_kind: AdminReferralRewardKind;
  referee_reward_kind: AdminReferralRefereeRewardKind;
  reward_type: AdminReferralRewardType;
  reward_value: number;
  max_reward_minor?: number;
  qualifying_order_min_minor: number;
  reward_hold_days: number;
  status: AdminReferralProgrammeStatus;
  starts_at?: string;
  ends_at?: string;
  notes: string;
  codes?: AdminReferralCodePayload[];
  created_at: string;
  updated_at: string;
};

type AdminReferralCodePayload = {
  referral_code_id: string;
  programme_id: string;
  business_id?: string;
  business_name: string;
  business_handle: string;
  owner_type: AdminReferralCodeOwnerType;
  owner_business_id?: string;
  owner_customer_id?: string;
  owner_label: string;
  code: string;
  status: AdminReferralCodeStatus;
  referral_count: number;
  qualified_count: number;
  rewarded_count: number;
  created_at: string;
  updated_at: string;
};

type AdminReferralRewardIssuePayload = {
  referral_count: number;
  reward_count: number;
  voucher_count: number;
  commission_rebate_count: number;
  total_reward_minor: number;
  issued_at: string;
};

type AdminRiskReviewPayload = {
  review_key: string;
  business_id: string;
  title: string;
  business: string;
  level: AdminRiskLevel;
  reason: string;
  owner: string;
  status: AdminRiskReviewStatus;
  updated_at: string;
};

type AdminSupportTicketPayload = {
  ticket_key: string;
  business_id: string;
  subject: string;
  business: string;
  priority: AdminSupportPriority;
  summary: string;
  category: string;
  status: AdminSupportTicketStatus;
  assigned_admin_user_id?: string;
  assigned_admin_email?: string;
  assigned_admin_name?: string;
  created_at: string;
  updated_at: string;
};

type AdminAuditEventPayload = {
  audit_event_id: string;
  actor_email: string;
  actor_role: AdminRole | string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  summary: string;
  severity: AdminAuditSeverity;
  created_at: string;
};

type AdminVerificationCasePayload = {
  business_id: string;
  business_name: string;
  handle: string;
  owner_name: string;
  owner_email: string;
  submitted_at: string;
  updated_at: string;
  plan: string;
  status: AdminVerificationStatus;
  risk_level: AdminRiskLevel;
  documents: string[];
  checks: string[];
  evidence: string[];
  notes: string;
};

type AdminBusinessPayload = {
  business_id: string;
  name: string;
  handle: string;
  owner_name: string;
  owner_email: string;
  status: AdminBusinessStatus;
  verification_status: AdminVerificationStatus;
  operational_status: AdminBusinessOperationalStatus;
  plan: string;
  orders: number;
  gmv_minor: number;
  commission_minor: number;
  risk_level: AdminRiskLevel;
  last_active: string;
  subaccount_ref: string;
  suspension_reason: string;
  suspended_at?: string;
  updated_at: string;
};

type AdminCustomerPayload = {
  customer_id: string;
  email: string;
  phone: string;
  display_name: string;
  tenant_count: number;
  order_count: number;
  custom_order_count: number;
  gmv_minor: number;
  last_business_name: string;
  last_business_handle: string;
  last_active: string;
  created_at: string;
  updated_at: string;
};

type AdminRolePayload = {
  role: AdminRole;
  label: string;
  permissions: string[];
};

type AdminPermissionPayload = {
  permission: string;
  label: string;
};

export class AdminApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

async function requestJSON<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminApiError(503, "admin_api_unavailable");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AdminApiError(
      response.status,
      payload?.error ?? "admin_api_error",
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestText(path: string, init: RequestInit): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new AdminApiError(503, "admin_api_unavailable");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AdminApiError(
      response.status,
      payload?.error ?? "admin_api_error",
    );
  }

  return response.text();
}

function mapAuth(payload: AdminAuthPayload): AdminAuthResult {
  return {
    adminUserId: payload.admin_user_id,
    email: payload.email,
    displayName: payload.display_name,
    role: payload.role,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessExpiresAt: payload.access_expires_at,
    refreshExpiresAt: payload.refresh_expires_at,
  };
}

function mapUser(payload: AdminUserPayload): AdminUser {
  return {
    adminUserId: payload.admin_user_id,
    email: payload.email,
    displayName: payload.display_name,
    role: payload.role,
    isActive: payload.is_active,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapPreferences(payload: AdminPreferencesPayload): AdminPreferences {
  return {
    timezone: payload.timezone,
    phoneNumber: payload.phone_number,
    notifyEmail: payload.notify_email,
    notifySms: payload.notify_sms,
    alertVerifications: payload.alert_verifications,
    alertMoneyRails: payload.alert_money_rails,
    alertSubscriptions: payload.alert_subscriptions,
    alertPromotions: payload.alert_promotions,
    alertRisk: payload.alert_risk,
    alertSupport: payload.alert_support,
    dailyDigestTime: payload.daily_digest_time,
    updatedAt: payload.updated_at,
  };
}

function mapProfileSettings(
  payload: AdminProfileSettingsPayload,
): AdminProfileSettings {
  return {
    user: mapUser(payload.user),
    preferences: mapPreferences(payload.preferences),
  };
}

function mapPlatformSettings(
  payload: AdminPlatformSettingsPayload,
): AdminPlatformSettings {
  return {
    platformName: payload.platform_name,
    supportEmail: payload.support_email,
    verificationSlaHours: payload.verification_sla_hours,
    payoutReviewThresholdPesewas: payload.payout_review_threshold_pesewas,
    maintenanceMode: payload.maintenance_mode,
    updatedAt: payload.updated_at,
  };
}

function mapPlatformMetrics(
  payload: AdminPlatformMetricsPayload,
): AdminPlatformMetrics {
  return {
    gmvMonthMinor: payload.gmv_month_minor,
    platformRevenueMonthMinor: payload.platform_revenue_month_minor,
    activeBusinesses: payload.active_businesses,
    totalBusinesses: payload.total_businesses,
    pendingVerifications: payload.pending_verifications,
    suspendedBusinesses: payload.suspended_businesses,
    paymentHealthBps: payload.payment_health_bps,
    failedPayments30d: payload.failed_payments_30d,
    totalPayments30d: payload.total_payments_30d,
    updatedAt: payload.updated_at,
  };
}

function mapOperationsHealth(
  payload: AdminOperationsHealthPayload,
): AdminOperationsHealth {
  return {
    healthScore: payload.health_score,
    blockedCount: payload.blocked_count,
    watchCount: payload.watch_count,
    paymentHealthBps: payload.payment_health_bps,
    failedWebhooks: payload.failed_webhooks,
    payoutHolds: payload.payout_holds,
    openRiskReviews: payload.open_risk_reviews,
    openSupportTickets: payload.open_support_tickets,
    urgentSupportTickets: payload.urgent_support_tickets,
    auditEvents: payload.audit_events,
    criticalAuditEvents: payload.critical_audit_events,
    signals: payload.signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      value: signal.value,
      helper: signal.helper,
      status: signal.status,
      target: signal.target,
      targetLabel: signal.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapAdminNotificationFeed(
  payload: AdminNotificationFeedPayload,
): AdminNotificationFeed {
  return {
    notifications: payload.notifications.map((notification) => ({
      id: notification.id,
      tone: notification.tone,
      category: notification.category,
      title: notification.title,
      helper: notification.helper,
      meta: notification.meta,
      source: notification.source,
      target: notification.target,
      targetLabel: notification.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapAdminReportFeed(payload: AdminReportFeedPayload): AdminReportFeed {
  return {
    items: payload.items.map((item) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      helper: item.helper,
      status: item.status,
      target: item.target,
      targetLabel: item.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapAdminLaunchReadiness(
  payload: AdminLaunchReadinessPayload,
): AdminLaunchReadiness {
  return {
    environment: payload.environment,
    readyCount: payload.ready_count,
    watchCount: payload.watch_count,
    blockedCount: payload.blocked_count,
    checks: payload.checks.map((check) => ({
      id: check.id,
      category: check.category,
      label: check.label,
      status: check.status,
      summary: check.summary,
      detail: check.detail,
      action: check.action,
      target: check.target,
      targetLabel: check.target_label,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapMoneyRails(payload: AdminMoneyRailsPayload): AdminMoneyRails {
  return {
    webhookEvents: payload.webhook_events.map((event) => ({
      id: event.id,
      providerReference: event.provider_reference,
      business: event.business,
      status: event.status,
      purpose: event.purpose,
      amountMinor: event.amount_minor,
      attempts: event.attempts,
      receivedAt: event.received_at,
      note: event.note,
    })),
    payoutReviews: payload.payout_reviews.map((review) => ({
      id: review.id,
      business: review.business,
      subaccountRef: review.subaccount_ref,
      status: review.status,
      settlementMinor: review.settlement_minor,
      commissionMinor: review.commission_minor,
      nextAction: review.next_action,
      holdActive: review.hold_active,
      holdReason: review.hold_reason,
      holdUpdatedAt: review.hold_updated_at,
    })),
    updatedAt: payload.updated_at,
  };
}

function mapSubscription(payload: AdminSubscriptionPayload): AdminSubscription {
  return {
    subscriptionId: payload.subscription_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    handle: payload.handle,
    ownerEmail: payload.owner_email,
    planCode: payload.plan_code,
    planName: payload.plan_name,
    monthlyFeeMinor: payload.monthly_fee_minor,
    commissionBps: payload.commission_bps,
    designLimit: payload.design_limit,
    designCount: payload.design_count ?? 0,
    status: payload.status,
    billingMode: payload.billing_mode,
    provider: payload.provider,
    providerCustomerRef: payload.provider_customer_ref,
    providerSubscriptionRef: payload.provider_subscription_ref,
    currentPeriodStart: payload.current_period_start,
    currentPeriodEnd: payload.current_period_end,
    trialEndsAt: payload.trial_ends_at,
    graceEndsAt: payload.grace_ends_at,
    cancelAtPeriodEnd: payload.cancel_at_period_end,
    canceledAt: payload.canceled_at,
    failedPaymentCount: payload.failed_payment_count,
    lastInvoiceRef: payload.last_invoice_ref,
    lastPaymentAt: payload.last_payment_at,
    nextBillingAt: payload.next_billing_at,
    orders: payload.orders,
    gmvMinor: payload.gmv_minor,
    commissionMinor: payload.commission_minor,
    updatedAt: payload.updated_at,
    events: payload.events.map((event) => ({
      id: event.subscription_event_id,
      eventType: event.event_type,
      summary: event.summary,
      actorEmail: event.actor_email,
      createdAt: event.created_at,
    })),
    invoices: payload.invoices.map((invoice) => ({
      invoiceId: invoice.invoice_id,
      subscriptionId: invoice.subscription_id,
      invoiceRef: invoice.invoice_ref,
      status: invoice.status,
      billingMode: invoice.billing_mode,
      provider: invoice.provider,
      providerInvoiceRef: invoice.provider_invoice_ref,
      paymentUrl: invoice.payment_url,
      amountMinor: invoice.amount_minor,
      currency: invoice.currency,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      dueAt: invoice.due_at,
      paidAt: invoice.paid_at,
      failedAt: invoice.failed_at,
      failureReason: invoice.failure_reason,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    })),
  };
}

function mapSubscriptionBillingSweep(
  payload: AdminSubscriptionBillingSweepPayload,
): AdminSubscriptionBillingSweep {
  return {
    overdueInvoicesFailed: payload.overdue_invoices_failed,
    subscriptionsCanceled: payload.subscriptions_canceled,
    businessesTouched: payload.businesses_touched,
    ranAt: payload.ran_at,
  };
}

function mapSubscriptionRecurringSweep(
  payload: AdminSubscriptionRecurringSweepPayload,
): AdminSubscriptionRecurringSweep {
  return {
    dueSubscriptions: payload.due_subscriptions,
    chargesAttempted: payload.charges_attempted,
    chargesPaid: payload.charges_paid,
    chargesPending: payload.charges_pending,
    chargesFailed: payload.charges_failed,
    chargesSkipped: payload.charges_skipped,
    ranAt: payload.ran_at,
  };
}

function mapSubscriptionAuthorizationLink(
  payload: AdminSubscriptionAuthorizationLinkPayload,
): AdminSubscriptionAuthorizationLink {
  return {
    businessId: payload.business_id,
    businessName: payload.business_name,
    ownerEmail: payload.owner_email,
    redirectUrl: payload.redirect_url,
    accessCode: payload.access_code,
    reference: payload.reference,
  };
}

function mapPlan(payload: AdminPlanPayload): AdminPlan {
  return {
    planId: payload.plan_id,
    code: payload.code,
    name: payload.name,
    monthlyFeeMinor: payload.monthly_fee_minor,
    commissionBps: payload.commission_bps,
    designLimit: payload.design_limit,
    features: payload.features ?? {},
    isActive: payload.is_active,
    businessCount: payload.business_count,
    activeSubscriptionCount: payload.active_subscription_count,
    estimatedMrrMinor: payload.estimated_mrr_minor,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapPromotion(payload: AdminPromotionPayload): AdminPromotion {
  return {
    promotionId: payload.promotion_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    code: payload.code,
    title: payload.title,
    description: payload.description,
    discountType: payload.discount_type,
    discountValue: payload.discount_value,
    maxDiscountMinor: payload.max_discount_minor,
    minSpendMinor: payload.min_spend_minor,
    usageLimitGlobal: payload.usage_limit_global,
    usageLimitPerCustomer: payload.usage_limit_per_customer,
    fundingSource: payload.funding_source,
    scope: payload.scope,
    targetCollectionId: payload.target_collection_id,
    targetDesignId: payload.target_design_id,
    status: payload.status,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    redemptionCount: payload.redemption_count,
    discountRedeemedMinor: payload.discount_redeemed_minor,
    recentRedemptions: (payload.recent_redemptions ?? []).map((redemption) => ({
      promotionRedemptionId: redemption.promotion_redemption_id,
      promotionId: redemption.promotion_id,
      businessId: redemption.business_id,
      orderId: redemption.order_id,
      customerId: redemption.customer_id,
      customerName: redemption.customer_name,
      discountMinor: redemption.discount_minor,
      status: redemption.status,
      redeemedAt: redemption.redeemed_at,
      createdAt: redemption.created_at,
      updatedAt: redemption.updated_at,
    })),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAdCampaign(payload: AdminAdCampaignPayload): AdminAdCampaign {
  return {
    campaignId: payload.campaign_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    placementType: payload.placement_type,
    targetRefId: payload.target_ref_id,
    targetLabel: payload.target_label,
    headline: payload.headline,
    description: payload.description,
    status: payload.status,
    pricingModel: payload.pricing_model,
    budgetMinor: payload.budget_minor,
    spendMinor: payload.spend_minor,
    dailyCapMinor: payload.daily_cap_minor,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    impressionCount: payload.impression_count,
    clickCount: payload.click_count,
    clickRateBps: payload.click_rate_bps,
    reviewNote: payload.review_note,
    payments: (payload.payments ?? []).map(mapAdCampaignPayment),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAdCampaignPayment(
  payload: AdminAdCampaignPaymentPayload,
): AdminAdCampaignPayment {
  return {
    paymentId: payload.payment_id,
    campaignId: payload.campaign_id,
    businessId: payload.business_id,
    provider: payload.provider,
    providerReference: payload.provider_reference,
    paymentUrl: payload.payment_url,
    amountMinor: payload.amount_minor,
    currency: payload.currency,
    status: payload.status,
    paidAt: payload.paid_at,
    failedAt: payload.failed_at,
    failureReason: payload.failure_reason,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliate(payload: AdminAffiliatePayload): AdminAffiliate {
  return {
    affiliateId: payload.affiliate_id,
    entityType: payload.entity_type,
    code: payload.code,
    displayName: payload.display_name,
    contactName: payload.contact_name,
    email: payload.email,
    phone: payload.phone,
    websiteUrl: payload.website_url,
    commissionModel: payload.commission_model,
    commissionRate: payload.commission_rate,
    cookieWindowDays: payload.cookie_window_days,
    payoutMode: payload.payout_mode,
    payoutReference: payload.payout_reference,
    status: payload.status,
    notes: payload.notes,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliateAttribution(
  payload: AdminAffiliateAttributionPayload,
): AdminAffiliateAttribution {
  return {
    affiliateId: payload.affiliate_id,
    code: payload.code,
    displayName: payload.display_name,
    clickCount: payload.click_count,
    conversionCount: payload.conversion_count,
    pendingConversionCount: payload.pending_conversion_count,
    approvedConversionCount: payload.approved_conversion_count,
    settledConversionCount: payload.settled_conversion_count,
    reversedConversionCount: payload.reversed_conversion_count,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    recentConversions: payload.recent_conversions.map(mapAffiliateConversion),
    recentPayouts: (payload.recent_payouts ?? []).map(mapAffiliatePayout),
    lastActivityAt: payload.last_activity_at,
  };
}

function mapAffiliateConversion(
  payload: AdminAffiliateConversionPayload,
): AdminAffiliateConversion {
  return {
    conversionId: payload.conversion_id,
    affiliateId: payload.affiliate_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    orderId: payload.order_id,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    status: payload.status,
    attributionModel: payload.attribution_model,
    holdUntil: payload.hold_until,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAffiliatePayout(
  payload: AdminAffiliatePayoutPayload,
): AdminAffiliatePayout {
  return {
    payoutBatchId: payload.payout_batch_id,
    affiliateId: payload.affiliate_id,
    displayName: payload.display_name,
    payoutMode: payload.payout_mode,
    payoutReference: payload.payout_reference,
    conversionCount: payload.conversion_count,
    grossMinor: payload.gross_minor,
    commissionMinor: payload.commission_minor,
    status: payload.status,
    notes: payload.notes,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapReferralProgramme(
  payload: AdminReferralProgrammePayload,
): AdminReferralProgramme {
  return {
    programmeId: payload.programme_id,
    title: payload.title,
    codePrefix: payload.code_prefix,
    audience: payload.audience,
    referrerRewardKind: payload.referrer_reward_kind,
    refereeRewardKind: payload.referee_reward_kind,
    rewardType: payload.reward_type,
    rewardValue: payload.reward_value,
    maxRewardMinor: payload.max_reward_minor,
    qualifyingOrderMinMinor: payload.qualifying_order_min_minor,
    rewardHoldDays: payload.reward_hold_days,
    status: payload.status,
    startsAt: payload.starts_at,
    endsAt: payload.ends_at,
    notes: payload.notes,
    codes: (payload.codes ?? []).map(mapReferralCode),
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapReferralRewardIssue(
  payload: AdminReferralRewardIssuePayload,
): AdminReferralRewardIssue {
  return {
    referralCount: payload.referral_count,
    rewardCount: payload.reward_count,
    voucherCount: payload.voucher_count,
    commissionRebateCount: payload.commission_rebate_count,
    totalRewardMinor: payload.total_reward_minor,
    issuedAt: payload.issued_at,
  };
}

function mapReferralCode(payload: AdminReferralCodePayload): AdminReferralCode {
  return {
    referralCodeId: payload.referral_code_id,
    programmeId: payload.programme_id,
    businessId: payload.business_id,
    businessName: payload.business_name,
    businessHandle: payload.business_handle,
    ownerType: payload.owner_type,
    ownerBusinessId: payload.owner_business_id,
    ownerCustomerId: payload.owner_customer_id,
    ownerLabel: payload.owner_label,
    code: payload.code,
    status: payload.status,
    referralCount: payload.referral_count,
    qualifiedCount: payload.qualified_count,
    rewardedCount: payload.rewarded_count,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapRiskReview(payload: AdminRiskReviewPayload): AdminRiskReview {
  return {
    id: payload.review_key,
    businessId: payload.business_id,
    title: payload.title,
    business: payload.business,
    level: payload.level,
    reason: payload.reason,
    owner: payload.owner,
    status: payload.status,
    updatedAt: payload.updated_at,
  };
}

function mapSupportTicket(
  payload: AdminSupportTicketPayload,
): AdminSupportTicket {
  return {
    id: payload.ticket_key,
    businessId: payload.business_id,
    subject: payload.subject,
    business: payload.business,
    priority: payload.priority,
    summary: payload.summary,
    category: payload.category,
    status: payload.status,
    assignedAdminUserId: payload.assigned_admin_user_id,
    assignedAdminEmail: payload.assigned_admin_email,
    assignedAdminName: payload.assigned_admin_name,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapAuditEvent(payload: AdminAuditEventPayload): AdminAuditEvent {
  return {
    id: payload.audit_event_id,
    actor: payload.actor_email || "system",
    actorRole: payload.actor_role,
    action: payload.action,
    targetType: payload.target_type,
    targetId: payload.target_id,
    target: payload.target_label || payload.target_id,
    detail: payload.summary,
    severity: payload.severity,
    createdAt: payload.created_at,
  };
}

function mapVerificationCase(
  payload: AdminVerificationCasePayload,
): AdminVerificationCase {
  return {
    id: payload.business_id,
    businessName: payload.business_name,
    handle: payload.handle,
    ownerName: payload.owner_name,
    ownerEmail: payload.owner_email,
    submittedAt: payload.submitted_at,
    updatedAt: payload.updated_at,
    plan: payload.plan,
    status: payload.status,
    riskLevel: payload.risk_level,
    documents: payload.documents,
    checks: payload.checks,
    evidence: payload.evidence,
    notes: payload.notes,
  };
}

function mapBusiness(payload: AdminBusinessPayload): AdminBusiness {
  return {
    id: payload.business_id,
    name: payload.name,
    handle: payload.handle,
    ownerName: payload.owner_name,
    ownerEmail: payload.owner_email,
    status: payload.status,
    verificationStatus: payload.verification_status,
    operationalStatus: payload.operational_status,
    plan: payload.plan,
    orders: payload.orders,
    gmvMinor: payload.gmv_minor,
    commissionMinor: payload.commission_minor,
    riskLevel: payload.risk_level,
    lastActive: payload.last_active,
    subaccountRef: payload.subaccount_ref,
    suspensionReason: payload.suspension_reason,
    suspendedAt: payload.suspended_at,
    updatedAt: payload.updated_at,
  };
}

function mapCustomer(payload: AdminCustomerPayload): AdminCustomer {
  return {
    id: payload.customer_id,
    email: payload.email,
    phone: payload.phone,
    displayName: payload.display_name,
    tenantCount: payload.tenant_count,
    orderCount: payload.order_count,
    customOrderCount: payload.custom_order_count,
    gmvMinor: payload.gmv_minor,
    lastBusinessName: payload.last_business_name,
    lastBusinessHandle: payload.last_business_handle,
    lastActive: payload.last_active,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
  };
}

function mapRole(payload: AdminRolePayload): AdminRoleDefinition {
  return {
    role: payload.role,
    label: payload.label,
    permissions: payload.permissions,
  };
}

function mapPermission(
  payload: AdminPermissionPayload,
): AdminPermissionDefinition {
  return {
    permission: payload.permission,
    label: payload.label,
  };
}

export const adminApi = {
  login: async (email: string, password: string) => {
    const payload = await requestJSON<AdminAuthPayload>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return mapAuth(payload);
  },
  refresh: async (refreshToken: string) => {
    const payload = await requestJSON<AdminAuthPayload>("/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return mapAuth(payload);
  },
  logout: (refreshToken: string) =>
    requestJSON<undefined>("/admin/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  me: async (accessToken: string) => {
    const payload = await requestJSON<AdminUserPayload>("/admin/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return mapUser(payload);
  },
  profileSettings: async (accessToken: string) => {
    const payload = await requestJSON<AdminProfileSettingsPayload>(
      "/admin/settings/profile",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return mapProfileSettings(payload);
  },
  updateProfile: (
    accessToken: string,
    input: { displayName: string; email: string },
  ) =>
    requestJSON<AdminUserPayload>("/admin/settings/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        display_name: input.displayName,
        email: input.email,
      }),
    }).then(mapUser),
  updatePreferences: (
    accessToken: string,
    input: {
      timezone: string;
      phoneNumber: string;
      notifyEmail: boolean;
      notifySms: boolean;
      alertVerifications: boolean;
      alertMoneyRails: boolean;
      alertSubscriptions: boolean;
      alertPromotions: boolean;
      alertRisk: boolean;
      alertSupport: boolean;
      dailyDigestTime: string;
    },
  ) =>
    requestJSON<AdminPreferencesPayload>("/admin/settings/preferences", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        timezone: input.timezone,
        phone_number: input.phoneNumber,
        notify_email: input.notifyEmail,
        notify_sms: input.notifySms,
        alert_verifications: input.alertVerifications,
        alert_money_rails: input.alertMoneyRails,
        alert_subscriptions: input.alertSubscriptions,
        alert_promotions: input.alertPromotions,
        alert_risk: input.alertRisk,
        alert_support: input.alertSupport,
        daily_digest_time: input.dailyDigestTime,
      }),
    }).then(mapPreferences),
  platformSettings: async (accessToken: string) => {
    const payload = await requestJSON<AdminPlatformSettingsPayload>(
      "/admin/settings/platform",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return mapPlatformSettings(payload);
  },
  updatePlatformSettings: (
    accessToken: string,
    input: {
      platformName: string;
      supportEmail: string;
      verificationSlaHours: number;
      payoutReviewThresholdPesewas: number;
      maintenanceMode: boolean;
    },
  ) =>
    requestJSON<AdminPlatformSettingsPayload>("/admin/settings/platform", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        platform_name: input.platformName,
        support_email: input.supportEmail,
        verification_sla_hours: input.verificationSlaHours,
        payout_review_threshold_pesewas: input.payoutReviewThresholdPesewas,
        maintenance_mode: input.maintenanceMode,
      }),
    }).then(mapPlatformSettings),
  platformMetrics: (accessToken: string) =>
    requestJSON<AdminPlatformMetricsPayload>("/admin/platform-metrics", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapPlatformMetrics),
  operationsHealth: (accessToken: string) =>
    requestJSON<AdminOperationsHealthPayload>("/admin/operations-health", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapOperationsHealth),
  adminNotifications: (accessToken: string) =>
    requestJSON<AdminNotificationFeedPayload>("/admin/notifications", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapAdminNotificationFeed),
  adminReports: (accessToken: string) =>
    requestJSON<AdminReportFeedPayload>("/admin/reports", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapAdminReportFeed),
  launchReadiness: (accessToken: string) =>
    requestJSON<AdminLaunchReadinessPayload>("/admin/launch-readiness", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapAdminLaunchReadiness),
  moneyRails: (accessToken: string) =>
    requestJSON<AdminMoneyRailsPayload>("/admin/money-rails", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(mapMoneyRails),
  subscriptions: async (accessToken: string) => {
    const payload = await requestJSON<{
      subscriptions: AdminSubscriptionPayload[];
    }>("/admin/subscriptions", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.subscriptions.map(mapSubscription);
  },
  updateSubscription: (
    accessToken: string,
    businessId: string,
    input: {
      status: AdminSubscriptionStatus;
      billingMode: AdminSubscriptionBillingMode;
      providerCustomerRef: string;
      providerSubscriptionRef: string;
      reason: string;
    },
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          billing_mode: input.billingMode,
          provider_customer_ref: input.providerCustomerRef,
          provider_subscription_ref: input.providerSubscriptionRef,
          reason: input.reason,
        }),
      },
    ).then(mapSubscription),
  issueSubscriptionInvoice: (
    accessToken: string,
    businessId: string,
    input: {
      providerInvoiceRef: string;
      paymentUrl: string;
      dueAt?: string;
      reason: string;
    },
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(
        businessId,
      )}/invoices`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider_invoice_ref: input.providerInvoiceRef,
          payment_url: input.paymentUrl,
          due_at: input.dueAt,
          reason: input.reason,
        }),
      },
    ).then(mapSubscription),
  markSubscriptionInvoicePaid: (
    accessToken: string,
    invoiceId: string,
    reason: string,
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/invoices/${encodeURIComponent(invoiceId)}/paid`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscription),
  markSubscriptionInvoiceFailed: (
    accessToken: string,
    invoiceId: string,
    reason: string,
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/invoices/${encodeURIComponent(invoiceId)}/failed`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscription),
  runSubscriptionBillingSweep: (accessToken: string, reason: string) =>
    requestJSON<AdminSubscriptionBillingSweepPayload>(
      "/admin/subscriptions/billing-sweeps",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscriptionBillingSweep),
  runSubscriptionRecurringSweep: (accessToken: string, reason: string) =>
    requestJSON<AdminSubscriptionRecurringSweepPayload>(
      "/admin/subscriptions/recurring-charges",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapSubscriptionRecurringSweep),
  initializeSubscriptionAuthorization: (
    accessToken: string,
    businessId: string,
    input: { callbackUrl: string; reason: string },
  ) =>
    requestJSON<AdminSubscriptionAuthorizationLinkPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(
        businessId,
      )}/authorization-link`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          callback_url: input.callbackUrl,
          reason: input.reason,
        }),
      },
    ).then(mapSubscriptionAuthorizationLink),
  verifySubscriptionAuthorization: (
    accessToken: string,
    businessId: string,
    input: { reference: string; reason: string },
  ) =>
    requestJSON<AdminSubscriptionPayload>(
      `/admin/subscriptions/businesses/${encodeURIComponent(
        businessId,
      )}/authorization-verifications`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          reference: input.reference,
          reason: input.reason,
        }),
      },
    ).then(mapSubscription),
  plans: async (accessToken: string) => {
    const payload = await requestJSON<{ plans: AdminPlanPayload[] }>(
      "/admin/plans",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.plans.map(mapPlan);
  },
  createPlan: (
    accessToken: string,
    input: {
      code: string;
      name: string;
      monthlyFeeMinor: number;
      commissionBps: number;
      designLimit?: number;
      features?: Record<string, boolean>;
    },
  ) =>
    requestJSON<AdminPlanPayload>("/admin/plans", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        code: input.code,
        name: input.name,
        monthly_fee_minor: input.monthlyFeeMinor,
        commission_bps: input.commissionBps,
        design_limit: input.designLimit,
        features: input.features ?? {},
      }),
    }).then(mapPlan),
  updatePlan: (
    accessToken: string,
    planId: string,
    input: {
      name: string;
      monthlyFeeMinor: number;
      commissionBps: number;
      designLimit?: number;
      features?: Record<string, boolean>;
      isActive: boolean;
    },
  ) =>
    requestJSON<AdminPlanPayload>(
      `/admin/plans/${encodeURIComponent(planId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: input.name,
          monthly_fee_minor: input.monthlyFeeMinor,
          commission_bps: input.commissionBps,
          design_limit: input.designLimit,
          features: input.features ?? {},
          is_active: input.isActive,
        }),
      },
    ).then(mapPlan),
  archivePlan: (accessToken: string, planId: string, reason: string) =>
    requestJSON<AdminPlanPayload>(
      `/admin/plans/${encodeURIComponent(planId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapPlan),
  promotions: async (accessToken: string) => {
    const payload = await requestJSON<{ promotions: AdminPromotionPayload[] }>(
      "/admin/promotions",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.promotions.map(mapPromotion);
  },
  createPromotion: (
    accessToken: string,
    input: {
      businessId?: string;
      code: string;
      title: string;
      description: string;
      discountType: AdminPromotionDiscountType;
      discountValue: number;
      maxDiscountMinor?: number;
      minSpendMinor: number;
      usageLimitGlobal?: number;
      usageLimitPerCustomer?: number;
      fundingSource: AdminPromotionFundingSource;
      scope: AdminPromotionScope;
      targetCollectionId?: string;
      targetDesignId?: string;
      status: Exclude<AdminPromotionStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
    },
  ) =>
    requestJSON<AdminPromotionPayload>("/admin/promotions", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        business_id: input.businessId,
        code: input.code,
        title: input.title,
        description: input.description,
        discount_type: input.discountType,
        discount_value: input.discountValue,
        max_discount_minor: input.maxDiscountMinor,
        min_spend_minor: input.minSpendMinor,
        usage_limit_global: input.usageLimitGlobal,
        usage_limit_per_customer: input.usageLimitPerCustomer,
        funding_source: input.fundingSource,
        scope: input.scope,
        target_collection_id: input.targetCollectionId,
        target_design_id: input.targetDesignId,
        status: input.status,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
      }),
    }).then(mapPromotion),
  updatePromotion: (
    accessToken: string,
    promotionId: string,
    input: {
      businessId?: string;
      code: string;
      title: string;
      description: string;
      discountType: AdminPromotionDiscountType;
      discountValue: number;
      maxDiscountMinor?: number;
      minSpendMinor: number;
      usageLimitGlobal?: number;
      usageLimitPerCustomer?: number;
      fundingSource: AdminPromotionFundingSource;
      scope: AdminPromotionScope;
      targetCollectionId?: string;
      targetDesignId?: string;
      status: Exclude<AdminPromotionStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
    },
  ) =>
    requestJSON<AdminPromotionPayload>(
      `/admin/promotions/${encodeURIComponent(promotionId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          business_id: input.businessId,
          code: input.code,
          title: input.title,
          description: input.description,
          discount_type: input.discountType,
          discount_value: input.discountValue,
          max_discount_minor: input.maxDiscountMinor,
          min_spend_minor: input.minSpendMinor,
          usage_limit_global: input.usageLimitGlobal,
          usage_limit_per_customer: input.usageLimitPerCustomer,
          funding_source: input.fundingSource,
          scope: input.scope,
          target_collection_id: input.targetCollectionId,
          target_design_id: input.targetDesignId,
          status: input.status,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
        }),
      },
    ).then(mapPromotion),
  archivePromotion: (
    accessToken: string,
    promotionId: string,
    reason: string,
  ) =>
    requestJSON<AdminPromotionPayload>(
      `/admin/promotions/${encodeURIComponent(promotionId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapPromotion),
  adCampaigns: async (accessToken: string) => {
    const payload = await requestJSON<{ campaigns: AdminAdCampaignPayload[] }>(
      "/admin/ad-campaigns",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.campaigns.map(mapAdCampaign);
  },
  createAdCampaign: (
    accessToken: string,
    input: {
      businessId: string;
      placementType: AdminAdPlacementType;
      targetRefId: string;
      headline: string;
      description: string;
      status: Exclude<AdminAdCampaignStatus, "archived">;
      pricingModel: AdminAdPricingModel;
      budgetMinor: number;
      dailyCapMinor?: number;
      startsAt?: string;
      endsAt?: string;
      reviewNote: string;
    },
  ) =>
    requestJSON<AdminAdCampaignPayload>("/admin/ad-campaigns", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        business_id: input.businessId,
        placement_type: input.placementType,
        target_ref_id: input.targetRefId,
        headline: input.headline,
        description: input.description,
        status: input.status,
        pricing_model: input.pricingModel,
        budget_minor: input.budgetMinor,
        daily_cap_minor: input.dailyCapMinor,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        review_note: input.reviewNote,
      }),
    }).then(mapAdCampaign),
  updateAdCampaign: (
    accessToken: string,
    campaignId: string,
    input: {
      businessId: string;
      placementType: AdminAdPlacementType;
      targetRefId: string;
      headline: string;
      description: string;
      status: Exclude<AdminAdCampaignStatus, "archived">;
      pricingModel: AdminAdPricingModel;
      budgetMinor: number;
      dailyCapMinor?: number;
      startsAt?: string;
      endsAt?: string;
      reviewNote: string;
    },
  ) =>
    requestJSON<AdminAdCampaignPayload>(
      `/admin/ad-campaigns/${encodeURIComponent(campaignId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          business_id: input.businessId,
          placement_type: input.placementType,
          target_ref_id: input.targetRefId,
          headline: input.headline,
          description: input.description,
          status: input.status,
          pricing_model: input.pricingModel,
          budget_minor: input.budgetMinor,
          daily_cap_minor: input.dailyCapMinor,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          review_note: input.reviewNote,
        }),
      },
    ).then(mapAdCampaign),
  archiveAdCampaign: (
    accessToken: string,
    campaignId: string,
    reason: string,
  ) =>
    requestJSON<AdminAdCampaignPayload>(
      `/admin/ad-campaigns/${encodeURIComponent(campaignId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapAdCampaign),
  collectAdCampaignPayment: (
    accessToken: string,
    campaignId: string,
    customerEmail: string,
  ) =>
    requestJSON<AdminAdCampaignPaymentCollectPayload>(
      `/admin/ad-campaigns/${encodeURIComponent(campaignId)}/payments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ customer_email: customerEmail }),
      },
    ).then((payload) => ({
      payment: mapAdCampaignPayment(payload.payment),
      created: payload.created,
      authorizationUrl: payload.authorization_url,
    })),
  affiliates: async (accessToken: string) => {
    const payload = await requestJSON<{ affiliates: AdminAffiliatePayload[] }>(
      "/admin/affiliates",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.affiliates.map(mapAffiliate);
  },
  affiliateAttribution: async (accessToken: string) => {
    const payload = await requestJSON<{
      attribution: AdminAffiliateAttributionPayload[];
    }>("/admin/affiliate-attribution", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.attribution.map(mapAffiliateAttribution);
  },
  updateAffiliateConversionStatus: (
    accessToken: string,
    conversionId: string,
    input: {
      status: Exclude<AdminAffiliateConversion["status"], "pending">;
      reason: string;
    },
  ) =>
    requestJSON<AdminAffiliateConversionPayload>(
      `/admin/affiliate-conversions/${encodeURIComponent(conversionId)}/status`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          reason: input.reason,
        }),
      },
    ).then(mapAffiliateConversion),
  createAffiliatePayout: (
    accessToken: string,
    affiliateId: string,
    input: {
      payoutReference: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayoutPayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}/payouts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          payout_reference: input.payoutReference,
          notes: input.notes,
        }),
      },
    ).then(mapAffiliatePayout),
  createAffiliate: (
    accessToken: string,
    input: {
      entityType: AdminAffiliateEntityType;
      code: string;
      displayName: string;
      contactName: string;
      email: string;
      phone: string;
      websiteUrl: string;
      commissionModel: AdminAffiliateCommissionModel;
      commissionRate: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
      payoutReference: string;
      status: Exclude<AdminAffiliateStatus, "archived">;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayload>("/admin/affiliates", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        entity_type: input.entityType,
        code: input.code,
        display_name: input.displayName,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        website_url: input.websiteUrl,
        commission_model: input.commissionModel,
        commission_rate: input.commissionRate,
        cookie_window_days: input.cookieWindowDays,
        payout_mode: input.payoutMode,
        payout_reference: input.payoutReference,
        status: input.status,
        notes: input.notes,
      }),
    }).then(mapAffiliate),
  updateAffiliate: (
    accessToken: string,
    affiliateId: string,
    input: {
      entityType: AdminAffiliateEntityType;
      code: string;
      displayName: string;
      contactName: string;
      email: string;
      phone: string;
      websiteUrl: string;
      commissionModel: AdminAffiliateCommissionModel;
      commissionRate: number;
      cookieWindowDays: number;
      payoutMode: AdminAffiliatePayoutMode;
      payoutReference: string;
      status: Exclude<AdminAffiliateStatus, "archived">;
      notes: string;
    },
  ) =>
    requestJSON<AdminAffiliatePayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          entity_type: input.entityType,
          code: input.code,
          display_name: input.displayName,
          contact_name: input.contactName,
          email: input.email,
          phone: input.phone,
          website_url: input.websiteUrl,
          commission_model: input.commissionModel,
          commission_rate: input.commissionRate,
          cookie_window_days: input.cookieWindowDays,
          payout_mode: input.payoutMode,
          payout_reference: input.payoutReference,
          status: input.status,
          notes: input.notes,
        }),
      },
    ).then(mapAffiliate),
  archiveAffiliate: (
    accessToken: string,
    affiliateId: string,
    reason: string,
  ) =>
    requestJSON<AdminAffiliatePayload>(
      `/admin/affiliates/${encodeURIComponent(affiliateId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapAffiliate),
  referralProgrammes: async (accessToken: string) => {
    const payload = await requestJSON<{
      programmes: AdminReferralProgrammePayload[];
    }>("/admin/referral-programmes", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.programmes.map(mapReferralProgramme);
  },
  createReferralProgramme: (
    accessToken: string,
    input: {
      title: string;
      codePrefix: string;
      audience: AdminReferralAudience;
      referrerRewardKind: AdminReferralRewardKind;
      refereeRewardKind: AdminReferralRefereeRewardKind;
      rewardType: AdminReferralRewardType;
      rewardValue: number;
      maxRewardMinor?: number;
      qualifyingOrderMinMinor: number;
      rewardHoldDays: number;
      status: Exclude<AdminReferralProgrammeStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminReferralProgrammePayload>("/admin/referral-programmes", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        title: input.title,
        code_prefix: input.codePrefix,
        audience: input.audience,
        referrer_reward_kind: input.referrerRewardKind,
        referee_reward_kind: input.refereeRewardKind,
        reward_type: input.rewardType,
        reward_value: input.rewardValue,
        max_reward_minor: input.maxRewardMinor,
        qualifying_order_min_minor: input.qualifyingOrderMinMinor,
        reward_hold_days: input.rewardHoldDays,
        status: input.status,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        notes: input.notes,
      }),
    }).then(mapReferralProgramme),
  updateReferralProgramme: (
    accessToken: string,
    programmeId: string,
    input: {
      title: string;
      codePrefix: string;
      audience: AdminReferralAudience;
      referrerRewardKind: AdminReferralRewardKind;
      refereeRewardKind: AdminReferralRefereeRewardKind;
      rewardType: AdminReferralRewardType;
      rewardValue: number;
      maxRewardMinor?: number;
      qualifyingOrderMinMinor: number;
      rewardHoldDays: number;
      status: Exclude<AdminReferralProgrammeStatus, "archived">;
      startsAt?: string;
      endsAt?: string;
      notes: string;
    },
  ) =>
    requestJSON<AdminReferralProgrammePayload>(
      `/admin/referral-programmes/${encodeURIComponent(programmeId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          title: input.title,
          code_prefix: input.codePrefix,
          audience: input.audience,
          referrer_reward_kind: input.referrerRewardKind,
          referee_reward_kind: input.refereeRewardKind,
          reward_type: input.rewardType,
          reward_value: input.rewardValue,
          max_reward_minor: input.maxRewardMinor,
          qualifying_order_min_minor: input.qualifyingOrderMinMinor,
          reward_hold_days: input.rewardHoldDays,
          status: input.status,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          notes: input.notes,
        }),
      },
    ).then(mapReferralProgramme),
  archiveReferralProgramme: (
    accessToken: string,
    programmeId: string,
    reason: string,
  ) =>
    requestJSON<AdminReferralProgrammePayload>(
      `/admin/referral-programmes/${encodeURIComponent(programmeId)}/archive`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ reason }),
      },
    ).then(mapReferralProgramme),
  createReferralCode: (
    accessToken: string,
    programmeId: string,
    input: {
      businessId?: string;
      ownerType: Exclude<AdminReferralCodeOwnerType, "customer">;
      code: string;
      status: Exclude<AdminReferralCodeStatus, "archived">;
    },
  ) =>
    requestJSON<AdminReferralCodePayload>(
      `/admin/referral-programmes/${encodeURIComponent(programmeId)}/codes`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          business_id: input.businessId,
          owner_type: input.ownerType,
          code: input.code,
          status: input.status,
        }),
      },
    ).then(mapReferralCode),
  issueReferralRewards: (accessToken: string, limit: number) =>
    requestJSON<AdminReferralRewardIssuePayload>(
      "/admin/referral-rewards/issue",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ limit }),
      },
    ).then(mapReferralRewardIssue),
  queueMoneyReplay: (
    accessToken: string,
    input: { providerReference: string; reason: string },
  ) =>
    requestJSON<AdminMoneyReplayRequestPayload>(
      "/admin/money-rails/replay-requests",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider_reference: input.providerReference,
          reason: input.reason,
        }),
      },
    ),
  reverseMoneyPayment: (
    accessToken: string,
    input: { providerReference: string; reason: string },
  ) =>
    requestJSON<AdminMoneyReversalPayload>(
      "/admin/money-rails/payment-reversals",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          provider_reference: input.providerReference,
          reason: input.reason,
        }),
      },
    ),
  setSettlementReviewHold: (
    accessToken: string,
    businessId: string,
    input: { hold: boolean; reason: string },
  ) =>
    requestJSON<AdminMoneyPayoutReviewPayload>(
      `/admin/money-rails/businesses/${encodeURIComponent(businessId)}/settlement-hold`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          hold: input.hold,
          reason: input.reason,
        }),
      },
    ),
  riskReviews: async (accessToken: string) => {
    const payload = await requestJSON<{ reviews: AdminRiskReviewPayload[] }>(
      "/admin/risk-reviews",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.reviews.map(mapRiskReview);
  },
  updateRiskReviewStatus: (
    accessToken: string,
    reviewKey: string,
    input: { status: AdminRiskReviewStatus; reason: string },
  ) =>
    requestJSON<AdminRiskReviewPayload>(
      `/admin/risk-reviews/${encodeURIComponent(reviewKey)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          reason: input.reason,
        }),
      },
    ).then(mapRiskReview),
  supportTickets: async (accessToken: string) => {
    const payload = await requestJSON<{ tickets: AdminSupportTicketPayload[] }>(
      "/admin/support-tickets",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.tickets.map(mapSupportTicket);
  },
  updateSupportTicket: (
    accessToken: string,
    ticketKey: string,
    input: {
      status: AdminSupportTicketStatus;
      assignment: AdminSupportAssignment;
      note: string;
    },
  ) =>
    requestJSON<AdminSupportTicketPayload>(
      `/admin/support-tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          status: input.status,
          assignment: input.assignment,
          note: input.note,
        }),
      },
    ).then(mapSupportTicket),
  auditEvents: async (accessToken: string, severity?: AdminAuditSeverity) => {
    const query = severity ? `?severity=${encodeURIComponent(severity)}` : "";
    const payload = await requestJSON<{ events: AdminAuditEventPayload[] }>(
      `/admin/audit-events${query}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.events.map(mapAuditEvent);
  },
  exportDataset: (accessToken: string, dataset: string) =>
    requestText(`/admin/exports/${encodeURIComponent(dataset)}.csv`, {
      method: "GET",
      headers: {
        Accept: "text/csv",
        Authorization: `Bearer ${accessToken}`,
      },
    }),
  verificationCases: async (accessToken: string) => {
    const payload = await requestJSON<{
      cases: AdminVerificationCasePayload[];
    }>("/admin/business-verifications", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return payload.cases.map(mapVerificationCase);
  },
  decideVerification: (
    accessToken: string,
    businessId: string,
    input: { decision: AdminVerificationDecision; note: string },
  ) =>
    requestJSON<AdminVerificationCasePayload>(
      `/admin/business-verifications/${encodeURIComponent(businessId)}/decision`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ decision: input.decision, note: input.note }),
      },
    ).then(mapVerificationCase),
  businesses: async (accessToken: string) => {
    const payload = await requestJSON<{ businesses: AdminBusinessPayload[] }>(
      "/admin/businesses",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.businesses.map(mapBusiness);
  },
  customers: async (accessToken: string) => {
    const payload = await requestJSON<{ customers: AdminCustomerPayload[] }>(
      "/admin/customers",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.customers.map(mapCustomer);
  },
  updateBusinessStatus: (
    accessToken: string,
    businessId: string,
    input: {
      operationalStatus: AdminBusinessOperationalStatus;
      reason: string;
    },
  ) =>
    requestJSON<AdminBusinessPayload>(
      `/admin/businesses/${encodeURIComponent(businessId)}/status`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          operational_status: input.operationalStatus,
          reason: input.reason,
        }),
      },
    ).then(mapBusiness),
  roles: async (accessToken: string) => {
    const payload = await requestJSON<{
      roles: AdminRolePayload[];
      permissions: AdminPermissionPayload[];
    }>("/admin/roles", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      roles: payload.roles.map(mapRole),
      permissions: payload.permissions.map(mapPermission),
    };
  },
  updateRolePermissions: (
    accessToken: string,
    role: AdminRole,
    permissions: string[],
  ) =>
    requestJSON<AdminRolePayload>(`/admin/roles/${encodeURIComponent(role)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ permissions }),
    }).then(mapRole),
  listUsers: async (accessToken: string) => {
    const payload = await requestJSON<{ users: AdminUserPayload[] }>(
      "/admin/users",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return payload.users.map(mapUser);
  },
  createUser: (
    accessToken: string,
    input: {
      displayName: string;
      email: string;
      password: string;
      role: AdminRole;
    },
  ) =>
    requestJSON<AdminUserPayload>("/admin/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        display_name: input.displayName,
        email: input.email,
        password: input.password,
        role: input.role,
      }),
    }).then(mapUser),
  updateUser: (
    accessToken: string,
    userId: string,
    input: { displayName: string; role: AdminRole; isActive: boolean },
  ) =>
    requestJSON<AdminUserPayload>(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          display_name: input.displayName,
          role: input.role,
          is_active: input.isActive,
        }),
      },
    ).then(mapUser),
};
