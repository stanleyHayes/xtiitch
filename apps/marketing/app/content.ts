// Single source of marketing copy for the site. Every claim here is grounded in
// Xtiitch-Product-Definition.pdf / Xtiitch-Technical-Specification.pdf and the
// compliance rules in docs/marketing/marketing-site-plan.md. Do not add claims
// the product does not yet make.

export const site = {
  name: "Xtiitch",
  company: "XCreativs Technologies",
  tagline: "The operating system for fashion.",
  motto: "Fashion, in good order.",
  promise:
    "Give your fashion business a real online store, one place to run orders and customers, and a clean way to take payment — and finally let your customers see where their garment has reached.",
  oneLiner:
    "A real shop, a simple way to run it, and an answer to “where is my cloth?”",
  primaryCta: { label: "Join the waitlist", href: "/contact" },
  secondaryCta: { label: "See how it works", href: "/how-it-works" },
  whatsappNote:
    "Custom orders settle the final price with a quick WhatsApp chat, started straight from the dashboard.",
} as const;

export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Features", href: "/features" },
  { label: "Growth", href: "/growth" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "For customers", href: "/for-customers" },
  { label: "Security", href: "/security" },
  { label: "FAQ", href: "/faq" },
];

export type Feature = {
  title: string;
  body: string;
  icon: FeatureIcon;
};

export type FeatureIcon =
  | "store"
  | "catalogue"
  | "orders"
  | "tracking"
  | "payments"
  | "bookings"
  | "money"
  | "notifications"
  | "branding"
  | "waitlist"
  | "security";

export const features: Feature[] = [
  {
    icon: "store",
    title: "Your own branded store",
    body: "A professional storefront with your name, logo and colours that you can send customers to directly. No developer needed. Turn bespoke, measurements, customisation, collections and delivery on or off with simple switches.",
  },
  {
    icon: "catalogue",
    title: "Designs, collections and shareable links",
    body: "Every design gets its own page and its own link for Instagram, Facebook and WhatsApp. Group work into collections with a theme, or post a single design. Retire items to hide them and bring them back any time.",
  },
  {
    icon: "orders",
    title: "Clean order records, not scattered chats",
    body: "Standard bookings, custom requests and visit bookings arrive sorted, each with the customer’s measurements and choices attached — one complete record instead of a long WhatsApp thread.",
  },
  {
    icon: "tracking",
    title: "“Where is my cloth?” tracking",
    body: "Customers follow their order in plain red, yellow and green — received, being made, ready — with a rough timeframe. Built to be understood at a glance, even by someone who reads very little.",
  },
  {
    icon: "payments",
    title: "Payments straight to you",
    body: "Take mobile money and cards, including international cards, in Ghana Cedis through Paystack. Money settles directly to your own settlement account. Xtiitch never holds your funds.",
  },
  {
    icon: "bookings",
    title: "Home-visit bookings",
    body: "Set your weekly availability and let customers book a measuring visit against it. A small deposit confirms the slot, and only you can reschedule or cancel — which frees the time for someone else.",
  },
  {
    icon: "money",
    title: "An honest money tracker",
    body: "Sales through Xtiitch record themselves. Log cash and direct mobile-money takings in a few taps. See running totals by day, week and month, split between money through Xtiitch and money taken outside it.",
  },
  {
    icon: "notifications",
    title: "Notifications on both sides",
    body: "App and email updates for a new order, a stage change, a booking or a payment — so a customer feels their garment move forward and a business never misses an order.",
  },
  {
    icon: "branding",
    title: "A store that grows with your plan",
    body: "Start free and online. As you move up a plan, unlock your own accent colour, then a custom logo and hero banner, and store layouts — so your storefront looks more like you the more you grow.",
  },
  {
    icon: "waitlist",
    title: "Design waiting lists",
    body: "When a piece is sold out or not yet released, customers can join its waiting list from your store. You see who is waiting and let them know when it is back — demand captured instead of lost.",
  },
  {
    icon: "security",
    title: "Two-step sign-in security",
    body: "Protect the account that runs your money with optional two-step verification using an authenticator app, plus team roles for owners, admins and staff so everyone has the right level of access.",
  },
];

export type Step = { number: string; title: string; body: string };

