import assert from "node:assert/strict";
import test from "node:test";

import type { ExpoPushConfig } from "./config";
import {
  PermanentSendError,
  drainOutbox,
  type DrainSummary,
  type NotificationSendResult,
  type OutboundMessage,
  type OutboxStore,
} from "./outbox";
import { ExpoPushSender, renderPushNotification } from "./senders";

const expoConfig: ExpoPushConfig = {
  endpoint: "https://exp.host/--/api/v2/push/send",
  accessToken: "",
  timeoutMs: 1_000,
};

const token = "ExponentPushToken[abcdefghijklmnopqrstuv]";

function pushMessage(overrides: Partial<OutboundMessage> = {}): OutboundMessage {
  return {
    messageId: "11111111-1111-1111-1111-111111111111",
    businessId: "22222222-2222-2222-2222-222222222222",
    channel: "push",
    kind: "new_order_owner_push",
    recipient: token,
    payload: {
      order_id: "33333333-3333-3333-3333-333333333333",
      design: "Kente wrap dress",
      customer: "Ama Boateng",
      amount_minor: 25_000,
    },
    attempts: 1,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class RecordingDeviceSink {
  forgotten: string[] = [];
  async forgetPushToken(value: string): Promise<void> {
    this.forgotten.push(value);
  }
}

test("ExpoPushSender posts the title, body and deep-link data", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return jsonResponse({ data: { status: "ok", id: "ticket-1" } });
  };

  const sender = new ExpoPushSender(expoConfig, fetcher);
  const result = await sender.send(pushMessage());

  assert.equal(capturedUrl, expoConfig.endpoint);
  const body = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.equal(body.to, token);
  assert.equal(body.title, "New order");
  assert.equal(body.body, "Ama Boateng · Kente wrap dress · GH₵250.00");
  assert.equal(body.priority, "high");
  assert.equal(body.channelId, "orders");
  assert.deepEqual(body.data, {
    kind: "new_order_owner_push",
    order_id: "33333333-3333-3333-3333-333333333333",
    message_id: "11111111-1111-1111-1111-111111111111",
  });
  assert.equal(result.providerMessageId, "ticket-1");
});

// Expo rejects a WRONG access token with 401, so an empty one must not be sent
// as an empty Bearer header.
test("ExpoPushSender omits the Authorization header when no access token is set", async () => {
  let headers: Record<string, string> = {};
  const fetcher: typeof fetch = async (_url, init) => {
    headers = (init?.headers ?? {}) as Record<string, string>;
    return jsonResponse({ data: { status: "ok", id: "ticket-1" } });
  };

  await new ExpoPushSender(expoConfig, fetcher).send(pushMessage());
  assert.equal(headers.authorization, undefined);

  await new ExpoPushSender(
    { ...expoConfig, accessToken: "expo-secret" },
    fetcher,
  ).send(pushMessage());
  assert.equal(headers.authorization, "Bearer expo-secret");
});

// The trap this whole transport exists to avoid: Expo answers 200 for a dead
// token. Trusting the status code would mark it sent and keep the token
// on file forever.
test("ExpoPushSender treats a 200 carrying DeviceNotRegistered as permanent and retires the token", async () => {
  const devices = new RecordingDeviceSink();
  const fetcher: typeof fetch = async () =>
    jsonResponse({
      data: {
        status: "error",
        message: `"${token}" is not a registered push notification recipient`,
        details: { error: "DeviceNotRegistered", expoPushToken: token },
      },
    });

  const sender = new ExpoPushSender(expoConfig, fetcher, devices);
  await assert.rejects(
    () => sender.send(pushMessage()),
    (error: unknown) => {
      assert.ok(
        error instanceof PermanentSendError,
        "a gone device must not be retried",
      );
      return true;
    },
  );
  assert.deepEqual(devices.forgotten, [token]);
});

test("ExpoPushSender retries a rate-limited ticket and keeps the token", async () => {
  const devices = new RecordingDeviceSink();
  const fetcher: typeof fetch = async () =>
    jsonResponse({
      data: {
        status: "error",
        message: "Too many messages",
        details: { error: "MessageRateExceeded" },
      },
    });

  const sender = new ExpoPushSender(expoConfig, fetcher, devices);
  await assert.rejects(
    () => sender.send(pushMessage()),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(
        !(error instanceof PermanentSendError),
        "rate limiting is temporary and must be retried",
      );
      return true;
    },
  );
  assert.deepEqual(devices.forgotten, [], "a live device must not be retired");
});

test("ExpoPushSender treats misconfiguration tickets as permanent", async () => {
  for (const code of ["MessageTooBig", "MismatchSenderId", "InvalidCredentials"]) {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        data: { status: "error", message: code, details: { error: code } },
      });
    await assert.rejects(
      () => new ExpoPushSender(expoConfig, fetcher).send(pushMessage()),
      (error: unknown) => {
        assert.ok(
          error instanceof PermanentSendError,
          `${code} must not burn five attempts`,
        );
        return true;
      },
    );
  }
});

