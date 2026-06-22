const warnOnly = process.argv.includes("--warn-only");

const groups = [
  {
    name: "Sonar quality gate",
    required: ["SONAR_HOST_URL", "SONAR_ORGANIZATION", "SONAR_TOKEN"],
  },
  {
    name: "Paystack sandbox",
    required: ["PAYSTACK_SECRET_KEY", "PAYSTACK_WEBHOOK_SECRET"],
    recommended: ["BUSINESS_DASHBOARD_BASE_URL"],
  },
  notificationGroup(),
  waitlistGroup(),
  {
    name: "Legal and policy sign-off",
    required: ["XTIITCH_LEGAL_REVIEW_CONFIRMED"],
    note: "Set XTIITCH_LEGAL_REVIEW_CONFIRMED=true only after owner/legal approval is recorded.",
    truthy: true,
  },
  {
    name: "Growth policy decisions",
    required: ["XTIITCH_GROWTH_POLICY_CONFIRMED"],
    note: "Set XTIITCH_GROWTH_POLICY_CONFIRMED=true only after owner decisions are recorded.",
    truthy: true,
  },
];

const results = groups.map(evaluateGroup);
const blocked = results.filter((result) => result.status === "blocked");

console.log("Xtiitch launch gate check");
console.log("No secret values are printed.\n");

for (const result of results) {
  console.log(`[${result.status}] ${result.name}`);

  for (const line of result.lines) {
    console.log(`  - ${line}`);
  }

  if (result.note) {
    console.log(`  - ${result.note}`);
  }
}

if (blocked.length > 0) {
  console.log(
    `\n${blocked.length} launch gate${blocked.length === 1 ? "" : "s"} blocked.`,
  );
  if (!warnOnly) {
    process.exitCode = 1;
  }
} else {
  console.log("\nAll configured launch gates are satisfied.");
}

function notificationGroup() {
  const transport = value("NOTIFICATION_TRANSPORT") || "log";
  if (transport === "http") {
    return {
      name: "Notification provider sandbox",
      required: [
        "NOTIFICATION_TRANSPORT",
        "NOTIFICATION_HTTP_URL",
        "NOTIFICATION_HTTP_AUTH_VALUE",
      ],
      recommended: ["NOTIFICATION_FROM", "NOTIFICATION_HTTP_AUTH_HEADER"],
    };
  }

  return {
    name: "Notification provider sandbox",
    required: ["NOTIFICATION_TRANSPORT"],
    note: `NOTIFICATION_TRANSPORT=${transport} is fine for development but is not production-provider validation.`,
    forceBlocked: true,
  };
}

function waitlistGroup() {
  // Waitlist leads always persist to the database via the API
  // (POST /v1/marketing/waitlist -> waitlist_leads) and are visible in
  // admin -> Waitlist, so capture is never a launch blocker. The Resend keys
  // below are recommended: set them on the API to also email each lead to
  // MARKETING_WAITLIST_EMAIL_TO.
  return {
    name: "Marketing waitlist delivery",
    required: [],
    recommended: [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "MARKETING_WAITLIST_EMAIL_TO",
    ],
    note: "Leads are always stored in the DB and shown in admin -> Waitlist; the keys above (set on the API) add an email copy to MARKETING_WAITLIST_EMAIL_TO.",
  };
}

function evaluateGroup(group) {
  if (group.alternatives) {
    return evaluateAlternatives(group);
  }

  const missing = group.required.filter((key) =>
    group.truthy ? !isTrue(key) : !isSet(key),
  );
  const missingRecommended = (group.recommended ?? []).filter((key) => !isSet(key));
  const status = group.forceBlocked || missing.length > 0 ? "blocked" : "ready";
  const lines = [
    ...group.required.map((key) => `${key}: ${displayState(key, group.truthy)}`),
    ...missingRecommended.map((key) => `${key}: missing recommended value`),
  ];

  return {
    lines,
    name: group.name,
    note: group.note,
    status,
  };
}

function evaluateAlternatives(group) {
  const ready = group.alternatives.some((alternative) => alternative.ready);
  const lines = group.alternatives.map((alternative) => {
    const keyStates = alternative.keys
      .map((key) => `${key}=${displayState(key)}`)
      .join(", ");
    const recommended = (alternative.recommended ?? [])
      .map((key) => `${key}=${displayState(key)}`)
      .join(", ");
    const suffix = recommended ? `; ${recommended}` : "";
    return `${alternative.label}: ${keyStates}${suffix}`;
  });

  return {
    lines,
    name: group.name,
    status: ready ? "ready" : "blocked",
  };
}

function displayState(key, truthy = false) {
  if (truthy) {
    return isTrue(key) ? "confirmed" : "missing";
  }
  return isSet(key) ? "set" : "missing";
}

function isSet(key) {
  return value(key).length > 0;
}

function isTrue(key) {
  return ["1", "true", "yes"].includes(value(key).toLowerCase());
}

function value(key) {
  return (process.env[key] ?? "").trim();
}
