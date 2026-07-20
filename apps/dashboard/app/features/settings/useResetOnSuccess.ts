import { useNavigation } from "react-router";
import { useEffect } from "react";
import { useRef } from "react";

// §1.2 for INLINE forms: once a submit succeeds, the interface resets itself
// so the user can enter new data without manually clearing anything. This is
// useCloseOnSuccess's sibling for forms that stay on the page (dialogs already
// reset by unmounting when they close). The reset callback clears controlled
// state; bump a form `key` inside it to also drop uncontrolled field values.
//
// Like useCloseOnSuccess it watches the SUBMISSION, not the success message:
// the same message text repeats on every save, so keying on it would fire once
// and never again.
export function useResetOnSuccess(
  reset: () => void,
  intent: string | string[],
  errorPresent: boolean,
) {
  const navigation = useNavigation();
  const submittedRef = useRef(false);
  const intentKey = Array.isArray(intent) ? intent.join("|") : intent;
  useEffect(() => {
    const intents = intentKey.split("|");
    const submitted = navigation.formData?.get("intent");
    if (
      navigation.state === "submitting" &&
      typeof submitted === "string" &&
      intents.includes(submitted)
    ) {
      submittedRef.current = true;
    } else if (navigation.state === "idle" && submittedRef.current) {
      submittedRef.current = false;
      if (!errorPresent) {
        reset();
      }
    }
  }, [navigation.state, navigation.formData, intentKey, errorPresent, reset]);
}
