import { useEffect, useState } from "react";
import { useActionData } from "react-router";
import { adminActionSucceeded } from "../../lib/actionFeedback";
import type { AdminActionFeedback } from "./types";
import type { Section } from "./types/navigation";

// §1.2 / §11.4 auto-reset convention: once an action completes successfully the
// interface resets itself — dialogs close immediately, and inline forms clear
// their fields so the operator can enter fresh data without wiping anything by
// hand. Every admin form posts to the single /admin route action, so
// useActionData() reaches the feedback from any component in the tree without
// threading actionData through props.
//
// The return value is the feedback OBJECT (not a boolean) on purpose: React
// Router hands back a new object for every submission, so a useEffect keyed on
// it re-fires on each successful submit even when two successes are identical
// in content. `useActionSuccess("subscriptions")` + useEffect therefore closes
// a dialog on the first success AND on the tenth.
export function useActionSuccess(
  section: Section,
): AdminActionFeedback | undefined {
  const actionData = useActionData() as AdminActionFeedback | undefined;
  return adminActionSucceeded(actionData, section) ? actionData : undefined;
}

// Reset key for inline (non-dialog) forms. Most admin inputs are uncontrolled
// (defaultValue), so the only reliable way to clear them after a successful
// submit is to re-mount the <Form>: bump the returned number into the form's
// `key` and React discards the stale field state, re-seeding defaults from the
// revalidated loader data — which is exactly the "clear fields and refresh
// state" rule. Errors do not bump the key, so a failed submit keeps its input.
export function useFormResetKey(section: Section): number {
  const success = useActionSuccess(section);
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (success) {
      setResetKey((current) => current + 1);
    }
  }, [success]);
  return resetKey;
}
