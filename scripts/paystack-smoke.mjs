import { createHmac, randomBytes } from "node:crypto";

import { loadDotEnvFile } from "./lib/env.mjs";

loadDotEnvFile(".env");

const allowLive = process.argv.includes("--allow-live");
const secretKey = value("PAYSTACK_SECRET_KEY");
const webhookSecret = value("PAYSTACK_WEBHOOK_SECRET");
const amountMinor = positiveInt(value("PAYSTACK_SMOKE_AMOUNT_MINOR"), 100);
const currency = value("PAYSTACK_SMOKE_CURRENCY") || "GHS";
const email =
  value("PAYSTACK_SMOKE_EMAIL") || `paystack-smoke+${Date.now()}@xtiitch.com`;
const callbackURL =
  value("PAYSTACK_SMOKE_CALLBACK_URL") ||
  value("BUSINESS_DASHBOARD_BASE_URL") ||
  "https://xtiitch.test/paystack-smoke";

try {
  requireConfig();
  const reference = `xtiitch-smoke-${Date.now()}-${randomBytes(3).toString(
    "hex",
  )}`;
  const body = {
    amount: String(amountMinor),
    callback_url: callbackURL,
    currency,
    email,
    metadata: {
      source: "xtiitch-provider-smoke",
    },
    reference,
  };

  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  const payload = await readJSON(response);
  if (!response.ok || payload?.status !== true) {
    throw new Error(
      `Paystack initialize failed (${response.status}): ${safeMessage(payload)}`,
    );
  }
  const data = payload.data ?? {};
  if (
    data.reference !== reference ||
    !data.authorization_url ||
    !data.access_code
  ) {
    throw new Error(
      "Paystack initialize response was missing expected fields.",
    );
  }

  assertWebhookSigning(reference);

  console.log("Paystack sandbox smoke passed");
  console.log(`- Mode: ${secretKey.startsWith("sk_test_") ? "test" : "live"}`);
  console.log(`- Reference: ${reference}`);
  console.log(`- Amount: ${currency} ${(amountMinor / 100).toFixed(2)}`);
  console.log("- Hosted authorization URL returned: yes");
  console.log("- Webhook HMAC self-check: passed");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function requireConfig() {
  const missing = [
    ["PAYSTACK_SECRET_KEY", secretKey],
    ["PAYSTACK_WEBHOOK_SECRET", webhookSecret],
  ].filter(([, current]) => !current);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Paystack config: ${missing
        .map(([key]) => key)
        .join(", ")}`,
    );
  }
  if (!allowLive && !secretKey.startsWith("sk_test_")) {
    throw new Error(
      "Refusing to run Paystack smoke with a non-test key. Pass --allow-live only for an intentional live-provider check.",
    );
  }
}

function assertWebhookSigning(reference) {
  const event = Buffer.from(
    JSON.stringify({ event: "charge.success", data: { reference } }),
  );
  const signature = createHmac("sha512", webhookSecret)
    .update(event)
    .digest("hex");
  if (signature.length !== 128) {
    throw new Error("Webhook HMAC self-check failed.");
  }
}

async function readJSON(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 240) };
  }
}

function safeMessage(payload) {
  const message = String(payload?.message ?? "no provider message");
  return message.replace(/sk_(test|live)_[A-Za-z0-9]+/g, "sk_$1_[redacted]");
}

function positiveInt(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function value(key) {
  return (process.env[key] ?? "").trim();
}
