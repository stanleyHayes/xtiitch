import assert from "node:assert/strict";
import { test } from "node:test";
import { storeHandleFromHost } from "./tenant";

test("storeHandleFromHost resolves development and production subdomains", () => {
  assert.equal(storeHandleFromHost("demo-atelier.localhost:3402"), "demo-atelier");
  assert.equal(storeHandleFromHost("nadia.xtiitch.com"), "nadia");
});

test("storeHandleFromHost ignores apex and reserved platform labels", () => {
  assert.equal(storeHandleFromHost(null), null);
  assert.equal(storeHandleFromHost("localhost:3402"), null);
  assert.equal(storeHandleFromHost("xtiitch.com"), null);
  assert.equal(storeHandleFromHost("www.xtiitch.com"), null);
  assert.equal(storeHandleFromHost("admin.xtiitch.com"), null);
  assert.equal(storeHandleFromHost("dashboard.localhost:3402"), null);
});
