import { useEffect, useReducer, useRef } from "react";
import {
  OTP_CODE_LENGTH,
  initialPhoneVerification,
  otpRequestErrorMessage,
  otpVerifyErrorMessage,
  phoneVerificationReducer,
  readProxyErrorCode,
} from "../../../lib/phone-verification";

// Drives the §8 phone-verification state machine for the sign-up account
// step. RegisterForm keeps the raw field values; this hook owns the reducer,
// the "Verify phone number" / "Resend code" send (via the same-origin
// business-otp proxy), and the auto-verify effect that calls the
// business-otp-verify proxy the moment the 6th digit lands (§8.3). Both
// proxies are resource routes because the Go API base is not reachable from
// the browser.
export function usePhoneVerification(
  ownerPhone: string,
  phoneOk: boolean,
  setOwnerPhone: (value: string) => void,
) {
  const [verification, dispatchVerification] = useReducer(
    phoneVerificationReducer,
    initialPhoneVerification,
  );

  // §8.2: a successful send freezes the other fields and pops the code field
  // up under the button; the same path serves "Resend code" (the proxy passes
  // resend_too_soon through so a hasty resend shows why nothing arrived).
  const sendPhoneCode = () => {
    if (!phoneOk || verification.sending) {
      return;
    }
    dispatchVerification({ type: "request_started" });
    fetch("/business-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "register",
        // The OTP endpoint just SMSes whatever Ghana number it is given; the
        // field name is historical.
        whatsapp_number: ownerPhone.trim(),
      }),
    })
      .then(async (response) => {
        if (response.ok) {
          dispatchVerification({ type: "request_succeeded" });
          return;
        }
        dispatchVerification({
          type: "request_failed",
          message: otpRequestErrorMessage(await readProxyErrorCode(response)),
        });
      })
      .catch(() =>
        dispatchVerification({
          type: "request_failed",
          message: otpRequestErrorMessage(""),
        }),
      );
  };

  // Any phone edit routes through the reducer: mid-attempt it abandons the
  // sent code (unfreezing), post-verification it resets to re-verify (§8).
  const handleOwnerPhoneChange = (value: string) => {
    setOwnerPhone(value);
    dispatchVerification({ type: "phone_changed", phone: value });
  };

  // The explicit "Change number" affordance next to the ✓ chip — the phone
  // itself is read-only once verified.
  const changePhone = () =>
    dispatchVerification({ type: "phone_changed", phone: ownerPhone });

  const handleCodeChange = (value: string) =>
    dispatchVerification({ type: "code_changed", code: value });

  // §8.3: the 6th digit fires the verify call automatically. The token
  // invalidates responses from superseded attempts, and the reducer's own
  // stale guards catch anything that still slips through.
  const verifyTokenRef = useRef(0);
  useEffect(() => {
    if (
      verification.status !== "awaiting_code" ||
      verification.code.length !== OTP_CODE_LENGTH
    ) {
      return;
    }
    const token = ++verifyTokenRef.current;
    const code = verification.code;
    dispatchVerification({ type: "verify_started" });
    fetch("/business-otp-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: ownerPhone.trim(), code }),
    })
      .then(async (response) => {
        if (token !== verifyTokenRef.current) {
          return;
        }
        if (response.ok) {
          dispatchVerification({ type: "verify_succeeded" });
          return;
        }
        // invalid_code / code_expired / too_many_attempts / invalid_phone /
        // whatsapp_unavailable — mapped to inline copy under the code field.
        dispatchVerification({
          type: "verify_failed",
          message: otpVerifyErrorMessage(await readProxyErrorCode(response)),
        });
      })
      .catch(() => {
        if (token !== verifyTokenRef.current) {
          return;
        }
        dispatchVerification({
          type: "verify_failed",
          message: otpVerifyErrorMessage(""),
        });
      });
  }, [verification.status, verification.code, ownerPhone]);

  return {
    verification,
    sendPhoneCode,
    handleOwnerPhoneChange,
    handleCodeChange,
    changePhone,
  };
}
