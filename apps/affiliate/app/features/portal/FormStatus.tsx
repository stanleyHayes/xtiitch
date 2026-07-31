import type { PortalActionResult } from "./types";

// Shows a result only for the form that produced it. The portal posts every
// card to one route action, so without matching on intent a single "Saved"
// banner appears under all of them at once.
export function FormStatus({
  intent,
  result
}: {
  intent: string;
  result?: PortalActionResult;
}) {
  if (!result || result.intent !== intent) {
    return null;
  }
  if (result.error) {
    return (
      <p className="form-error" role="alert">
        {result.error}
      </p>
    );
  }
  if (result.success) {
    // role="status" rather than "alert": a success is worth announcing but
    // should not interrupt what a screen reader is already saying.
    return (
      <p className="form-success" role="status">
        {result.success}
      </p>
    );
  }
  return null;
}
