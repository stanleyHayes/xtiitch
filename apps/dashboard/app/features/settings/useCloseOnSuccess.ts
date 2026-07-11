import { useNavigation } from "react-router";
import { useEffect } from "react";
import { useRef } from "react";

export function useCloseOnSuccess(
  setOpen: (open: boolean) => void,
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
        setOpen(false);
      }
    }
  }, [navigation.state, navigation.formData, intentKey, errorPresent, setOpen]);
}