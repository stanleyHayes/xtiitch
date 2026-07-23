export type CapabilityItem = {
  title: string;
  body: string;
  availability: string;
};

export type CapabilityArea = {
  label: string;
  title: string;
  summary: string;
  items: CapabilityItem[];
};

export const capabilityAreas: CapabilityArea[] = [
  {
    label: "Business workspace",
    title: "The day-to-day operating system",
    summary:
      "Owners get the management view; staff get a focused queue for the work they are allowed to move.",
    items: [
      {
        title: "Orders and production",
        body: "Run online, walk-in and custom orders on one production board, with measurements, choices, pricing and stage history attached.",
        availability: "Unlimited orders on every plan.",
      },
      {
        title: "Customer CRM",
        body: "Customer profiles build automatically from orders, with contact details, history and measurements. Search, notes, tags, segments and exports unlock by plan.",
        availability: "Basic, Standard, Full or Advanced CRM by plan.",
      },
      {
        title: "Visits and fittings",
        body: "Publish availability, receive home-visit and fitting bookings, and manage booked, attended and upcoming appointments.",
        availability: "Core visits and availability are available to every store.",
      },
      {
        title: "Handovers",
        body: "Track finished garments waiting for pickup or delivery, use configured delivery zones and fees, and record collection or dispatch.",
        availability: "Pickup, delivery and handover records are built into operations.",
      },
      {
        title: "Money and settlements",
        body: "See Paystack payments, cash and direct mobile-money takings, sales fees, settlement records and net income without treating Xtiitch like a wallet.",
        availability: "Core money records on every plan; Xtiitch never holds store funds.",
      },
      {
        title: "Reports and analytics",
        body: "Review orders, revenue, customers, catalogue performance, balances and staff activity. History, depth, exports and schedules expand by plan.",
        availability: "30-day Basic analytics on Free through Advanced on Studio.",
      },
      {
        title: "Team work and messages",
        body: "Owners and admins manage the business; staff receive safer task, order, visit, handover and message views. Customer notifications remain visible in the outbox.",
        availability: "1, 2, 5 or 10 active accounts from Free through Studio.",
      },
    ],
  },
  {
    label: "Storefront and customer",
    title: "Everything customers can see and do",
    summary:
      "The public experience is a real shop, not a profile page, and the customer can continue after checkout without calling for every update.",
    items: [
      {
        title: "Store, design and collection links",
        body: "Every store has a public URL. Designs and collections have shareable pages for Instagram, TikTok, Facebook and WhatsApp traffic.",
        availability: "A store link and catalogue are included on every plan.",
      },
      {
        title: "Marketplace discovery",
        body: "Customers can browse studios and designs, search by style and move from discovery into a store or product page without signing in first.",
        availability: "Public browsing is open; sponsored placement is always labelled.",
      },
      {
        title: "Standard and bespoke ordering",
        body: "Customers can choose a published size, self-measure, book a home visit or reserve a shop measurement, depending on the store’s switches.",
        availability: "Fit routes appear only when the store has enabled and configured them.",
      },
      {
        title: "Cart and transparent checkout",
        body: "Quantity controls combine repeated products. Checkout shows products, transaction fees and any customer-paid Tax fee before Paystack opens.",
        availability: "Mobile money and card checkout is available on every current plan.",
      },
      {
        title: "Tracking, pickup and delivery",
        body: "Customers follow plain production stages, see readiness guidance, and continue through pickup or a delivery zone selected at checkout.",
        availability: "Customer tracking links are included on every plan.",
      },
      {
        title: "Customer account",
        body: "Password-free sign-in brings current and archived orders together. Customers can retry payment, close an awaiting-payment order, track progress and confirm receipt.",
        availability: "Awaiting-payment orders automatically expire after 24 hours.",
      },
      {
        title: "Design waiting lists",
        body: "When enabled, an unavailable or upcoming design can collect customer interest instead of losing it.",
        availability: "Growth and Studio.",
      },
    ],
  },
  {
    label: "Trust and control",
    title: "The safeguards around the work",
    summary:
      "Capabilities are tenant-scoped, payment activation is verified, and higher-plan access is never granted before payment.",
    items: [
      {
        title: "Roles and two-step security",
        body: "Owner, admin and staff roles keep sensitive work in the right hands. Business users can add authenticator-based two-step sign-in and backup codes.",
        availability: "Role limits follow the active plan.",
      },
      {
        title: "Store-by-store isolation",
        body: "One business cannot read another business’s catalogue, orders, customers, measurements or money records.",
        availability: "Platform-wide security boundary.",
      },
      {
        title: "Direct payment settlement",
        body: "Paystack processes checkout and settles the store’s own subaccount. Xtiitch records the sale and its fee split but never stores raw card details or holds customer funds.",
        availability: "Subject to business verification and Paystack availability.",
      },
      {
        title: "Paid-before-active upgrades",
        body: "A higher plan activates only after its prorated payment is verified. Downgrades wait until the next renewal, so paid access remains predictable.",
        availability: "Quarterly and yearly billing are supported for paid plans.",
      },
      {
        title: "Honest availability labels",
        body: "Plan-gated tools say which tier unlocks them. Promotions are parked, while referral, affiliate and sponsored programmes remain separately operator-managed.",
        availability: "Parked or operator-managed programmes are not sold as plan benefits.",
      },
    ],
  },
];
export type PlanCapabilityRow = {
  capability: string;
  helper: string;
  values: [string, string, string, string];
};

export const planCapabilityRows: PlanCapabilityRow[] = [
  {
    capability: "Online orders and customers",
    helper: "No order or customer cap is used as an upgrade gate.",
    values: ["Unlimited", "Unlimited", "Unlimited", "Unlimited"],
  },
  {
    capability: "Active designs",
    helper: "The catalogue publishing limit.",
    values: ["10", "50", "Unlimited", "Unlimited"],
  },
  {
    capability: "Images / colour variations",
    helper: "Maximum per design.",
    values: ["2 / 2", "5 / 3", "5 / 5", "5 / 10"],
  },
  {
    capability: "Team accounts",
    helper: "Includes the owner.",
    values: ["1", "2", "5", "10"],
  },
  {
    capability: "Storefront branding",
    helper: "All plans still receive a real public store.",
    values: [
      "Xtiitch look + badge",
      "Colour + logo",
      "Banner + layouts",
      "Banner + layouts",
    ],
  },
  {
    capability: "Analytics",
    helper: "History and analysis depth.",
    values: [
      "Basic · 30 days",
      "Standard · 12 months",
      "Full · all history",
      "Advanced · all history",
    ],
  },
  {
    capability: "Customer CRM",
    helper: "Profiles exist on every tier; management depth grows.",
    values: ["Basic", "Search + notes", "Tags + segments", "Advanced"],
  },
  {
    capability: "Exports and schedules",
    helper: "Available report and record formats.",
    values: [
      "View only",
      "CSV",
      "CSV + PDF · monthly",
      "CSV + PDF + DOCX + XLSX · any cadence",
    ],
  },
  {
    capability: "Waiting lists and support",
    helper: "Demand capture and service level.",
    values: [
      "Standard support",
      "Standard support",
      "Waitlists + priority",
      "Waitlists + dedicated success",
    ],
  },
];
