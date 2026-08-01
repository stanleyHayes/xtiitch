// Upload size ceilings for every image that rides a multipart form through a
// route action (Ghana Card photos, storefront logo/banner, design images).
//
// The dashboard deploys to Vercel, which rejects a request body over 4.5 MB
// BEFORE the action runs and answers 413 FUNCTION_PAYLOAD_TOO_LARGE — a crash
// page, not a form error. Cloudinary's own ceiling (10-20 MB depending on the
// plan) never comes into play: a design image travels browser -> action ->
// Cloudinary, so Vercel's limit is the binding one and it is the smaller one.
// Cloudinary transformations run AFTER an upload lands, so they cannot shrink
// the inbound body either — the shrinking has to happen in the browser, which
// is what image-compression.ts does before these ceilings are applied.
//
// MAX_UPLOAD_BUDGET_BYTES is the CEILING — the most one form submission may
// carry in total, sized to clear Vercel's 4.5 MB with headroom for text fields
// and multipart boundaries.
//
// It is NOT the target. Fitting the platform limit was only half the problem:
// a shop owner on Ghanaian mobile data uploads at roughly 45 KB/s, so a 4 MB
// body is about 90 SECONDS of continuous upload. Mobile networks drop requests
// that long — reliably so during a voice call, when many carriers suspend or
// throttle data — and the dropped request surfaces as "Connection problem",
// losing everything she typed. Sizing uploads against the platform's ceiling
// while ignoring the customer's bandwidth is what produced that.
//
// uploadBudgetBytes() below picks the real budget from the live connection.
export const MAX_UPLOAD_BUDGET_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BUDGET_MB = 4;

// How long an upload may reasonably take before a phone network gives up on it.
// Well under typical mobile idle timeouts, and short enough that the owner does
// not conclude the app has frozen.
const TARGET_UPLOAD_SECONDS = 12;

// Used when the browser will not tell us the link speed (Safari and Firefox do
// not implement the Network Information API). Deliberately conservative: a
// too-small image is a slightly softer photo, a too-large one is a lost form.
// Set to the 3G figure below, because assuming a good link is the failure mode
// that costs a shop owner her work.
const ASSUMED_SLOW_LINK_KBPS = 45;

// Never shrink below this regardless of how bad the connection is — past here
// the photo stops being worth uploading at all.
const FLOOR_BUDGET_BYTES = 320 * 1024;

type NetworkInformation = {
  downlink?: number; // megabits per second
  effectiveType?: string; // 'slow-2g' | '2g' | '3g' | '4g'
  saveData?: boolean;
};

function connection(): NetworkInformation | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }
  return (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
}

// uploadBudgetBytes returns what this device can actually push in
// TARGET_UPLOAD_SECONDS, capped by the platform ceiling. On a fast link it
// returns the full budget and nothing changes; on 3G it returns a few hundred
// KB, which is the difference between a save that lands and one that dies.
export function uploadBudgetBytes(): number {
  const link = connection();

  // Explicit user request to minimise data — honour it over any measurement.
  if (link?.saveData) {
    return FLOOR_BUDGET_BYTES;
  }

  // downlink is megabits/sec. Convert to bytes/sec (÷8, ×1000·1000/1024 ≈ 125
  // KB per Mbit) and spend TARGET_UPLOAD_SECONDS of it. Real upload capacity is
  // usually below downlink, so halve it rather than trusting the number.
  const downlinkMbps = link?.downlink;
  const effectiveKbps =
    typeof downlinkMbps === "number" && downlinkMbps > 0
      ? (downlinkMbps * 125 * 1024) / 2 / 1024
      : effectiveTypeKbps(link?.effectiveType);

  const affordable = Math.floor(effectiveKbps * 1024 * TARGET_UPLOAD_SECONDS);
  return Math.min(
    MAX_UPLOAD_BUDGET_BYTES,
    Math.max(FLOOR_BUDGET_BYTES, affordable),
  );
}

// Kilobytes per second per connection class. These are calibrated to a REAL
// measurement, not to the spec's optimistic bands: a shop owner in Accra on a
// 3G connection was observed at 45.5 KB/s. An earlier version of this used 90
// for 3G — a guess — which produced a 1 MB budget, still 24 seconds of upload
// on her phone. Assume the network people actually have.
function effectiveTypeKbps(effectiveType: string | undefined): number {
  switch (effectiveType) {
    case "slow-2g":
      return 10;
    case "2g":
      return 20;
    case "3g":
      return 45; // measured, not assumed
    case "4g":
      return 600;
    default:
      return ASSUMED_SLOW_LINK_KBPS;
  }
}

