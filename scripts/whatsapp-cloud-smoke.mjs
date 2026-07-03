import { loadDotEnvFile } from "./lib/env.mjs";

loadDotEnvFile(".env");

const phoneNumberID = value("WHATSAPP_PHONE_NUMBER_ID");
const accessToken = value("WHATSAPP_ACCESS_TOKEN");
const graphVersion =
  value("WHATSAPP_GRAPH_VERSION") || value("WHATSAPP_API_VERSION") || "v21.0";

try {
  requireConfig();
  const url = new URL(
    `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(
      phoneNumberID,
    )}`,
  );
  url.searchParams.set("fields", "display_phone_number,verified_name");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    method: "GET",
  });
  const payload = await readJSON(response);
  if (!response.ok) {
    throw new Error(
      `WhatsApp Cloud phone-number lookup failed (${response.status}): ${safeMessage(
        payload,
      )}`,
    );
  }
  if (!payload?.id) {
    throw new Error("WhatsApp Cloud lookup response was missing the phone id.");
  }

  console.log("WhatsApp Cloud credential smoke passed");
  console.log("- Phone-number credential can be read: yes");
  console.log("- Access token authorized for configured phone number: yes");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function requireConfig() {
  const missing = [
    ["WHATSAPP_PHONE_NUMBER_ID", phoneNumberID],
    ["WHATSAPP_ACCESS_TOKEN", accessToken],
  ].filter(([, current]) => !current);
  if (missing.length > 0) {
    throw new Error(
      `Missing required WhatsApp Cloud config: ${missing
        .map(([key]) => key)
        .join(", ")}`,
    );
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
    return { error: { message: text.slice(0, 240) } };
  }
}

function safeMessage(payload) {
  return String(
    payload?.error?.message ?? payload?.message ?? "no provider message",
  ).replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
}

function value(key) {
  return (process.env[key] ?? "").trim();
}
