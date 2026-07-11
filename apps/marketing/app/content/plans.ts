export type Plan = {
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
export const plans: Plan[] = [
  {
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
      "Walk-in & manual order logging",
      "Order tracking with the customer progress link",
    ],
  },
  {
    name: "Starter — Start Selling",
    monthlyPrice: "GHS 49",
    quarterlyPrice: "GHS 119 / quarter",
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
      "Your storefront accent colour",
      "Full project tracking with the customer view",
      "The money tracker",
      "Delivery zones & fees",
      "Two-step sign-in security",
    ],
  },
  {
    name: "Growth — Run the Business",
    badge: "Most popular",
    monthlyPrice: "GHS 99",
    quarterlyPrice: "GHS 239 / quarter",
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
      "Discount codes & promotions",
      "Deeper analytics & insights",
      "Up to 2 staff logins with roles",
      "Priority support",
    ],
  },
  {
    name: "Studio — Scale Up",
    badge: "Best for scale",
    monthlyPrice: "GHS 199",
    quarterlyPrice: "GHS 479 / quarter",
    yearlyPrice: "GHS 1,791",
    yearlySaving: "3 months free",
    available: true,
    highlight: false,
    summary:
      "For established studios and growing teams. Deeper team controls, priority everything, and room to run at scale.",
    includes: [
      "Your own store link — business-name.xtiitch.com",
      "Everything in Growth",
      "Up to 10 staff logins with roles & permissions",
      "Multiple store locations",
      "Advanced analytics & reports",
      "Priority placement & early access to new features",
      "Dedicated onboarding",
    ],
  },
];

export const pricingNotes: string[] = [
  "Our share is taken automatically as each online payment passes through Xtiitch — there’s never anything to chase or invoice.",
  "It sits on top of Paystack’s transaction fee of 1.95%. That 1.95% goes to the payment processor, not to us.",
  "The share gets smaller with every step up — from Free to Starter, Growth and Studio — so the more your shop grows, the less you pay on each sale.",
  "Money taken outside Xtiitch — cash, or mobile money sent to you directly — carries no fee at all. It never passed through the platform, so it’s always 100% yours.",
  "Once you’re selling steadily online, a paid plan usually works out cheaper overall than Free: the lower sales fee more than covers the small monthly cost.",
];