// A form with two independent image inputs (Ghana Card front/back, storefront
// logo/banner) has no shared planner to split the budget between them, so each
// side is capped at half. Quote both numbers in those labels — "2 MB each, 4 MB
// per upload" — so the ceiling is never a surprise.
export const MAX_PAIRED_IMAGE_BYTES = MAX_UPLOAD_BUDGET_BYTES / 2;
export const MAX_PAIRED_IMAGE_MB = MAX_UPLOAD_BUDGET_MB / 2;

// Shrinking below this is pointless: a storefront photo squeezed under 250 KB
// looks worse than a rejection with an explanation.
const MIN_SHRINK_TARGET_BYTES = 250 * 1024;

export function isPairedImageAllowed(file: File): boolean {
  return file.size <= MAX_PAIRED_IMAGE_BYTES;
}

// shrinkTargetBytes splits the budget across the images picked together. Two
// constraints apply at once: the batch must fit the platform ceiling (a per-file
// cap alone never stopped a multi-image form summing past it — the hole that
// caused the 413), AND it must finish uploading on the connection in front of
// us, which is what `budget` carries in.
//
// `budget` is injected rather than read here so the pure sizing logic stays
// testable without a browser.
export function shrinkTargetBytes(
  count: number,
  budget: number = MAX_UPLOAD_BUDGET_BYTES,
): number {
  const usable = Math.min(budget, MAX_UPLOAD_BUDGET_BYTES);
  if (count <= 1) {
    return Math.max(usable, MIN_SHRINK_TARGET_BYTES);
  }
  const share = Math.floor(usable / count);
  return Math.max(Math.min(share, usable), MIN_SHRINK_TARGET_BYTES);
}

type SizedFile = { name: string; size: number };

export type UploadBatchPlan<T extends SizedFile> = {
  // The files that fit, in pick order. Whatever is left out never reaches the
  // form body, so the request cannot exceed the platform limit.
  accepted: T[];
  // User-facing reason anything was left out; null when everything fit.
  error: string | null;
};

// planUploadBatch is the last gate before files are written back into a file
// input. It runs on already-shrunk files: anything still over the budget could
// not be compressed (an unrasterisable format, or a photo so large the quality
// ladder bottomed out), and anything past the running total belongs in a second
// upload.
export function planUploadBatch<T extends SizedFile>(
  files: readonly T[],
  // The bytes this field may actually spend. Defaults to the platform ceiling
  // for a form with a single image field; inside a shared budget it is this
  // field's remaining share, so two fields in one body cannot each accept a
  // full allowance and sum past the limit.
  cap: number = MAX_UPLOAD_BUDGET_BYTES,
): UploadBatchPlan<T> {
  const limit = Math.min(cap, MAX_UPLOAD_BUDGET_BYTES);
  const accepted: T[] = [];
  const oversized: string[] = [];
  const overflowed: string[] = [];
  let total = 0;

  for (const file of files) {
    if (file.size > limit) {
      oversized.push(file.name);
      continue;
    }
    if (total + file.size > limit) {
      overflowed.push(file.name);
      continue;
    }
    accepted.push(file);
    total += file.size;
  }

  return { accepted, error: batchError(oversized, overflowed) };
}

function batchError(oversized: string[], overflowed: string[]): string | null {
  const parts: string[] = [];
  if (oversized.length === 1) {
    parts.push(
      `"${oversized[0]}" is still over the ${MAX_UPLOAD_BUDGET_MB} MB upload limit after optimising — export a smaller copy and try again.`,
    );
  } else if (oversized.length > 1) {
    parts.push(
      `${oversized.length} images are still over the ${MAX_UPLOAD_BUDGET_MB} MB upload limit after optimising — export smaller copies and try again.`,
    );
  }
  if (overflowed.length > 0) {
    parts.push(
      `${overflowed.length} ${overflowed.length === 1 ? "image was" : "images were"} left out: one upload can carry ${MAX_UPLOAD_BUDGET_MB} MB in total. Add the rest in a second upload.`,
    );
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
