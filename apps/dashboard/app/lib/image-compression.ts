// Browser-side image shrinking, run at pick time so an oversized photo never
// becomes an oversized request.
//
// A phone camera photo is routinely 6-12 MB, and the dashboard's upload path is
// browser -> route action -> Cloudinary. The action runs on Vercel, which drops
// any request body over 4.5 MB before the action is reached (413
// FUNCTION_PAYLOAD_TOO_LARGE) — so there is no server-side hook where a
// Cloudinary transformation could rescue the upload. Cloudinary transformations
// only apply to bytes that already arrived. The one place with both the file
// and a chance to act is the browser, so that is where the resize happens:
// decode, draw to a canvas at a smaller edge, re-encode, keep the first result
// under target.
//
// Everything here is browser-only (canvas, createImageBitmap) and must not be
// imported into a loader or action.

// Formats a canvas cannot re-encode without wrecking them: vectors lose their
// scalability, animated GIFs lose every frame but the first. Left untouched and
// judged on size alone by planUploadBatch.
const UNSHRINKABLE_TYPES = new Set(["image/svg+xml", "image/gif"]);

// Tried in order, each strictly smaller than the last, stopping at the first
// result under target. Bounded on purpose: an unbounded search would keep a
// mid-range phone busy for seconds per photo. 2000px on the long edge is more
// than a storefront card or lightbox ever displays.
const ATTEMPTS = [
  { maxEdge: 2000, quality: 0.82 },
  { maxEdge: 2000, quality: 0.65 },
  { maxEdge: 1600, quality: 0.7 },
  { maxEdge: 1280, quality: 0.65 },
  { maxEdge: 1024, quality: 0.6 },
] as const;

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

// shrinkImageFile returns a file at or under targetBytes when it can, and the
// original when it cannot (undecodable format, canvas unavailable, or a photo
// that stays large even at the bottom of the ladder). Callers must still check
// the returned size — this narrows the problem, it does not guarantee a fit.
export async function shrinkImageFile(
  file: File,
  targetBytes: number,
): Promise<File> {
  if (file.size <= targetBytes || UNSHRINKABLE_TYPES.has(file.type)) {
    return file;
  }

  const decoded = await decodeImage(file);
  if (!decoded) {
    return file;
  }

  const type = encodeType();
  try {
    // The smallest blob produced so far. If nothing reaches the target, the
    // caller still gets the best available shot rather than the raw original —
    // a 12 MB photo landing at 4.3 MB is one clear error message away from
    // success instead of a guaranteed crash.
    let best: Blob | null = null;
    for (const attempt of ATTEMPTS) {
      const blob = await encodeAtScale(decoded, attempt.maxEdge, type, attempt.quality);
      if (!blob) {
        break;
      }
      if (!best || blob.size < best.size) {
        best = blob;
      }
      if (blob.size <= targetBytes) {
        break;
      }
    }
    if (!best || best.size >= file.size) {
      return file;
    }
    return new File([best], renameForType(file.name, type), {
      type,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    decoded.release();
  }
}

async function decodeImage(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Formats the bitmap decoder refuses (some HEIC/AVIF builds) may still
      // load through an <img>, so fall through rather than giving up.
    }
  }
  return decodeViaElement(file);
}

function decodeViaElement(file: File): Promise<DecodedImage | null> {
  return new Promise((resolve) => {
    if (typeof Image !== "function" || typeof URL?.createObjectURL !== "function") {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    const done = (value: DecodedImage | null) => {
      if (!value) {
        URL.revokeObjectURL(url);
      }
      resolve(value);
    };
    image.onload = () =>
      done({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    image.onerror = () => done(null);
    image.src = url;
  });
}

async function encodeAtScale(
  decoded: DecodedImage,
  maxEdge: number,
  type: string,
  quality: number,
): Promise<Blob | null> {
  const { width, height } = fitWithin(decoded.width, decoded.height, maxEdge);
  if (width < 1 || height < 1) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  // JPEG has no alpha channel: without this, a transparent PNG re-encodes with
  // black behind it. WebP keeps its alpha, and painting white under an opaque
  // photo changes nothing, so this is unconditional.
  if (type === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(decoded.source, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

let cachedEncodeType: string | null = null;

// WebP is roughly 25-30% smaller than JPEG at matching quality, which is the
// difference between a photo fitting the budget and needing another round of
// the ladder. Support is checked once by asking a canvas what it actually
// produced — browsers that cannot encode WebP silently hand back PNG.
function encodeType(): string {
  if (cachedEncodeType) {
    return cachedEncodeType;
  }
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    cachedEncodeType = probe.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
  } catch {
    cachedEncodeType = "image/jpeg";
  }
  return cachedEncodeType;
}

function renameForType(name: string, type: string): string {
  const extension = type === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "image"}.${extension}`;
}
