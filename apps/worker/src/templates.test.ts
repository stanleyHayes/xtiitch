import assert from "node:assert/strict";
import test from "node:test";

import type { OutboundMessage } from "./outbox";
import { renderNotificationText } from "./senders";

// §13.3 renewal reminders always state the amount (the full renewal figure
// incl. VAT + transaction fee) and carry the one-tap re-pay link.
test("renderNotificationText renders subscription renewal reminders (§13.3)", () => {
  // Lead-day upcoming reminder: states the amount and the re-pay link, words
  // the lead day ("in 7 days" vs "today").
  assert.equal(
    renderNotificationText(
      reminderMessage("subscription_renewal_upcoming", {
        plan: "Growth",
        renewal_amount_minor: 36716,
        renewal_at: "2026-06-24T12:00:00Z",
        repay_url: "https://business.xtiitch.com/onboarding/billing",
        lead_day: 7,
      }),
    ),
    "Your Xtiitch Growth plan renews in 7 days on 24 Jun 2026. Amount due: GH₵367.16. Pay: https://business.xtiitch.com/onboarding/billing",
  );

  // On-date reminder (lead_day 0): "today".
  assert.equal(
    renderNotificationText(
      reminderMessage("subscription_renewal_upcoming", {
        plan: "Studio",
        renewal_amount_minor: 243549,
        renewal_at: "2026-06-17T14:00:00Z",
        repay_url: "https://business.xtiitch.com/onboarding/billing",
        lead_day: 0,
      }),
    ),
    "Your Xtiitch Studio plan renews today on 17 Jun 2026. Amount due: GH₵2,435.49. Pay: https://business.xtiitch.com/onboarding/billing",
  );

  // Past-due dunning reminder: grace deadline + amount + link.
  assert.equal(
    renderNotificationText(
      reminderMessage("subscription_renewal_past_due", {
        plan: "Growth",
        renewal_amount_minor: 36716,
        grace_ends_at: "2026-06-24T12:00:00Z",
        repay_url: "https://business.xtiitch.com/onboarding/billing",
      }),
    ),
    "Your Xtiitch Growth plan payment of GH₵367.16 is due by 24 Jun 2026. Pay to keep your paid features. Pay: https://business.xtiitch.com/onboarding/billing",
  );

  // A missing amount never prints "NaN" — it degrades to a generic label.
  assert.equal(
    renderNotificationText(
      reminderMessage("subscription_renewal_upcoming", { lead_day: 3 }),
    ),
    "Your Xtiitch paid plan renews in 3 days. Amount due: your plan amount.",
  );
});

function reminderMessage(
  kind: string,
  payload: Record<string, unknown>,
): OutboundMessage {
  return {
    messageId: "11111111-1111-1111-1111-111111111111",
    businessId: "22222222-2222-2222-2222-222222222222",
    channel: "sms",
    kind,
    recipient: "0241234567",
    payload,
    attempts: 1,
  };
}