// Expo returns `data` as an object for one message and an array for a batch.
test("ExpoPushSender reads a ticket from either the object or the array form", async () => {
  const fetcher: typeof fetch = async () =>
    jsonResponse({ data: [{ status: "ok", id: "ticket-array" }] });
  const result = await new ExpoPushSender(expoConfig, fetcher).send(
    pushMessage(),
  );
  assert.equal(result.providerMessageId, "ticket-array");
});

test("ExpoPushSender honours the isTransient flag on a rejected request", async () => {
  const permanent: typeof fetch = async () =>
    jsonResponse({
      errors: [
        {
          code: "VALIDATION_ERROR",
          message: '"$": Must contain at most 100 element(s).',
          isTransient: false,
        },
      ],
    });
  await assert.rejects(
    () => new ExpoPushSender(expoConfig, permanent).send(pushMessage()),
    (error: unknown) => error instanceof PermanentSendError,
  );

  const transient: typeof fetch = async () =>
    jsonResponse({
      errors: [{ code: "INTERNAL_SERVER_ERROR", isTransient: true }],
    });
  await assert.rejects(
    () => new ExpoPushSender(expoConfig, transient).send(pushMessage()),
    (error: unknown) =>
      error instanceof Error && !(error instanceof PermanentSendError),
  );
});

test("ExpoPushSender retries a server error but not a client error", async () => {
  const serverError: typeof fetch = async () => new Response("boom", { status: 503 });
  await assert.rejects(
    () => new ExpoPushSender(expoConfig, serverError).send(pushMessage()),
    (error: unknown) =>
      error instanceof Error && !(error instanceof PermanentSendError),
  );

  const clientError: typeof fetch = async () => new Response("nope", { status: 400 });
  await assert.rejects(
    () => new ExpoPushSender(expoConfig, clientError).send(pushMessage()),
    (error: unknown) => error instanceof PermanentSendError,
  );
});

// Cleaning up is best-effort; it must not turn a decided verdict into a retry.
test("ExpoPushSender stays permanent when retiring the token fails", async () => {
  const failingSink = {
    async forgetPushToken(): Promise<void> {
      throw new Error("database unavailable");
    },
  };
  const fetcher: typeof fetch = async () =>
    jsonResponse({
      data: { status: "error", details: { error: "DeviceNotRegistered" } },
    });

  await assert.rejects(
    () => new ExpoPushSender(expoConfig, fetcher, failingSink).send(pushMessage()),
    (error: unknown) => error instanceof PermanentSendError,
  );
});

test("ExpoPushSender refuses a message from another channel", async () => {
  const fetcher: typeof fetch = async () => jsonResponse({});
  await assert.rejects(
    () =>
      new ExpoPushSender(expoConfig, fetcher).send(
        pushMessage({ channel: "sms", recipient: "233241234567" }),
      ),
    /cannot send a sms message/,
  );
});

test("renderPushNotification writes a lock-screen title separate from the body", () => {
  assert.deepEqual(renderPushNotification(pushMessage()), {
    title: "New order",
    body: "Ama Boateng · Kente wrap dress · GH₵250.00",
  });

  // A bespoke order has no agreed price yet, so no amount is shown.
  assert.deepEqual(
    renderPushNotification(
      pushMessage({ payload: { customer: "Ama Boateng", amount_minor: 0 } }),
    ),
    { title: "New order", body: "Ama Boateng" },
  );

  // Nothing known at all still has to say something useful.
  assert.deepEqual(renderPushNotification(pushMessage({ payload: {} })), {
    title: "New order",
    body: "You have a new order. Open Xtiitch to see it.",
  });
});

// The point of PermanentSendError: the outbox must not spend an hour of
// exponential backoff on a device that no longer exists.
test("drainOutbox dead-letters a permanent failure on its first attempt", async () => {
  const message = pushMessage({ attempts: 1 });
  let recordedTerminal: boolean | undefined;

  const store: OutboxStore = {
    async claimDueMessages() {
      return [message];
    },
    async markSent() {
      throw new Error("should not be reached");
    },
    async markFailed(_message, _error, _delay, terminal) {
      recordedTerminal = terminal;
      return terminal ? "dead" : "pending";
    },
  };

  const summary: DrainSummary = await drainOutbox({
    store,
    sender: {
      async send(): Promise<NotificationSendResult> {
        throw new PermanentSendError("device is gone");
      },
    },
    batchSize: 10,
    leaseSeconds: 60,
    retryPolicy: { maxAttempts: 5, baseDelayMs: 1_000, maxDelayMs: 10_000 },
  });

  assert.equal(recordedTerminal, true);
  assert.equal(summary.dead, 1);
  assert.equal(summary.failed, 0);
});
