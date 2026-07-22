export type Plan = {
  // Joins this marketing copy to the live plan from GET /v1/plans, so the
  // displayed prices are the ones actually charged.
  code: string;
  name: string;
  badge?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  // Shown beneath the headline price as the alternative billing cycle.
  quarterlyPrice?: string;
  // Shown on the yearly toggle when the annual price beats 12× monthly.
  yearlySaving?: string;
  available: boolean;
  highlight: boolean;
  summary: string;
  includes: string[];
};

// Confirmed four-plan pricing (Xtiitch-Pricing-Section.pdf). Quarterly saves
// ~20%; yearly gives ~3 months free. The Free plan is always GHS 0.
//
// The prices here are only a FALLBACK for when GET /v1/plans is unreachable —
// the pricing route overlays the live figures (see lib/pricing.ts). Keep them in
// step with the plans table: advertising a price the platform does not charge is
// exactly the drift this fallback previously caused (GHS 119 vs 118 charged).
export const plans: Plan[] = [
  {
    code: "free",
    name: "Free — Get Online",
    monthlyPrice: "GHS 0",
    yearlyPrice: "GHS 0",
    available: true,
    highlight: false,
    summary:
      "Open a real, branded storefront and start taking orders online — at no monthly cost. The simplest way to get your designs in front of customers and make your first sales.",
    includes: [
      "Your own store link — business-name.xtiitch.com",
      "A real, branded catalogue storefront",
      "Sell online — card & mobile money checkout",
      "Up to about 10 designs",
      "1 active team account (the owner)",
      "Basic customer records & 30-day analytics",
      "Walk-in & manual order logging",
      "Order tracking with the customer progress link",
    ],
  },
  {
    code: "starter",
    name: "Starter — Start Selling",
    monthlyPrice: "GHS 49",
    quarterlyPrice: "GHS 118 / quarter",
    yearlyPrice: "GHS 441",
    yearlySaving: "3 months free",
    available: true,
    highlight: false,
    summary:
      "For a shop finding its rhythm. More room for your catalogue, your own storefront colour, and the everyday tools to keep orders and money in order.",
    includes: [
      "Your own store link — business-name.xtiitch.com",
      "Everything in Free",
      "Up to about 50 designs",
      "Up to 2 active team accounts, including the owner",
      "Your storefront accent colour & logo",
      "Full project tracking with the customer view",
      "The money tracker",
      "Delivery zones & fees",
      "Standard analytics with 12-month history & CSV export",
      "Two-step sign-in security",
    ],
  },
  {
    code: "growth",
    name: "Growth — Run the Business",
    badge: "Most popular",
    monthlyPrice: "GHS 99",
    quarterlyPrice: "GHS 238 / quarter",
    yearlyPrice: "GHS 891",
    yearlySaving: "3 months free",
    available: true,
    highlight: true,
    summary:
      "For a shop selling steadily. Unlimited designs, full branding, and the complete toolkit to run and grow the business — all in one place.",
    includes: [
      "Your own store link — business-name.xtiitch.com",
      "Everything in Starter",
      "Unlimited designs & collections",
      "Custom logo, hero banner & layout variants",
      "Design waiting lists",
      "Up to 5 active team accounts, including the owner",
      "Full customer management & analytics history",
      "CSV/PDF exports & monthly scheduled reports",
      "Priority support",
    ],
  },
  {
    code: "studio",
    name: "Studio — Scale Up",
    badge: "Best for scale",
    monthlyPrice: "GHS 199",
    quarterlyPrice: "GHS 478 / quarter",
    yearlyPrice: "GHS 1,791",
    yearlySaving: "3 months free",
    available: true,
    highlight: false,
    summary:
      "For established studios and growing teams. Deeper team controls, priority everything, and room to run at scale.",
    includes: [
      "Your own store link — business-name.xtiitch.com",
      "Everything in Growth",
      "Up to 10 active team accounts, including the owner",
      "Advanced team analytics & custom reports",
      "CSV, PDF, DOCX & XLSX exports",
      "Scheduled reports at any supported cadence",
      "Priority placement & early access to new features",
      "Dedicated onboarding",
    ],
  },
];

export const pricingNotes: string[] = [
  "Xtiitch’s sales fee is 3% on Free, 1.5% on Starter, 1% on Growth and 0.5% on Studio, subject to the platform’s per-design fee cap.",
  "Paystack’s current transaction fee is 1.95%. That fee goes to the payment processor, not to Xtiitch, and the rate shown at checkout applies if processor pricing changes.",
  "A Tax fee is calculated at the configured tax rate on the Xtiitch sales fee. Each store chooses whether the customer or the business bears the Xtiitch fee, Tax fee and Paystack transaction fee; checkout shows only charges passed to the customer.",
  "For eligible mobile-money settlements, Paystack may also deduct its approximately GHS 1 payout fee from the business’s settlement; it is a per-settlement provider charge, not a per-order customer fee.",
  "Money taken outside Xtiitch — cash, or mobile money sent to you directly — carries no fee at all. It never passed through the platform, so it’s always 100% yours.",
  "Once you’re selling steadily online, a paid plan usually works out cheaper overall than Free: the lower sales fee more than covers the small monthly cost.",
];