export const steps: Step[] = [
  {
    number: "1",
    title: "Set up your store",
    body: "Add your name, logo and colours, then switch on only what fits how you work — bespoke, measurements, customisation, collections, delivery.",
  },
  {
    number: "2",
    title: "Add designs and sizes",
    body: "Upload designs with photos and prices, set up your own size bands and charts, and group designs into collections if you use them.",
  },
  {
    number: "3",
    title: "Share your links",
    body: "Post a single design or a whole collection to Instagram, Facebook or WhatsApp. Customers can browse with no account needed.",
  },
  {
    number: "4",
    title: "Receive orders and take payment",
    body: "Standard orders are paid in full at checkout. Custom orders are confirmed with a deposit, and the balance is settled your way.",
  },
  {
    number: "5",
    title: "Move work through the stages",
    body: "Advance each order through your production stages. The customer’s red/yellow/green view updates automatically.",
  },
  {
    number: "6",
    title: "Watch your takings",
    body: "Sales through Xtiitch record themselves; log offline takings by hand. See an honest picture of money coming in, all in one place.",
  },
];

export type TrackStage = {
  label: string;
  customerText: string;
  colour: "red" | "yellow" | "green";
};

// The default bespoke journey from the product definition.
export const bespokeStages: TrackStage[] = [
  { label: "Order received", customerText: "Order received", colour: "red" },
  {
    label: "Being made",
    customerText: "Your outfit is being made",
    colour: "yellow",
  },
  {
    label: "Ready for fitting",
    customerText: "Ready for your fitting",
    colour: "yellow",
  },
  {
    label: "Ready / delivered",
    customerText: "Ready — come for your outfit",
    colour: "green",
  },
];

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

export type TrustPoint = { title: string; body: string };

export const trustPoints: TrustPoint[] = [
  {
    title: "We never hold your money",
    body: "Customer payments settle directly to your own settlement account through Paystack. Our small commission is split off automatically as the money flows. Xtiitch runs no wallet and no escrow.",
  },
  {
    title: "Card details never touch Xtiitch",
    body: "Paystack handles card collection on its own secure surfaces. Xtiitch never receives or stores raw card data.",
  },
  {
    title: "Each business is sealed off",
    body: "One business can never see another business’s designs, orders, customers or money. Tenant isolation is the system’s most important rule.",
  },
  {
    title: "Verified businesses only",
    body: "To receive customer payments a business is verified with settlement details in its own name. We make that smooth, but the information must be real.",
  },
  {
    title: "Your personal data is protected",
    body: "Measurements, contact and identity details are kept within your business’s own scope and protected in transit and at rest.",
  },
  {
    title: "An honest record of every payment",
    body: "Money movements and order-stage changes are recorded so a question about an order or a payment can be answered with certainty.",
  },
];

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
    body: "Run business-funded codes for a whole store, a collection, or one design. Platform operators can also approve wider offers when the commercial rules are clear.",
    status: "Built for admin, business dashboard, storefront checkout",
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

export type CustomerPoint = { title: string; body: string };

export const customerPoints: CustomerPoint[] = [
  {
    title: "See where your cloth is",
    body: "After you order, you get a simple view of where your garment has reached — red for received, yellow for being made, green for ready — with a rough timeframe. No more chasing by phone.",
  },
  {
    title: "Browse with no account",
    body: "Open a shop’s store or a shared design link and look around freely. A light account is only created at the last step, when you place an order.",
  },
  {
    title: "Pay the way you already do",
    body: "Pay by mobile money or card, including international cards, with prices shown in Ghana Cedis. Payment goes straight to the business.",
  },
  {
    title: "Standard or custom",
    body: "If you fit one of a shop’s sizes, pick it and pay — done. If you need measuring or changes, a small deposit confirms the order and the rest is agreed with the business.",
  },
  {
    title: "Pickup or delivery",
    body: "Collect in person at no charge, or have it dispatched where the business delivers. You always see what is due before you confirm.",
  },
  {
    title: "Booked a home visit?",
    body: "A measuring visit is confirmed with a deposit, so it can’t be changed by tapping a button. Instead you get a clear “call the business” action to move or cancel it.",
  },
];

export type Faq = { question: string; answer: string };

