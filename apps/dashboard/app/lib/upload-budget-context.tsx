import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { uploadBudgetBytes } from "./upload-limits";

// Shares ONE upload budget across every image field in a single form.
//
// Each field used to call uploadBudgetBytes() on its own, so every field
// believed it had the whole allowance. With one image field per form that was
// harmless — each form is its own request. It stops being harmless the moment a
// form carries several fields at once, which is exactly what adding colour
// variations to the create-design form does: design images plus one field per
// variation, all posted in a single multipart body. Three fields each sizing
// for 4 MB is a 12 MB request, back over the platform's 4.5 MB limit and back
// to the 413 crash page.
//
// Fields register what they are actually holding, and each new pick is sized
// against what the others have left. A form with no provider keeps the old
// behaviour, so existing single-field forms are unaffected.
type BudgetHandle = {
  // Bytes this field may spend right now, given what every other field holds.
  availableFor: (fieldID: string) => number;
  // Called after a pick settles, with the total bytes this field now carries.
  reserve: (fieldID: string, bytes: number) => void;
  release: (fieldID: string) => void;
};

const UploadBudgetContext = createContext<BudgetHandle | null>(null);

export function UploadBudgetProvider({ children }: { children: ReactNode }) {
  // A ref, not state: reserving must not re-render the form mid-pick, and the
  // value is only ever read inside event handlers.
  const held = useRef(new Map<string, number>());

  const availableFor = useCallback((fieldID: string) => {
    const total = uploadBudgetBytes();
    let others = 0;
    held.current.forEach((bytes, id) => {
      if (id !== fieldID) {
        others += bytes;
      }
    });
    // Never negative: if the other fields have already filled the budget this
    // field gets nothing extra, and its own planner will say so.
    return Math.max(total - others, 0);
  }, []);

  const reserve = useCallback((fieldID: string, bytes: number) => {
    held.current.set(fieldID, bytes);
  }, []);

  const release = useCallback((fieldID: string) => {
    held.current.delete(fieldID);
  }, []);

  const handle = useMemo(
    () => ({ availableFor, reserve, release }),
    [availableFor, reserve, release],
  );

  return (
    <UploadBudgetContext.Provider value={handle}>
      {children}
    </UploadBudgetContext.Provider>
  );
}

export function useUploadBudget(): BudgetHandle | null {
  return useContext(UploadBudgetContext);
}
