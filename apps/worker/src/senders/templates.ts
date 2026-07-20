import type { OutboundMessage } from "../outbox";

// Flat kind→template dispatcher; each case delegates (the subscription kinds
// defer to renderSubscriptionReminder below), so the count is misleading.
// eslint-disable-next-line complexity
export function renderNotificationText(message: OutboundMessage): string {
  const design = stringPayload(message.payload.design);
  switch (message.kind) {
    case "order_confirmed":
      return withDesign(
        "Your order is confirmed. We will update you when production moves forward.",
        design,
      );
    case "order_stage_advanced": {
      // Stages are business-defined, so the message names the stage the order
      // just reached; fall back to a generic line when the name is missing.
      const stage = stringPayload(message.payload.stage);
      const text = stage
        ? `Update: your order has moved to the "${stage}" stage.`
        : "Update: your order has moved to the next production stage.";
      return withDesign(text, design);
    }
    case "order_fulfilled":
      return withDesign(
        "Your order is ready. Please contact the business to arrange pickup or delivery.",
        design,
      );
    case "booking_confirmed":
      return `Your home-visit booking is confirmed${dateClause(
        message.payload.slot_start,
      )}. ${withDesign("We will see you then.", design)}`;
    case "balance_paid":
      return `${amountClause(
        message.payload.amount_minor,
      )} balance payment received. ${withDesign(
        "Thank you; your order record is up to date.",
        design,
      )}`;
    case "handover_dispatched":
      return `${withDesign(
        "Your order has been dispatched.",
        design,
      )}${courierClause(message.payload.courier)}`;
    case "handover_completed":
      return withDesign(
        "Your order handover is complete. Thank you.",
        design,
      );
    case "new_order_owner": {
      const customer = stringPayload(message.payload.customer);
      const who = customer ? ` from ${customer}` : "";
      const item = design ? ` (${design})` : "";
      const amount = message.payload.amount_minor;
      // Bespoke orders have no fixed price yet (amount 0), so omit the price.
      const price =
        typeof amount === "number" && Number.isFinite(amount) && amount > 0
          ? ` — ${new Intl.NumberFormat("en-GH", {
              style: "currency",
              currency: "GHS",
            }).format(amount / 100)}`
          : "";
      return `New Xtiitch order${item}${who}${price}. Open your dashboard to manage it.`;
    }
    case "subscription_renewal_upcoming":
    case "subscription_renewal_past_due":
      return renderSubscriptionReminder(message);
    default:
      return withDesign("Your Xtiitch order has an update.", design);
  }
}

// renderSubscriptionReminder words the §13.3 subscription reminders. Every one
// states the amount (the full renewal figure incl. VAT + transaction fee) and
// the one-tap re-pay link — for MoMo subscriptions, which cannot be silently
// auto-debited, this message IS the renewal path.
function renderSubscriptionReminder(message: OutboundMessage): string {
  const plan = stringPayload(message.payload.plan) || "paid";
  const amount = renewalAmountClause(message.payload.renewal_amount_minor);
  const repay = repayClause(message.payload.repay_url);

  if (message.kind === "subscription_renewal_past_due") {
    // Dunning (§13.3): a MoMo renewal that could not be silently charged, or
    // a failed card charge now in grace — re-pay before the grace window ends.
    const grace = renewalDateClause(message.payload.grace_ends_at, " by ");
    return `Your Xtiitch ${plan} plan payment of ${amount} is due${grace}. Pay to keep your paid features.${repay}`;
  }

  // Lead-day upcoming reminder (15/7/3/0): "in 7 days" or, on the renewal
  // date itself, "today".
  const leadDay = message.payload.lead_day;
  const when =
    typeof leadDay === "number" && leadDay > 0 ? `in ${leadDay} days` : "today";
  return `Your Xtiitch ${plan} plan renews ${when}${renewalDateClause(
    message.payload.renewal_at,
    " on ",
  )}. Amount due: ${amount}.${repay}`;
}

export function maskRecipient(recipient: string): string {
  if (recipient.length <= 4) {
    return "****";
  }
  return `${"*".repeat(Math.max(0, recipient.length - 4))}${recipient.slice(-4)}`;
}

function withDesign(text: string, design: string): string {
  if (design === "") {
    return text;
  }
  return `${text} Design: ${design}.`;
}

function dateClause(value: unknown): string {
  const date = stringPayload(value);
  if (date === "") {
    return "";
  }
  return ` for ${new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Accra",
  }).format(new Date(date))}`;
}

// renewalDateClause renders a subscription renewal/grace date (date only —
// the exact billing timestamp is noise in a reminder).
function renewalDateClause(value: unknown, prefix: string): string {
  const date = stringPayload(value);
  if (date === "") {
    return "";
  }
  return `${prefix}${new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeZone: "Africa/Accra",
  }).format(new Date(date))}`;
}

// renewalAmountClause formats the subscription renewal figure (GHS minor
// units) the reminder must always state (§13.3); a missing/invalid figure
// falls back to a generic label rather than printing "NaN".
function renewalAmountClause(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "your plan amount";
  }
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(value / 100);
}

function repayClause(value: unknown): string {
  const url = stringPayload(value);
  if (url === "") {
    return "";
  }
  return ` Pay: ${url}`;
}

function amountClause(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Your";
  }
  return `${new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format(value / 100)}`;
}

function courierClause(value: unknown): string {
  const courier = stringPayload(value);
  if (courier === "") {
    return "";
  }
  return ` Courier: ${courier}.`;
}

function stringPayload(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
