import assert from "node:assert/strict";
import test from "node:test";

import type { NotificationHttpConfig } from "./config";
import type { OutboundMessage } from "./outbox";
import { HttpNotificationSender, renderNotificationText } from "./senders";

const httpConfig: NotificationHttpConfig = {
  url: "https://provider.test/messages",
  authHeader: "X-API-Key",
  authValue: "secret-token",
  from: "Xtiitch",
  timeoutMs: 1_000,
};

test("renderNotificationText renders lifecycle templates", () => {
  assert.equal(
    renderNotificationText(
      makeMessage({
        kind: "order_confirmed",
        payload: { design: "Linen Kaftan" },
      }),
    ),
    "Your order is confirmed. We will update you when production moves forward. Design: Linen Kaftan.",
  );

  assert.equal(
    renderNotificationText(
      makeMessage({
        kind: "balance_paid",
        payload: { amount_minor: 12500 },
      }),
    ),
    "GH₵125.00 balance payment received. Thank you; your order record is up to date.",
  );
});

test("HttpNotificationSender posts provider payload with auth and idempotency headers", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(
      JSON.stringify({ provider_message_id: "provider-message-1" }),
      { status: 202 },
    );
  };
  const sender = new HttpNotificationSender(httpConfig, fetcher);

  const result = await sender.send(
    makeMessage({
      messageId: "message-123",
      channel: "sms",
      kind: "handover_dispatched",
      recipient: "0241234567",
      payload: { courier: "Rider One" },
    }),
  );

  assert.equal(capturedUrl, httpConfig.url);
  assert.equal(capturedInit?.method, "POST");
  const headers = capturedInit?.headers as Record<string, string>;
  assert.equal(headers["X-API-Key"], "secret-token");
  assert.equal(headers["Idempotency-Key"], "message-123");

  const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.equal(body.message_id, "message-123");
  assert.equal(body.channel, "sms");
  assert.equal(body.recipient, "0241234567");
  assert.equal(body.from, "Xtiitch");
  assert.equal(body.text, "Your order has been dispatched. Courier: Rider One.");
  assert.equal(result.providerMessageId, "provider-message-1");
  assert.deepEqual(result.providerResponse, {
    provider_message_id: "provider-message-1",
  });
});

test("HttpNotificationSender fails on non-success provider responses", async () => {
  const sender = new HttpNotificationSender(httpConfig, async () => {
    return new Response("bad recipient", { status: 422 });
  });

  await assert.rejects(
    sender.send(makeMessage()),
    /notification provider returned 422: bad recipient/,
  );
});

function makeMessage(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return {
    messageId: "11111111-1111-1111-1111-111111111111",
    businessId: "22222222-2222-2222-2222-222222222222",
    channel: "whatsapp",
    kind: "order_confirmed",
    recipient: "0241234567",
    payload: {},
    attempts: 1,
    ...overrides,
  };
}
