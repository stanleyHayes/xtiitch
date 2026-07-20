import assert from "node:assert/strict";
import test from "node:test";

import { InternalApiClient, runInternalSweep } from "./internal";

const config = {
  apiUrl: "http://api.test",
  token: "shared-secret",
  timeoutMs: 1_000,
};

type RecordedCall = { url: string; token: string | undefined; method: string };

function recorder(
  responses: (Response | Error)[],
): { fetcher: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetcher = (async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      token: (init?.headers as Record<string, string> | undefined)?.[
        "X-Internal-Token"
      ],
    });
    const next = responses[calls.length - 1];
    if (next instanceof Error) {
      throw next;
    }
    if (!next) {
      throw new Error("no stubbed response left");
    }
    return next.clone();
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("post fires the internal endpoint with the shared token header", async () => {
  const { fetcher, calls } = recorder([
    jsonResponse(200, { charges_paid: 2 }),
  ]);
  const client = new InternalApiClient(config, fetcher);

  const result = await runInternalSweep({
    client,
    path: "/sweeps/recurring-charges",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { charges_paid: 2 });
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(
    call.url,
    "http://api.test/v1/internal/sweeps/recurring-charges",
  );
  assert.equal(call.method, "POST");
  assert.equal(call.token, "shared-secret");
});

test("post retries a transient failure once, then succeeds", async () => {
  const { fetcher, calls } = recorder([
    jsonResponse(500, { error: "internal_error" }),
    jsonResponse(200, { reminders_enqueued: 1 }),
  ]);
  const client = new InternalApiClient(config, fetcher);

  const result = await client.post("/sweeps/renewal-reminders");

  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
});

test("post retries a network error once, then gives up without throwing", async () => {
  const { fetcher, calls } = recorder([
    new Error("connection refused"),
    new Error("connection refused"),
  ]);
  const client = new InternalApiClient(config, fetcher);

  const result = await client.post("/settlements/sync");

  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /connection refused/);
  assert.equal(calls.length, 2);
});

test("post does not retry a 4xx — a bad token cannot be fixed by retrying", async () => {
  const { fetcher, calls } = recorder([
    jsonResponse(401, { error: "invalid_token" }),
    jsonResponse(200, {}),
  ]);
  const client = new InternalApiClient(config, fetcher);

  const result = await client.post("/reports/run-scheduled");

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(calls.length, 1);
});
