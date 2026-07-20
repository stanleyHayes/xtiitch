// Pure predicate behind the §1.2/§11.4 auto-reset convention: an action only
// counts as a success for a section when BOTH the section tag and the success
// severity match. The section guard matters because every admin form posts to
// the single /admin action — a success from the settings form must not reset
// an open subscriptions dialog, and an error severity must never clear
// anything (the operator keeps their input to fix and retry).
//
// Kept in lib (not features/shared) so the node:test suite can cover it
// without pulling React / react-router into the test process. The shape is
// structural rather than importing AdminActionFeedback because lib sits below
// features/shared in the dependency order (features/shared re-exports lib/api).
export type AdminActionFeedbackLike =
  | {
      section?: string;
      severity?: string;
    }
  | null
  | undefined;

export function adminActionSucceeded(
  feedback: AdminActionFeedbackLike,
  section: string,
): boolean {
  return feedback?.section === section && feedback?.severity === "success";
}
