import assert from "node:assert/strict";
import test from "node:test";

import {
  drainOutbox,
  errorMessage,
  retryDelayMs,
  type NotificationSender,
  type OutboundMessage,
  type OutboxStore,
} from "./outbox";

const retryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 5_000,
};

test("drainOutbox marks successful sends as sent", async () => {
  const message = makeMessage({ attempts: 1 });
  const store = new MemoryOutboxStore([message]);
  const sender: NotificationSender = {
    async send(sentMessage) {
      assert.equal(sentMessage.messageId, message.messageId);
    },
  };

  const summary = await drainOutbox({
    store,
    sender,
    batchSize: 10,
    leaseSeconds: 300,
    retryPolicy,
  });

  assert.deepEqual(summary, { claimed: 1, sent: 1, failed: 0, dead: 0 });
  assert.deepEqual(store.sentMessageIds, [message.messageId]);
  assert.equal(store.failures.length, 0);
});

test("drainOutbox returns failed messages to pending with backoff", async () => {
  const message = makeMessage({ attempts: 2 });
  const store = new MemoryOutboxStore([message]);
  const sender = failingSender("provider unavailable");

  const summary = await drainOutbox({
    store,
    sender,
    batchSize: 10,
    leaseSeconds: 300,
    retryPolicy,
  });

  assert.deepEqual(summary, { claimed: 1, sent: 0, failed: 1, dead: 0 });
  assert.deepEqual(store.failures, [
    {
      messageId: message.messageId,
      error: "provider unavailable",
      retryDelayMs: 2_000,
      terminal: false,
    },
  ]);
});

test("drainOutbox marks exhausted messages dead", async () => {
  const message = makeMessage({ attempts: 3 });
  const store = new MemoryOutboxStore([message]);

  const summary = await drainOutbox({
    store,
    sender: failingSender("bad recipient"),
    batchSize: 10,
    leaseSeconds: 300,
    retryPolicy,
  });

  assert.deepEqual(summary, { claimed: 1, sent: 0, failed: 0, dead: 1 });
  assert.equal(store.failures[0]?.terminal, true);
  assert.equal(store.failures[0]?.retryDelayMs, 0);
});

test("retryDelayMs backs off exponentially and caps", () => {
  assert.equal(retryDelayMs(1, retryPolicy), 1_000);
  assert.equal(retryDelayMs(2, retryPolicy), 2_000);
  assert.equal(retryDelayMs(4, retryPolicy), 5_000);
});

test("errorMessage handles non-error throws", () => {
  assert.equal(errorMessage("plain failure"), "plain failure");
  assert.equal(errorMessage({ code: "E_SEND" }), "unknown notification send failure");
});

class MemoryOutboxStore implements OutboxStore {
  readonly sentMessageIds: string[] = [];
  readonly failures: {
    messageId: string;
    error: string;
    retryDelayMs: number;
    terminal: boolean;
  }[] = [];

  constructor(private readonly messages: OutboundMessage[]) {}

  async claimDueMessages(batchSize: number, _leaseSeconds: number): Promise<OutboundMessage[]> {
    return this.messages.splice(0, batchSize);
  }

  async markSent(messageId: string): Promise<void> {
    this.sentMessageIds.push(messageId);
  }

  async markFailed(
    message: OutboundMessage,
    error: string,
    retryDelayMsValue: number,
    terminal: boolean,
  ): Promise<"dead" | "pending"> {
    this.failures.push({
      messageId: message.messageId,
      error,
      retryDelayMs: retryDelayMsValue,
      terminal,
    });
    return terminal ? "dead" : "pending";
  }
}

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

function failingSender(message: string): NotificationSender {
  return {
    async send() {
      throw new Error(message);
    },
  };
}
