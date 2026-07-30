import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { shrinkImageFile } from "./image-compression";
import { planUploadBatch, shrinkTargetBytes } from "./upload-limits";

const NON_IMAGE_ERROR =
  "Only image files can be uploaded — choose a JPG, PNG, or WebP.";

export type ImageUploadField = {
  // True while picked photos are being resized. Fields should say so: on a
  // mid-range phone a batch of camera photos takes a noticeable moment.
  busy: boolean;
  // What was left out and why, or null when the whole pick was accepted.
  error: string | null;
  // Resizes the pick, drops whatever still cannot fit, writes the survivors
  // back into the file input, and returns them (in pick order) for previews.
  prepare: (picked: File[], maxFiles?: number) => Promise<File[]>;
  clear: () => void;
};

// useImageUploadField owns everything between "the owner picked photos" and
// "the form body is safely under the platform limit".
//
// The catalogue used to hand the raw pick straight to the form: a helper line
// claimed 10 MB per file, nothing enforced it, and the field was multiple, so
// several photos summed into one body. Vercel rejects a body over 4.5 MB before
// the action runs, so the owner got a 413 crash page instead of a form error.
// Resizing at pick time is the only place a fix can live — by the time a request
// is refused, the platform has already discarded it.
export function useImageUploadField(
  inputRef: RefObject<HTMLInputElement | null>,
): ImageUploadField {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Each pick supersedes the one before it, so a slow resize that finishes late
  // cannot write its files over a newer selection.
  const pickID = useRef(0);

  useEffect(() => {
    const form = busy ? inputRef.current?.form : null;
    if (!form) {
      return;
    }
    // The input is emptied for the duration of a resize (see prepare), so a
    // submit landing mid-resize would post a design with no photos at all.
    // React Router's <Form> returns early when the submit event is already
    // defaultPrevented, and so does the browser's native submit, so this one
    // capture-phase listener holds the form shut for both.
    const block = (event: Event) => event.preventDefault();
    form.addEventListener("submit", block, true);
    return () => form.removeEventListener("submit", block, true);
  }, [busy, inputRef]);

  const clear = useCallback(() => {
    pickID.current += 1;
    setBusy(false);
    setError(null);
    const input = inputRef.current;
    if (input) {
      input.value = "";
    }
  }, [inputRef]);

  const prepare = useCallback(
    async (picked: File[], maxFiles?: number): Promise<File[]> => {
      const input = inputRef.current;
      pickID.current += 1;
      const pick = pickID.current;

      const images = picked.filter((file) => file.type.startsWith("image/"));
      const chosen = maxFiles ? images.slice(0, maxFiles) : images;
      const droppedNonImages = images.length < picked.length;
      if (input) {
        // Empty the input up front: the originals are exactly what a premature
        // submit would post, and exactly what blows the platform limit.
        input.value = "";
      }
      if (chosen.length === 0) {
        setBusy(false);
        setError(droppedNonImages ? NON_IMAGE_ERROR : null);
        return [];
      }

      setBusy(true);
      setError(null);

      // Sequential, not Promise.all: decoding several 12 MP photos at once is
      // how a mid-range phone runs out of memory mid-upload.
      const target = shrinkTargetBytes(chosen.length);
      const shrunk: File[] = [];
      for (const file of chosen) {
        shrunk.push(await shrinkImageFile(file, target));
        if (pickID.current !== pick) {
          return [];
        }
      }

      const plan = planUploadBatch(shrunk);
      if (input) {
        applyToInput(input, plan.accepted);
      }
      setError(plan.error ?? (droppedNonImages ? NON_IMAGE_ERROR : null));
      setBusy(false);
      return plan.accepted;
    },
    [inputRef],
  );

  return { busy, error, prepare, clear };
}

// applyToInput replaces the input's selection with the resized files, so the
// form posts what was approved rather than what was picked.
function applyToInput(input: HTMLInputElement, files: File[]): void {
  if (files.length === 0) {
    input.value = "";
    return;
  }
  try {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  } catch {
    // Without DataTransfer there is no way to put resized files back, and
    // re-attaching the originals would restore the crash. Leaving the input
    // empty keeps the form honest; the field's error line explains it.
    input.value = "";
  }
}
