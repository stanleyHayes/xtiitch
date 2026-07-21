import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { fetchWithTimeout } from "./server-fetch";

test("fetchWithTimeout aborts a stalled checkout upstream", async (t) => {
  const server = createServer(() => {
    // Deliberately never respond: the client timeout must release the loader.
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await assert.rejects(
    fetchWithTimeout(`http://127.0.0.1:${address.port}`, {}, 25),
    (error: Error) => error.name === "TimeoutError",
  );
});
