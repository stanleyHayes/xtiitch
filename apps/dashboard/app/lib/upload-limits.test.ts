import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PAIRED_IMAGE_BYTES,
  MAX_UPLOAD_BUDGET_BYTES,
  planUploadBatch,
  shrinkTargetBytes,
} from "./upload-limits";

const MB = 1024 * 1024;

// Vercel refuses a request body over 4.5 MB before the action runs, answering
// 413 FUNCTION_PAYLOAD_TOO_LARGE. Every ceiling here has to leave room for the
// text fields and multipart boundaries that ride alongside the images.
test("the upload budget stays under the platform's 4.5 MB body limit", () => {
  assert.ok(MAX_UPLOAD_BUDGET_BYTES < 4.5 * MB);
  // Both sides of a two-image form must fit together, since neither input can
  // see the other's size.
  assert.ok(MAX_PAIRED_IMAGE_BYTES * 2 <= MAX_UPLOAD_BUDGET_BYTES);
});

// The bug this guards: uploads were sized only against Vercel's 4.5 MB payload
// ceiling. On Ghanaian mobile data (~45 KB/s measured on a real shop owner's
// phone) a 4 MB body is ~90 seconds of transfer, which the network drops —
// surfacing as "Connection problem" and losing everything she had typed.
test("a slow connection gets a budget it can actually upload in time", () => {
  const KBPS = 45;
  const SECONDS = 20; // beyond this, mobile networks start dropping the request

  // 3G-class budget must transfer well inside the window.
  const slow = shrinkTargetBytes(2, 400 * 1024);
  assert.ok(
    (slow * 2) / 1024 / KBPS < SECONDS,
    `two images at ${slow} bytes take ${((slow * 2) / 1024 / KBPS).toFixed(0)}s`,
  );

  // The old behaviour — spending the full ceiling regardless of link — is
  // exactly what must NOT come back.
  const ceiling = MAX_UPLOAD_BUDGET_BYTES;
  assert.ok(
    ceiling / 1024 / KBPS > 60,
    "sanity: the platform ceiling really is too big for a slow link",
  );
});

test("a small budget never inflates back up to the ceiling", () => {
  for (const budget of [320 * 1024, 512 * 1024, 1024 * 1024]) {
    for (const count of [1, 2, 3, 5]) {
      const target = shrinkTargetBytes(count, budget);
      assert.ok(
        target <= Math.max(budget, 250 * 1024),
        `count=${count} budget=${budget} produced ${target}`,
      );
    }
  }
});

test("a fast connection is unchanged — no regression for good links", () => {
  assert.equal(shrinkTargetBytes(1), MAX_UPLOAD_BUDGET_BYTES);
  assert.equal(shrinkTargetBytes(4), Math.floor(MAX_UPLOAD_BUDGET_BYTES / 4));
});

test("a lone image may use the whole budget; a batch splits it", () => {
  assert.equal(shrinkTargetBytes(1), MAX_UPLOAD_BUDGET_BYTES);
  assert.equal(shrinkTargetBytes(4), Math.floor(MAX_UPLOAD_BUDGET_BYTES / 4));
  // Five photos aiming at the per-file cap each would be 20 MB of body — the
  // bug this split exists to prevent.
  assert.ok(shrinkTargetBytes(5) * 5 <= MAX_UPLOAD_BUDGET_BYTES);
});

test("a batch that already fits is accepted whole", () => {
  const files = [
    { name: "a.webp", size: MB },
    { name: "b.webp", size: MB },
    { name: "c.webp", size: 1.5 * MB },
  ];
  const plan = planUploadBatch(files);
  assert.deepEqual(
    plan.accepted.map((file) => file.name),
    ["a.webp", "b.webp", "c.webp"],
  );
  assert.equal(plan.error, null);
});

test("images that survive resizing over the cap are refused, not sent", () => {
  const plan = planUploadBatch([{ name: "huge.png", size: 9 * MB }]);
  assert.deepEqual(plan.accepted, []);
  assert.match(String(plan.error), /huge\.png/);
  assert.match(String(plan.error), /4 MB/);
});

test("individually-fitting images cannot sum past the budget", () => {
  // The catalogue's field is multiple, so this is exactly the shape that 413'd:
  // every file under the per-file cap, the total far over it.
  const files = [
    { name: "1.webp", size: 1.8 * MB },
    { name: "2.webp", size: 1.8 * MB },
    { name: "3.webp", size: 1.8 * MB },
  ];
  const plan = planUploadBatch(files);
  const total = plan.accepted.reduce((sum, file) => sum + file.size, 0);
  assert.ok(total <= MAX_UPLOAD_BUDGET_BYTES);
  assert.deepEqual(
    plan.accepted.map((file) => file.name),
    ["1.webp", "2.webp"],
  );
  assert.match(String(plan.error), /left out/);
});

test("accepted files never exceed the budget for any batch", () => {
  const sizes = [0.2, 3.9, 0.5, 4.2, 1.1, 2.6, 0.9];
  const plan = planUploadBatch(
    sizes.map((mb, index) => ({ name: `${index}.jpg`, size: mb * MB })),
  );
  const total = plan.accepted.reduce((sum, file) => sum + file.size, 0);
  assert.ok(total <= MAX_UPLOAD_BUDGET_BYTES, `total ${total} over budget`);
});
