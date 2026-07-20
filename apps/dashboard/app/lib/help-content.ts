// Usage guides for every dashboard page. Rendered in the help drawer (per page)
// and on the full /help guide, and read aloud via text-to-speech. Keep each
// guide plain and spoken-friendly: a short "what it's for" plus numbered steps.

export type HelpGuide = {
  /** Matches the dashboard section key so the per-page drawer can find it. */
  section: string;
  title: string;
  helper: string;
  summary: string;
  steps: string[];
};

export const HELP_INTRO =
  "Welcome to your Xtiitch dashboard. This is your studio's command centre — every order, fitting, payment and storefront update lives here. This guide walks through what each page does and how to use it. You can read it, or press Listen to have it read to you.";

export const HELP_GUIDES: HelpGuide[] = [
  {
    section: "overview",
    title: "Overview",
    helper: "Your studio at a glance",
    summary:
      "The Overview is your studio's pulse. It gathers today's live orders, tracked money, upcoming fittings, pending handovers and unread messages onto one screen so you always know what needs attention.",
    steps: [
      "Start your day here to see what's live across the studio.",
      "Each summary card links to its full page — tap a number to jump straight to that workspace.",
      "Come back after finishing a task to see what's next.",
    ],
  },
  {
    section: "tasks",
    title: "Tasks",
    helper: "Your shift queue",
    summary:
      "Tasks is the staff home screen. It shows the work in front of you this shift — orders to move forward, fittings to prepare and handovers to complete — without the management-only numbers.",
    steps: [
      "Check Tasks at the start of your shift to see what's assigned.",
      "Open an order to move it to its next production stage as you work.",
      "Mark fittings and handovers done so the rest of the team sees progress.",
    ],
  },
  {
    section: "reports",
    title: "Reports",
    helper: "Revenue signals",
    summary:
      "Reports turns your activity into trends — revenue over time, order volume, and the signals that show whether the studio is growing. Use it to spot busy periods and what's selling.",
    steps: [
      "Pick a time range to see revenue and order counts for that window.",
      "Compare periods to see whether things are speeding up or slowing down.",
      "Use the patterns to plan stock, staffing and promotions.",
    ],
  },
  {
    section: "analytics",
    title: "Analytics",
    helper: "Plan-tiered insight",
    summary:
      "Analytics shows your store's totals — sales, orders, customers and designs — across your plan's history window. Higher plans add trend charts, top-selling designs, outstanding balances, revenue breakdowns, design conversion and team analytics, plus downloadable report exports and scheduled emailed reports.",
    steps: [
      "Read the totals cards first — they cover your plan's history window, shown above them.",
      "Open the export panel to download financial records or a sales report in the formats your plan allows.",
      "Locked panels explain exactly which plan unlocks them if you choose to upgrade.",
    ],
  },
  {
    section: "customers",
    title: "Customers",
    helper: "Auto-built CRM",
    summary:
      "Customers builds itself — everyone who orders from your store is added automatically. Open a customer to call or WhatsApp them, see their full order history and saved measurements. Depending on your plan you can search the list, add notes and tags, filter segments and export it.",
    steps: [
      "Tap a customer to open their profile and contact them directly.",
      "Use the search box to find a customer by name or phone.",
      "Add a note like a fit preference, or tag customers to group them — these unlock on higher plans.",
    ],
  },
  {
    section: "orders",
    title: "Orders",
    helper: "Your production board",
    summary:
      "Orders is the production board for everything in the studio — online orders, walk-ins and custom pieces. Each order moves through clear stages from awaiting payment to fulfilled, so nothing gets lost.",
    steps: [
      "Filter by stage to focus on what's awaiting payment, in the studio, or ready.",
      "Open an order to see the customer, the piece, measurements and the agreed price.",
      "Move an order to its next stage as work progresses — the customer can follow along.",
      "Record a walk-in or custom order with the add button when someone orders in person.",
    ],
  },
  {
    section: "money",
    title: "Money",
    helper: "Tracked income",
    summary:
      "Money tracks what you've earned — Paystack payments, cash and mobile-money takings, commission and your net income. Xtiitch never holds your funds; this is a clear record so you always know where you stand.",
    steps: [
      "Review payments that came through checkout alongside takings you log yourself.",
      "Add cash or direct mobile-money takings so offline sales are counted too.",
      "Check commission and net income to understand your true earnings.",
    ],
  },
  {
    section: "visits",
    title: "Visits",
    helper: "Your fitting queue",
    summary:
      "Visits is your appointment book for fittings and studio visits — both booked-online and walk-in. It keeps the day's fittings in order so customers are seen on time.",
    steps: [
      "See today's and upcoming fittings in the queue.",
      "Open a visit to view the customer and the order it relates to.",
      "Mark visits attended or booked so the schedule stays accurate.",
    ],
  },
  {
    section: "handovers",
    title: "Handovers",
    helper: "Pickup & delivery",
    summary:
      "Handovers covers the last step — getting the finished garment to the customer by pickup or delivery. It tracks what's ready to go out and what's been collected.",
    steps: [
      "See which finished pieces are waiting for pickup or delivery.",
      "Open a handover to confirm the method and the customer's details.",
      "Mark it done once the piece is collected or delivered.",
    ],
  },
  {
    section: "catalogue",
    title: "Catalogue",
    helper: "Your storefront pieces",
    summary:
      "Catalogue is where you publish the designs that appear on your public storefront. Add pieces with photos, prices and sizes so customers can browse and order online.",
    steps: [
      "Add a design with a clear photo, a title, a price and the sizes you offer.",
      "Publish a piece to make it live on your storefront; retire it to take it down.",
      "Group related pieces into collections to organise your storefront.",
      "Keep prices and photos current — this is what customers see first.",
    ],
  },
  {
    section: "promotions",
    title: "Promotions",
    helper: "Promo codes",
    summary:
      "Promotions lets you create discount codes for your store, collections or campaigns — a percentage or fixed amount off, with limits you control.",
    steps: [
      "Create a code and choose a percentage or fixed discount.",
      "Set limits such as how many times it can be used and when it expires.",
      "Share the code with customers; deactivate it any time.",
    ],
  },
  {
    section: "measurements",
    title: "Measurements",
    helper: "Fitting setup",
    summary:
      "Measurements is where you define the measurement fields your studio uses, so fittings capture exactly what your tailors need for each kind of garment.",
    steps: [
      "Set up the measurement fields you take, like chest, waist and length.",
      "These fields then appear when you record a customer's measurements on an order.",
      "Keep the set tidy so fittings stay quick and consistent.",
    ],
  },
  {
    section: "availability",
    title: "Availability",
    helper: "Visit hours",
    summary:
      "Availability sets the hours and windows when customers can book fittings or visits, so your appointment book only offers times you can actually work.",
    steps: [
      "Add the days and time windows you accept visits.",
      "Block out times you're closed so customers can't book them.",
      "Update it around busy seasons and holidays.",
    ],
  },
  {
    section: "settings",
    title: "Settings",
    helper: "Store switches",
    summary:
      "Settings controls how your storefront looks and behaves — your brand colour and logo, which features are on (like bespoke, measurements or delivery), and other store switches available on your plan.",
    steps: [
      "Set your brand colour and logo so your storefront matches your studio.",
      "Turn features on or off depending on how you work.",
      "Some options depend on your plan — upgrade to unlock more.",
    ],
  },
  {
    section: "team",
    title: "Team",
    helper: "Access roles",
    summary:
      "Team is where owners and admins add staff and control what each person can see and do. Roles keep sensitive areas like money limited to the right people.",
    steps: [
      "Invite a team member with their name and email, and choose their role.",
      "Owners and admins manage everything; staff get the day-to-day workspaces.",
      "Remove or change access whenever your team changes.",
    ],
  },
  {
    section: "messages",
    title: "Messages",
    helper: "Customer outbox",
    summary:
      "Messages is your outbox for keeping customers informed — order updates and notifications that go out so people always know where their garment is.",
    steps: [
      "See the updates queued or sent to customers.",
      "Use it to confirm important moments like a fitting or a ready-for-pickup piece.",
      "Keep customers in the loop to build trust and repeat orders.",
    ],
  },
];

// Builds the spoken script for a single guide (title, what it's for, then steps).
export function spokenGuide(guide: HelpGuide): string {
  const steps = guide.steps
    .map((step, index) => `Step ${index + 1}. ${step}`)
    .join(" ");
  return `${guide.title}. ${guide.summary} How to use it. ${steps}`;
}

// Builds the spoken script for the whole guide (intro plus every page).
export function spokenAll(): string {
  return [HELP_INTRO, ...HELP_GUIDES.map(spokenGuide)].join(" ");
}
