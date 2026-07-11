import {
  AdminExportDataset,
  AdminPlan,
  AdminSubscription,
  AdminPromotion,
  AdminAdCampaign,
  AdminAffiliate,
  AdminReferralProgramme,
} from "../../shared/types";
import { formatGHS, formatPercentBps } from "../../shared/formatting";
import { shortTime } from "../../shared/dates";
import {
  billingModeLabel,
  subscriptionStatusLabel,
} from "../../subscriptions/utils";
import {
  adCampaignStatusLabel,
  adPlacementLabel,
  affiliateCommissionLabel,
  affiliateEntityLabel,
  affiliatePayoutLabel,
  affiliateStatusLabel,
  referralAudienceLabel,
  referralRefereeRewardKindLabel,
  referralRewardKindLabel,
  referralRewardLabel,
  referralStatusLabel,
} from "../../growth/utils";

export function buildRevenueDatasets({ // eslint-disable-line max-lines-per-function -- dataset builder with many conditional branches; refactor in follow-up
  plans,
  subscriptions,
  promotions,
  adCampaigns,
  affiliates,
  referralProgrammes,
}: {
  plans: AdminPlan[];
  subscriptions: AdminSubscription[];
  promotions: AdminPromotion[];
  adCampaigns: AdminAdCampaign[];
  affiliates: AdminAffiliate[];
  referralProgrammes: AdminReferralProgramme[];
}): AdminExportDataset[] {
  const timeOrFallback = (value?: string) => (value ? shortTime(value) : "");
  const promotionRedemptions = promotions.flatMap((promotion) =>
    promotion.recentRedemptions.map((redemption) => ({
      promotion,
      redemption,
    })),
  );
  const pendingAdCampaigns = adCampaigns.filter(
    (campaign) => campaign.status === "pending_review",
  );
  const pendingAffiliates = affiliates.filter(
    (affiliate) => affiliate.status === "pending_review",
  );
  const draftReferralProgrammes = referralProgrammes.filter(
    (programme) => programme.status === "draft",
  );

  return [
    {
      id: "plans",
      title: "Plan packages",
      helper: "Package pricing, commission, tenant count, and MRR snapshot.",
      source: "subscriptions",
      sourceLabel: "Open plans",
      tone: plans.some((plan) => !plan.isActive) ? "watch" : "ready",
      rows: [
        [
          "Name",
          "Code",
          "Active",
          "Monthly fee",
          "Yearly fee",
          "Commission",
          "Design limit",
          "Businesses",
          "Active subscriptions",
          "Estimated MRR",
          "Created",
          "Updated",
        ],
        ...plans.map((plan) => [
          plan.name,
          plan.code,
          plan.isActive ? "Active" : "Archived",
          formatGHS(plan.monthlyFeeMinor),
          formatGHS(plan.yearlyFeeMinor),
          `${(plan.commissionBps / 100).toFixed(2)}%`,
          typeof plan.designLimit === "number" ? plan.designLimit : "Unlimited",
          plan.businessCount,
          plan.activeSubscriptionCount,
          formatGHS(plan.estimatedMrrMinor),
          shortTime(plan.createdAt),
          shortTime(plan.updatedAt),
        ]),
      ],
    },
    {
      id: "subscriptions",
      title: "Subscriptions",
      helper: "Plan, billing state, invoices, usage, and renewal timing.",
      source: "subscriptions",
      sourceLabel: "Open subscriptions",
      tone: subscriptions.some(
        (subscription) =>
          subscription.status === "past_due" ||
          subscription.status === "grace_period",
      )
        ? "blocked"
        : subscriptions.some(
              (subscription) =>
                subscription.status === "cancel_at_period_end" ||
                subscription.status === "canceled",
            )
          ? "watch"
          : "ready",
      rows: [
        [
          "Business",
          "Handle",
          "Plan",
          "Status",
          "Billing mode",
          "Monthly fee",
          "Design usage",
          "Last invoice",
          "Last payment",
          "Next billing",
        ],
        ...subscriptions.map((subscription) => [
          subscription.businessName,
          subscription.handle,
          subscription.planName,
          subscriptionStatusLabel(subscription.status),
          billingModeLabel(subscription.billingMode),
          formatGHS(subscription.monthlyFeeMinor),
          typeof subscription.designLimit === "number"
            ? `${subscription.designCount}/${subscription.designLimit}`
            : `${subscription.designCount}/unlimited`,
          subscription.lastInvoiceRef,
          timeOrFallback(subscription.lastPaymentAt),
          timeOrFallback(subscription.nextBillingAt),
        ]),
      ],
    },
    {
      id: "promotions",
      title: "Promotions",
      helper: "Voucher rules, targeting, funding, usage, and redeemed value.",
      source: "promotions",
      sourceLabel: "Open promotions",
      tone: promotions.some((promotion) => promotion.status === "paused")
        ? "watch"
        : "ready",
      rows: [
        [
          "Title",
          "Code",
          "Business",
          "Status",
          "Type",
          "Value",
          "Funding",
          "Scope",
          "Redemptions",
          "Discount redeemed",
        ],
        ...promotions.map((promotion) => [
          promotion.title,
          promotion.code,
          promotion.businessName || "Platform-wide",
          promotion.status,
          promotion.discountType,
          promotion.discountType === "percentage"
            ? `${(promotion.discountValue / 100).toFixed(1)}%`
            : formatGHS(promotion.discountValue),
          promotion.fundingSource,
          promotion.scope,
          promotion.redemptionCount,
          formatGHS(promotion.discountRedeemedMinor),
        ]),
      ],
    },
    {
      id: "ad-campaigns",
      title: "Sponsored placements",
      helper:
        "Campaign status, advertiser, placement, budget, spend, and engagement.",
      source: "ads",
      sourceLabel: "Open ads",
      tone: pendingAdCampaigns.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Campaign",
          "Business",
          "Handle",
          "Placement",
          "Target",
          "Status",
          "Pricing",
          "Budget",
          "Spend",
          "Daily cap",
          "Starts",
          "Ends",
          "Impressions",
          "Clicks",
          "CTR",
          "Review note",
          "Updated",
        ],
        ...adCampaigns.map((campaign) => [
          campaign.headline,
          campaign.businessName,
          campaign.businessHandle,
          adPlacementLabel(campaign.placementType),
          campaign.targetLabel || campaign.targetRefId || "Business storefront",
          adCampaignStatusLabel(campaign.status),
          campaign.pricingModel,
          formatGHS(campaign.budgetMinor),
          formatGHS(campaign.spendMinor),
          typeof campaign.dailyCapMinor === "number"
            ? formatGHS(campaign.dailyCapMinor)
            : "",
          shortTime(campaign.startsAt),
          shortTime(campaign.endsAt),
          campaign.impressionCount,
          campaign.clickCount,
          formatPercentBps(campaign.clickRateBps),
          campaign.reviewNote,
          shortTime(campaign.updatedAt),
        ]),
      ],
    },
    {
      id: "affiliates",
      title: "Affiliate programmes",
      helper:
        "Partner codes, contact details, commission terms, payout rails, cookie windows, and status.",
      source: "affiliates",
      sourceLabel: "Open affiliates",
      tone: pendingAffiliates.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Affiliate",
          "Code",
          "Entity",
          "Contact",
          "Email",
          "Phone",
          "Website",
          "Commission",
          "Cookie window",
          "Payout mode",
          "Payout reference",
          "Status",
          "Notes",
          "Updated",
        ],
        ...affiliates.map((affiliate) => [
          affiliate.displayName,
          affiliate.code,
          affiliateEntityLabel(affiliate.entityType),
          affiliate.contactName,
          affiliate.email,
          affiliate.phone,
          affiliate.websiteUrl,
          affiliateCommissionLabel(affiliate),
          `${affiliate.cookieWindowDays} days`,
          affiliatePayoutLabel(affiliate.payoutMode),
          affiliate.payoutReference,
          affiliateStatusLabel(affiliate.status),
          affiliate.notes,
          shortTime(affiliate.updatedAt),
        ]),
      ],
    },
    {
      id: "referral-programmes",
      title: "Referral programmes",
      helper:
        "Code prefixes, audiences, reward economics, qualifying order minimums, hold windows, schedules, and status.",
      source: "referrals",
      sourceLabel: "Open referrals",
      tone: draftReferralProgrammes.length > 0 ? "watch" : "ready",
      rows: [
        [
          "Programme",
          "Code prefix",
          "Audience",
          "Referrer reward",
          "New customer reward",
          "Reward",
          "Minimum order",
          "Hold days",
          "Status",
          "Starts",
          "Ends",
          "Notes",
          "Updated",
        ],
        ...referralProgrammes.map((programme) => [
          programme.title,
          programme.codePrefix,
          referralAudienceLabel(programme.audience),
          referralRewardKindLabel(programme.referrerRewardKind),
          referralRefereeRewardKindLabel(programme.refereeRewardKind),
          referralRewardLabel(programme),
          formatGHS(programme.qualifyingOrderMinMinor),
          programme.rewardHoldDays,
          referralStatusLabel(programme.status),
          programme.startsAt ? shortTime(programme.startsAt) : "",
          programme.endsAt ? shortTime(programme.endsAt) : "",
          programme.notes,
          shortTime(programme.updatedAt),
        ]),
      ],
    },
    {
      id: "promotion-redemptions",
      title: "Recent promotion redemptions",
      helper:
        "Latest redemption rows per voucher with customer and order evidence.",
      source: "promotions",
      sourceLabel: "Open promotions",
      tone: promotionRedemptions.some(
        ({ redemption }) => redemption.status === "pending",
      )
        ? "watch"
        : "ready",
      rows: [
        [
          "Promotion",
          "Code",
          "Business",
          "Business ID",
          "Customer",
          "Customer ID",
          "Order ID",
          "Status",
          "Discount",
          "Redeemed at",
          "Created at",
          "Updated at",
        ],
        ...promotionRedemptions.map(({ promotion, redemption }) => [
          promotion.title,
          promotion.code,
          promotion.businessName || "Platform-wide",
          redemption.businessId,
          redemption.customerName || "Unknown customer",
          redemption.customerId ?? "",
          redemption.orderId ?? "",
          redemption.status,
          formatGHS(redemption.discountMinor),
          timeOrFallback(redemption.redeemedAt),
          shortTime(redemption.createdAt),
          shortTime(redemption.updatedAt),
        ]),
      ],
    },
  ];
}
