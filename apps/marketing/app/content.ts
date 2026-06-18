// Single source of marketing copy for the site. Every claim here is grounded in
// Xtiitch-Product-Definition.pdf / Xtiitch-Technical-Specification.pdf and the
// compliance rules in docs/marketing/marketing-site-plan.md. Do not add claims
// the product does not yet make.

export const site = {
  name: "Xtiitch",
  company: "XCreativs Technologies",
  tagline: "The operating system for fashion.",
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
  | "notifications";

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
    body: "Through-Xtiitch sales record themselves; log offline takings by hand. See an honest picture of money in, in one place.",
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
  price: string;
  priceNote: string;
  feeLabel: string;
  feeValue: string;
  available: boolean;
  highlight: boolean;
  summary: string;
  includes: string[];
};

export const plans: Plan[] = [
  {
    name: "Free — Get Online",
    price: "GHS 0",
    priceNote: "per month",
    feeLabel: "Fee on Xtiitch sales",
    feeValue: "3%",
    available: true,
    highlight: false,
    summary:
      "Remove the wall. Get a real store at no monthly cost; pay a small share only when you actually sell.",
    includes: [
      "A real, branded storefront",
      "Up to about 10 designs",
      "Walk-in order logging",
      "Basic order tracking with the customer progress link",
    ],
  },
  {
    name: "Standard",
    badge: "Most popular",
    price: "GHS 50",
    priceNote: "per month",
    feeLabel: "Fee on Xtiitch sales",
    feeValue: "1%",
    available: true,
    highlight: true,
    summary:
      "For a shop selling steadily. A lower share on sales, plus the full toolkit to run the business.",
    includes: [
      "Unlimited designs and collections",
      "Full project tracking with the customer view",
      "The money tracker",
      "Delivery zones and fees",
      "Basic analytics",
    ],
  },
  {
    name: "Growth",
    badge: "Later",
    price: "~ GHS 120",
    priceNote: "per month",
    feeLabel: "Fee on Xtiitch sales",
    feeValue: "0.5% or none",
    available: false,
    highlight: false,
    summary:
      "Planned for the future, not in version one. Noted here so you can see where pricing is heading.",
    includes: [
      "Staff logins",
      "Deeper analytics",
      "The lowest or no per-sale fee",
    ],
  },
];

export const pricingNotes: string[] = [
  "Our share is taken automatically as each payment passes through Xtiitch — there is never anything to chase.",
  "It sits on top of Paystack’s own transaction fee of 1.95%.",
  "Money taken outside Xtiitch — cash, or mobile money sent directly to you — carries no fee, because it never passed through the platform.",
  "A shop selling steadily online usually pays less overall on Standard than on Free.",
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
      "Free costs nothing per month with a 3% share on sales through Xtiitch. Standard is GHS 50 a month with a 1% share. Our share sits on top of Paystack’s 1.95% transaction fee, and only applies to money that passes through Xtiitch.",
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
    question: "Is my information safe?",
    answer:
      "Each business’s data is sealed off from every other business. Card details are handled by Paystack and never touch Xtiitch. Personal and settlement details are protected in transit and at rest.",
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
