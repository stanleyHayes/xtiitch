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
