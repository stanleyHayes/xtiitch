import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { shrinkImageFile } from "./image-compression";
import { useUploadBudget } from "./upload-budget-context";
import {
  planUploadBatch,
  shrinkTargetBytes,
  uploadBudgetBytes,
} from "./upload-limits";

const NON_IMAGE_ERROR =
  "Only image files can be uploaded — choose a JPG, PNG, or WebP.";

export type PrepareOptions = {
  // The most files the field may hold IN TOTAL, counting what is already
  // selected — not the size of one pick.
  maxFiles?: number;
  // Add to the current selection instead of replacing it. Off for single-image
  // fields, where a second pick can only mean "use this one instead".
  append?: boolean;
};

export type ImageUploadField = {
  // True while picked photos are being resized. Fields should say so: on a
  // mid-range phone a batch of camera photos takes a noticeable moment.
  busy: boolean;
  // What was left out and why, or null when the whole pick was accepted.
  error: string | null;
  // Everything currently selected, resized and within budget, in pick order.
  // This is what the form will post, so previews built from it show the actual
  // bytes that will be uploaded.
  files: File[];
  // Resizes the pick, drops whatever still cannot fit, writes the survivors
  // back into the file input, and returns the full selection for previews.
  prepare: (picked: File[], options?: PrepareOptions) => Promise<File[]>;
  // Drops one file from the selection before the form is submitted.
  remove: (index: number) => void;
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
  // The selection, mirrored in a ref. Renders read the state; prepare and
  // remove read the ref, because a pick that resolves after another render
  // would otherwise append to a stale list and silently drop a photo.
  const [files, setFiles] = useState<File[]>([]);
  const filesRef = useRef<File[]>([]);
  // Each pick supersedes the one before it, so a slow resize that finishes late
  // cannot write its files over a newer selection.
  const pickID = useRef(0);
  // Identifies this field to the shared budget. useId is stable across renders
  // and unique per instance, which is exactly the key the allocator needs.
  const fieldID = useId();
  const sharedBudget = useUploadBudget();

  // A field that unmounts (a variation removed from the form) must hand its
  // share back, or the remaining fields stay squeezed by bytes nobody holds.
  useEffect(
    () => () => sharedBudget?.release(fieldID),
    [sharedBudget, fieldID],
  );

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

  // commit is the single place the selection changes: it writes the files back
  // into the input, mirrors them for rendering, and tells the shared budget what
  // this field now holds. Routing every change through here is what keeps the
  // input, the previews and the budget from drifting apart.
  const commit = useCallback(
    (next: File[]) => {
      filesRef.current = next;
      setFiles(next);
      const input = inputRef.current;
      if (input) {
        applyToInput(input, next);
      }
      sharedBudget?.reserve(
        fieldID,
        next.reduce((sum, file) => sum + file.size, 0),
      );
    },
    [inputRef, sharedBudget, fieldID],
  );

  const clear = useCallback(() => {
    pickID.current += 1;
    setBusy(false);
    setError(null);
    commit([]);
  }, [commit]);

  // remove drops one photo before the form is submitted. Errors clear with it:
  // a "left out, too large in total" message describes a selection that no
  // longer exists, and removing something is the obvious way to act on it.
  const remove = useCallback(
    (index: number) => {
      const next = filesRef.current.filter((_, position) => position !== index);
      if (next.length === filesRef.current.length) {
        return;
      }
      setError(null);
      commit(next);
    },
    [commit],
  );

  const prepare = useCallback(
    async (picked: File[], options: PrepareOptions = {}): Promise<File[]> => {
      const { maxFiles, append = true } = options;
      const input = inputRef.current;
      pickID.current += 1;
      const pick = pickID.current;

      // What survives this pick. Appending starts from the current selection;
      // replacing starts empty. The kept files were already resized by an
      // earlier pick and are deliberately NOT put through the compressor again
      // — re-encoding a photo on every subsequent add would degrade it a little
      // each time, so the fifth photo you add would quietly ruin the first.
      const kept = append ? filesRef.current : [];

      const images = picked.filter((file) => file.type.startsWith("image/"));
      // maxFiles counts the WHOLE field, not this pick, so an append cannot
      // walk past a plan's image limit one pick at a time.
      const room =
        maxFiles === undefined
          ? undefined
          : Math.max(maxFiles - kept.length, 0);
      const chosen = room === undefined ? images : images.slice(0, room);
      const droppedNonImages = images.length < picked.length;
      if (input) {
        // Empty the input up front: the originals are exactly what a premature
        // submit would post, and exactly what blows the platform limit.
        input.value = "";
      }
      if (chosen.length === 0) {
        setBusy(false);
        setError(droppedNonImages ? NON_IMAGE_ERROR : null);
        // Put the existing selection back. The input was emptied above, and a
        // pick of nothing usable must not silently discard the photos already
        // chosen.
        commit(kept);
        return kept;
      }

      setBusy(true);
      setError(null);

      // Sized against the CONNECTION, not just the platform ceiling. A shop
      // owner on 3G uploads at ~45 KB/s, where a 4 MB body is 90 seconds of
      // transfer that her network will drop long before it finishes. Read at
      // pick time so it reflects the link she is on right now.
      //
      // Inside an UploadBudgetProvider the allowance is shared with the other
      // image fields in the same form, so several fields posting in one body
      // cannot each claim the full budget and sum past the platform limit.
      const budget = sharedBudget
        ? sharedBudget.availableFor(fieldID)
        : uploadBudgetBytes();

      // Sequential, not Promise.all: decoding several 12 MP photos at once is
      // how a mid-range phone runs out of memory mid-upload.
      //
      // The shrink target is sized for the WHOLE field — the photos already
      // held plus the ones arriving — so adding to a nearly-full selection
      // compresses harder rather than producing files that cannot fit.
      const target = shrinkTargetBytes(kept.length + chosen.length, budget);
      const shrunk: File[] = [];
      for (const file of chosen) {
        shrunk.push(await shrinkImageFile(file, target));
        if (pickID.current !== pick) {
          // Superseded by a newer pick, which owns the selection now.
          return filesRef.current;
        }
      }

      // Planned over the combined set, never the new files alone: the budget is
      // what the whole request may weigh, and two picks of 3 MB each are the
      // 413 this compressor exists to prevent. Kept files come first, so when
      // the budget runs out it is the new arrivals that are refused rather than
      // photos already chosen being silently dropped.
      const plan = planUploadBatch([...kept, ...shrunk], budget);
      commit(plan.accepted);
      setError(plan.error ?? (droppedNonImages ? NON_IMAGE_ERROR : null));
      setBusy(false);
      return plan.accepted;
    },
    [inputRef, sharedBudget, fieldID, commit],
  );

  return { busy, error, files, prepare, remove, clear };
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
