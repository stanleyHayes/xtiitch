import { useEffect } from "react";
import type { RefObject } from "react";

// Keeps what someone typed when a submit fails.
//
// A shop owner on Ghanaian mobile data filled in a design, hit save, and lost
// the lot. Her upload was too large for the connection, the request died, and a
// failed navigation submit unmounts the route: React Router replaces it with
// the error boundary, and uncontrolled inputs go with it. She had no way back
// to her own words.
//
// Values are mirrored into sessionStorage as she types and restored when the
// form mounts again. sessionStorage, not localStorage: a draft belongs to the
// tab and the visit, and should not outlive them on a shared phone.
//
// Deliberately NOT stored: files and passwords. A File cannot be serialised
// anyway, and writing a password into storage to save someone retyping it is a
// bad trade.
const PREFIX = "xtiitch:draft:";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    // Private mode or blocked storage. Losing the draft is bad; throwing on
    // every keystroke is worse.
    return null;
  }
}

type DraftField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isRestorable(element: Element): element is DraftField {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }
  // A File cannot be serialised, and writing a password into storage to save
  // someone retyping it is a bad trade.
  return element.type !== "file" && element.type !== "password";
}

// useFormDraft mirrors a form's text values under `key`, restoring them on
// mount. Call clearFormDraft(key) once the submit has actually succeeded.
export function useFormDraft(
  formRef: RefObject<HTMLFormElement | null>,
  key: string,
): void {
  useEffect(() => {
    const form = formRef.current;
    const store = storage();
    if (!form || !store) {
      return;
    }

    // Restore first, before any typing, so a re-mount after a failure comes
    // back with her words in place.
    try {
      const saved = store.getItem(PREFIX + key);
      if (saved) {
        const values = JSON.parse(saved) as Record<string, string>;
        Object.entries(values).forEach(([name, value]) => {
          const field = form.elements.namedItem(name);
          // Only fill a field she has not already typed into, so a restore
          // never overwrites fresher input.
          if (field instanceof HTMLElement && isRestorable(field) && !field.value) {
            field.value = value;
          }
        });
      }
    } catch {
      // A malformed draft must never stop the form rendering.
    }

    const save = () => {
      const values: Record<string, string> = {};
      Array.from(form.elements).forEach((element) => {
        if (!isRestorable(element)) {
          return;
        }
        // Checkboxes and radios carry state in `checked`, not `value`;
        // restoring their value would tick the wrong boxes.
        const isToggle =
          element instanceof HTMLInputElement &&
          (element.type === "checkbox" || element.type === "radio");
        if (element.name && element.value && !isToggle) {
          values[element.name] = element.value;
        }
      });
      try {
        store.setItem(PREFIX + key, JSON.stringify(values));
      } catch {
        // Quota or private mode — nothing useful to do per keystroke.
      }
    };

    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [formRef, key]);
}

// clearFormDraft drops a saved draft. Call it when the work is genuinely saved,
// so the next visit starts empty rather than repopulating a design she has
// already published.
export function clearFormDraft(key: string): void {
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do.
  }
}
