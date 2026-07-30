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
// MAX_UPLOAD_BUDGET_BYTES is the number every label quotes: the most one form
// submission may carry in total. It sits below Vercel's 4.5 MB with headroom
// for the text fields and multipart boundaries riding alongside the images.
export const MAX_UPLOAD_BUDGET_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BUDGET_MB = 4;

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

// shrinkTargetBytes splits the upload budget across the images picked together.
// Five photos aim at ~800 KB each rather than 4 MB each, because a per-file cap
// alone does not stop a multi-image form from summing its way past the platform
// limit — the exact hole that let the catalogue upload 413.
export function shrinkTargetBytes(count: number): number {
  if (count <= 1) {
    return MAX_UPLOAD_BUDGET_BYTES;
  }
  const share = Math.floor(MAX_UPLOAD_BUDGET_BYTES / count);
  return Math.max(
    Math.min(share, MAX_UPLOAD_BUDGET_BYTES),
    MIN_SHRINK_TARGET_BYTES,
  );
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
): UploadBatchPlan<T> {
  const accepted: T[] = [];
  const oversized: string[] = [];
  const overflowed: string[] = [];
  let total = 0;

  for (const file of files) {
    if (file.size > MAX_UPLOAD_BUDGET_BYTES) {
      oversized.push(file.name);
      continue;
    }
    if (total + file.size > MAX_UPLOAD_BUDGET_BYTES) {
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