export const faqs: Faq[] = [
  {
    question: "Do I need to be a developer or pay for a custom site?",
    answer:
      "No. You set up your store, add designs and prices, and share your links. Xtiitch gives small businesses the same quality of tools the big names buy, in a form you can actually afford and use.",
  },
  {
    question: "How do I get paid?",
    answer:
      "When you join, Xtiitch sets up a payment account for you behind the scenes through Paystack. From then on, customer payments settle directly to your own settlement account. Our small commission is split off automatically as the money flows — we never hold your funds.",
  },
  {
    question: "What does it cost?",
    answer:
      "Free costs nothing per month, with a 3% share on sales made through Xtiitch. The paid plans are Starter at GHS 49 a month, Growth at GHS 99 a month, and Studio at GHS 199 a month — each one taking a smaller share of your sales than the last, so the more you grow, the less you pay per sale. You can pay quarterly and save 20%, or pay yearly and get three months free. Whichever plan you’re on, our share sits on top of Paystack’s 1.95% transaction fee, and only ever applies to money that actually passes through Xtiitch. You can switch your plan or billing cycle yourself from the dashboard anytime.",
  },
  {
    question: "Do customers order and pay online?",
    answer:
      "Yes — on every plan, including Free. Customers browse your designs and place and pay for orders directly from your storefront by mobile money or card. The difference between plans isn’t whether you can sell; it’s how much room you get and how far you can brand your store. Every order — however it comes in — lands in your dashboard, where you track it through to delivery with the customer progress link.",
  },
  {
    question: "How do deposits work on custom orders?",
    answer:
      "A standard order with a known price is paid in full at checkout. A custom order is confirmed with a deposit instead. The deposit defaults to GHS 100, can be set higher by the business, and never goes below GHS 100. It counts towards the final price. The one exception is choosing to come to the shop to be measured — then no deposit is taken and money is arranged directly with the business.",
  },
  {
    question: "Can I take mobile money and cards?",
    answer:
      "Yes. Customers can pay by mobile money or card, including international cards, with prices shown in Ghana Cedis.",
  },
  {
    question: "Can I run ready-made and bespoke from the same store?",
    answer:
      "Yes. The type is set per design and per order, so one store and one dashboard can sell finished pieces off the rack and take bespoke, made-to-measure orders at the same time.",
  },
  {
    question: "What about cash sales in my shop?",
    answer:
      "You can log walk-in and offline orders into the same system, and record cash or direct mobile-money takings by hand. Money taken outside Xtiitch carries no fee.",
  },
  {
    question: "Can my customers track their order?",
    answer:
      "Yes — that is the heart of the product. Whatever stages you use, the customer always sees a simple red, yellow or green status with the stage name beneath it.",
  },
  {
    question: "What about cancellations and refunds?",
    answer:
      "Because payments settle directly to the business and Xtiitch holds no funds, refund and cancellation requests start with the business. Xtiitch records the request, payment status and any provider-confirmed reversal so the customer, business and operator can see the same trail.",
  },
  {
    question: "Can I make my storefront look like my brand?",
    answer:
      "Yes, and how far you can take it depends on your plan. Every store comes with your business name in the link (business-name.xtiitch.com) and your designs front and centre. Starter adds your own storefront accent colour. Growth unlocks full branding — a custom logo, a custom hero banner, and storefront layout variants — plus design waiting lists, so customers can register interest in sold-out or made-to-order pieces. Studio takes it furthest with a fully self-branded store all round.",
  },
  {
    question: "Can I protect my account with two-step verification?",
    answer:
      "Yes. Owners and staff can turn on optional two-step sign-in using an authenticator app such as Google Authenticator or Authy, with one-time backup codes in case you lose your phone. Team members get owner, admin or staff roles so everyone has the right level of access.",
  },
  {
    question: "How do my customers and I get updates?",
    answer:
      "Xtiitch sends automatic updates when an order is placed, moves a stage, is paid, or a visit is booked — by message and email — so customers feel their garment move forward and you never miss an order. WhatsApp is the primary channel for customer updates.",
  },
  {
    question: "Is my information safe?",
    answer:
      "Each business’s data is sealed off from every other business. Card details are handled by Paystack and never touch Xtiitch. Personal and settlement details are protected in transit and at rest. As a customer you can ask a business or Xtiitch to export or erase your personal data under Ghana’s Data Protection Act.",
  },
];

export const measurementRoutes: {
  title: string;
  body: string;
  deposit: string;
}[] = [
  {
    title: "Pick your size",
    body: "Fit one of the shop’s size bands and order in a single step — no measurements needed.",
    deposit: "Paid in full at checkout",
  },
  {
    title: "Measure yourself",
    body: "Enter your own measurements through a simple guided form.",
    deposit: "Deposit confirms the order",
  },
  {
    title: "We come to you",
    body: "Book a slot on the business’s calendar and they measure you at the visit.",
    deposit: "Deposit confirms the booking",
  },
  {
    title: "Come to the shop",
    body: "Visit the business to be measured in person.",
    deposit: "No deposit — arranged directly",
  },
];
