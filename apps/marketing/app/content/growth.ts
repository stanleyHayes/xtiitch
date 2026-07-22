export type GrowthProgramme = {
  title: string;
  label: string;
  body: string;
  status: string;
  proof: string[];
};

export const growthProgrammes: GrowthProgramme[] = [
  {
    title: "Promotion codes",
    label: "Discounts",
    body: "The promotion-code infrastructure supports store, collection and design offers, but customer-facing promotions are currently parked while the commercial rules are finalised.",
    status: "Parked — not currently included in any plan",
    proof: [
      "Store, collection, and design targeting",
      "Usage caps, date windows, and minimum spend",
      "Redemptions finalize only after successful payment",
    ],
  },
  {
    title: "Referral rewards",
    label: "Referrals",
    body: "Issue referral codes for customer or business programmes. Rewards become capped vouchers or commission rebates after a qualifying paid order and hold window.",
    status: "Built for admin issuance, public resolution, checkout attribution",
    proof: [
      "Self-referral and duplicate-referee protection",
      "Voucher rewards reuse the promotion ledger",
      "Refund and reversal paths can void rewards",
    ],
  },
  {
    title: "Affiliate links",
    label: "Affiliates",
    body: "Register partner codes, capture clicks, attribute conversions, and let operators approve, settle, reverse, or reconcile partner commissions from Xtiitch's own commission rails.",
    status: "Built for admin registry, public click capture, checkout attribution",
    proof: [
      "Last-click attribution with cookie windows",
      "Click, conversion, and payout batch ledgers",
      "No customer money is held for affiliate payout",
    ],
  },
  {
    title: "Sponsored placements",
    label: "Sponsored",
    body: "Verified businesses can appear in labelled sponsored slots on the marketing home page, linking visitors straight to a storefront or promoted design.",
    status: "Built for admin campaigns, marketing render, event tracking",
    proof: [
      "Clearly labelled Sponsored cards",
      "Only active, verified businesses are eligible",
      "Impressions and clicks are deduped server-side",
    ],
  },
];

export const growthGuardrails: string[] = [
  "Customer payments still settle through Paystack to the business; Xtiitch does not run a wallet or escrow.",
  "Promotion, referral, and affiliate value is recorded in ledgers and applied only around real paid orders.",
  "Sponsored placements are labelled, time-boxed, and limited to verified active businesses.",
  "Affiliate cash payout policy stays operator-controlled and KYC-gated; voucher rewards stay capped and expiring.",
];
