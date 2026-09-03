// Operator guides for every admin-console section. Rendered in the help drawer
// (per section) and on the full /help guide, and read aloud via text-to-speech.
// Mirrors the business dashboard help so operators get the same kind of guidance.
// Keep each guide plain and spoken-friendly: a short "what it's for" plus steps.

export type HelpGuide = {
  /** Matches the admin section key so the per-section drawer can find it. */
  section: string;
  title: string;
  helper: string;
  summary: string;
  steps: string[];
};

export const HELP_INTRO =
  "Welcome to the Xtiitch admin console. This is the operator control room for the whole platform — verifications, merchant accounts, customers, subscriptions, money rails and support all live here. This guide explains what each section does and how to use it. You can read it, or press Listen to have it read to you.";

export const HELP_GUIDES: HelpGuide[] = [
  {
    section: "overview",
    title: "Overview",
    helper: "Platform at a glance",
    summary:
      "The landing view summarising platform health — pending verifications, open risk, support load and recent activity — so you can triage from one place.",
    steps: [
      "Scan the stat cards for anything that needs attention now (pending verifications, open risk, urgent tickets).",
      "Click a card or use the left rail to jump straight to that section.",
      "Use this page at the start of a shift to decide what to work on first.",
    ],
  },
  {
    section: "verification",
    title: "Verification",
    helper: "Approve businesses to take money",
    summary:
      "Review business verification requests (identity and settlement details) and approve or reject them. A business cannot take card or mobile-money payments until it is verified.",
    steps: [
      "Open a pending request to review the submitted business and settlement/identity details.",
      "Approve it to provision the payment subaccount and unlock online payments, or reject it with a clear reason.",
      "Rejected merchants can resubmit; check the audit log if you need the history of a decision.",
    ],
  },
  {
    section: "businesses",
    title: "Businesses",
    helper: "Manage merchant accounts",
    summary:
      "The directory of every business on the platform. Search a merchant to inspect its plan, status, storefront and owners, and take account-level actions.",
    steps: [
      "Search by name or handle to find a merchant.",
      "Open a business to see its plan, verification state and storefront link.",
      "Use the account actions for support cases — always note why in the audit trail.",
    ],
  },
  {
    section: "customers",
    title: "Customers",
    helper: "End-customer records",
    summary:
      "End-customer (shopper) records across all stores. Use this for data-subject requests — export a customer's data or erase it on request.",
    steps: [
      "Search for the customer by phone or email.",
      "Use Export to produce their data for a data-request.",
      "Use Erase only for a verified deletion request; the action is logged.",
    ],
  },
  {
    section: "subscriptions",
    title: "Subscriptions",
    helper: "Plans & billing",
    summary:
      "Manage subscription plans and each business's billing — issue invoices, see status (trialing, active, past-due, grace, canceled) and reconcile recurring charges.",
    steps: [
      "Open a subscription to see its plan, status and next billing date.",
      "Issue or reconcile an invoice when a recurring charge needs attention.",
      "Watch grace-period and past-due subscriptions so merchants are not cut off unexpectedly.",
    ],
  },
  {
    section: "money",
    title: "Money rails",
    helper: "Commission & reconciliation",
    summary:
      "Platform money view: through-platform income, commission earned, and fee-free manual takings. Xtiitch never holds funds — Paystack settles merchants directly — so this is for reconciliation, not a wallet.",
    steps: [
      "Review through-platform totals and the commission split.",
      "Check offline/manual takings, which are fee-free and carry no commission.",
      "Use manual takings to reconcile sales that happened outside Xtiitch checkout before closing a period.",
    ],
  },
  {
    section: "payouts",
    title: "Payouts",
    helper: "Store payout records",
    summary:
      "Every store owner's payout record — MoMo destination, Paystack subaccount, total sales and settled, Xtiitch fees and tax, and the amount due. Figures mirror Paystack (the source of truth), so use them to answer any “was I paid?” question.",
    steps: [
      "Search by business or owner legal name to find a store.",
      "Open a row to see every payout made — amount, date and status.",
      "Check the last payout status first when an owner asks about a missing settlement.",
    ],
  },
  {
    section: "risk",
    title: "Risk",
    helper: "Flags to investigate",
    summary:
      "Surfaces accounts and transactions flagged for review. Work the queue so genuine issues are actioned and false positives are cleared.",
    steps: [
      "Open a flagged item to see why it was raised.",
      "Investigate the linked business or payment.",
      "Resolve or escalate, recording the outcome.",
    ],
  },
  {
    section: "users",
    title: "Users",
    helper: "Operator accounts",
    summary:
      "Admin operator accounts. Invite teammates, set their role, and deactivate access when someone leaves.",
    steps: [
      "Create a user and assign the right role for what they need.",
      "Edit a user to change role or reset access.",
      "Deactivate accounts promptly when access should end.",
    ],
  },
  {
    section: "roles",
    title: "Roles",
    helper: "Permissions",
    summary:
      "Define what each operator role can see and do across the console's granular permissions.",
    steps: [
      "Open a role to review its permissions.",
      "Grant only the permissions that role genuinely needs.",
      "Assign roles to users on the Users page.",
    ],
  },
  {
    section: "support",
    title: "Support",
    helper: "Merchant tickets",
    summary:
      "The support queue for merchant and customer issues. Pick up tickets, respond, and close them out.",
    steps: [
      "Sort by urgency and pick up the oldest urgent ticket.",
      "Respond, and link any related business or order.",
      "Resolve the ticket and note the resolution.",
    ],
  },
  {
    section: "settings",
    title: "Settings",
    helper: "Platform controls",
    summary:
      "Platform-wide settings and marketing launch flags — reveal or hide not-yet-launched surfaces (discover, browse store) without a redeploy.",
    steps: [
      "Toggle a marketing launch flag to reveal or hide that surface.",
      "Update platform branding and policy controls here.",
      "Changes apply platform-wide, so confirm before saving.",
    ],
  },
  {
    section: "waitlist",
    title: "Waitlist",
    helper: "Marketing leads",
    summary:
      "Leads captured by the public marketing site during the pre-launch / founding-pricing window.",
    steps: [
      "Review new leads as they arrive.",
      "Export or follow up with leads as needed.",
      "Use this to gauge launch demand.",
    ],
  },
  {
    section: "notifications",
    title: "Notifications",
    helper: "Platform alerts",
    summary:
      "Platform-level alerts for operators — verification requests, risk flags and billing events that need a human.",
    steps: [
      "Open the latest alerts and triage from here.",
      "Jump to the related section to action an alert.",
      "Clear alerts once handled to keep the queue meaningful.",
    ],
  },
  {
    section: "audit",
    title: "Audit log",
    helper: "Console activity trail",
    summary:
      "An immutable trail of operator actions. Use it to investigate who did what and when.",
    steps: [
      "Filter by operator, action or date to narrow the trail.",
      "Open an entry to see the full detail of an action.",
      "Reference the audit log when reviewing any sensitive decision.",
    ],
  },
  {
    section: "reports",
    title: "Reports",
    helper: "Compliance and operating posture",
    summary:
      "A compact evidence view of money controls, compliance flags, platform policy and work that still needs an operator.",
    steps: [
      "Start with Report flags to see how many items are blocked or need watching.",
      "Open a report row or compliance signal to move to the page where the issue can be resolved.",
      "Select Download CSV when you need a dated posture snapshot for review or handoff.",
    ],
  },
  {
    section: "exports",
    title: "Exports",
    helper: "Downloadable admin snapshots",
    summary:
      "Build CSV snapshots from the admin console's current data for reporting, compliance review and operational handoff.",
    steps: [
      "Review the summary cards to confirm which export packs and rows are available.",
      "Choose the dataset that matches the question you need to answer and review its description.",
      "Download the CSV, then keep the generated file with the case or reporting period it supports.",
    ],
  },
  {
    section: "health",
    title: "Health",
    helper: "Platform operating posture",
    summary:
      "Combines payment, risk, support and audit signals into one operational health score and a list of conditions that need attention.",
    steps: [
      "Check the health score, then prioritise any signal marked blocked before watch items.",
      "Open a health signal to jump to the responsible admin page and investigate the underlying records.",
      "Return here after taking action to confirm the loaded posture no longer shows the issue.",
    ],
  },
  {
    section: "readiness",
    title: "Readiness",
    helper: "Production launch gates",
    summary:
      "Tracks credentials, provider transports, legal checks, quality scans and owner-controlled configuration required for launch.",
    steps: [
      "Review blocked gates first; each one must be cleared before launch.",
      "Open the target page shown on a gate and complete the required configuration or evidence.",
      "Recheck watch items and the readiness score before making a launch decision.",
    ],
  },
  {
    section: "promotions",
    title: "Promotions",
    helper: "Voucher rules and offers",
    summary:
      "Create and manage platform-wide or business-specific offers, including funding, redemption limits and active dates.",
    steps: [
      "Search or filter the promotion list to review an existing offer and its redemption activity.",
      "Create a promotion with its audience, discount, funding owner, limits and valid dates.",
      "Open an offer to update or archive it; confirm the scope before changing a live promotion.",
    ],
  },
  {
    section: "ads",
    title: "Ads",
    helper: "Sponsored placements",
    summary:
      "Review and manage paid featured businesses, promoted designs, placement windows, campaign budgets and engagement.",
    steps: [
      "Open pending campaigns first and check the business, creative, placement, dates and booked budget.",
      "Approve only campaigns that are paid and suitable for the requested placement, or record why they cannot run.",
      "Monitor active placement dates, impressions and clicks, then close completed campaigns cleanly.",
    ],
  },
  {
    section: "affiliates",
    title: "Affiliates",
    helper: "Affiliate programmes and payouts",
    summary:
      "Approve Affiliates, manage Affiliate programmes and codes, review attribution, and confirm payout-recipient readiness.",
    steps: [
      "Review pending applications and verify the Affiliate details before approving access.",
      "Open an Affiliate to manage status, commission terms, cookie window, codes and payout destination readiness.",
      "For matured commission, send the payout to the displayed Paystack recipient and record the completed transfer reference.",
    ],
  },
  {
    section: "referrals",
    title: "Referrals",
    helper: "Two-sided reward programmes",
    summary:
      "Create referral programmes with qualifying order rules, rewards for each side, payout holds, dates and lifecycle controls.",
    steps: [
      "Open an existing programme to review its issued codes, reward economics and current status.",
      "Create a programme with the qualifying order minimum, both rewards, hold period and active dates.",
      "Keep unfinished programmes in draft, pause them to stop new rewards, or archive them when they are no longer needed.",
    ],
  },
];

export function spokenGuide(guide: HelpGuide): string {
  const steps = guide.steps
    .map((step, index) => `Step ${index + 1}. ${step}`)
    .join(" ");
  return `${guide.title}. ${guide.summary} How to use it. ${steps}`;
}

export function spokenAll(): string {
  return [HELP_INTRO, ...HELP_GUIDES.map(spokenGuide)].join(" ");
}
