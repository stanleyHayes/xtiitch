import type { OutboundMessage } from "../outbox";

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
    default:
      return withDesign("Your Xtiitch order has an update.", design);
  }
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
