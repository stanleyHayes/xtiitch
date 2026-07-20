import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OTP_CODE_LENGTH,
  codeFieldVisible,
  fieldsFrozen,
  initialPhoneVerification,
  otpRequestErrorMessage,
  otpVerifyErrorMessage,
  phoneLocked,
  phoneStepComplete,
  phoneVerificationReducer,
  sanitizeOtpCode,
  whatsappVisible,
  type PhoneVerificationState,
} from "./phone-verification";

// Drives a sequence of events through the reducer, the way the form does.
function run(
  events: Parameters<typeof phoneVerificationReducer>[1][],
  from: PhoneVerificationState = initialPhoneVerification,
): PhoneVerificationState {
  return events.reduce(phoneVerificationReducer, from);
}

const REQUEST = { type: "request_started" } as const;
const REQUEST_OK = { type: "request_succeeded" } as const;
const VERIFY_OK = { type: "verify_succeeded" } as const;

function sentState(): PhoneVerificationState {
  return run([REQUEST, REQUEST_OK]);
}

function verifiedState(): PhoneVerificationState {
  return run([
    ...[REQUEST, REQUEST_OK],
    { type: "code_changed", code: "123456" },
    { type: "verify_started" },
    VERIFY_OK,
  ]);
}

test("§8.2: a successful code request freezes the other fields and shows the code field", () => {
  const state = sentState();
  assert.equal(state.status, "awaiting_code");
  assert.equal(fieldsFrozen(state), true);
  assert.equal(codeFieldVisible(state), true);
  // §8.4: no WhatsApp field at all before verification.
  assert.equal(whatsappVisible(state), false);
  assert.equal(phoneStepComplete(state), false);
});

test("idle state: nothing frozen, no code field, no WhatsApp field", () => {
  assert.equal(fieldsFrozen(initialPhoneVerification), false);
  assert.equal(codeFieldVisible(initialPhoneVerification), false);
  assert.equal(whatsappVisible(initialPhoneVerification), false);
  assert.equal(phoneLocked(initialPhoneVerification), false);
});

test("request_failed keeps the code field open on resend, and the error is shown", () => {
  const state = run(
    [{ type: "request_failed", message: "slow down" }],
    sentState(),
  );
  assert.equal(state.status, "awaiting_code");
  assert.equal(state.sending, false);
  assert.equal(state.error, "slow down");
  assert.equal(fieldsFrozen(state), true);
});

test("sanitizeOtpCode keeps digits only and caps at 6", () => {
  assert.equal(sanitizeOtpCode("12a3 4-5"), "12345");
  assert.equal(sanitizeOtpCode("1234567890"), "123456");
  assert.equal(OTP_CODE_LENGTH, 6);
});

test("verify_started only fires from awaiting_code (stale double-fire is a no-op)", () => {
  const idle = run([{ type: "verify_started" }]);
  assert.equal(idle.status, "idle");

  const checking = run([{ type: "verify_started" }], sentState());
  assert.equal(checking.status, "checking");
  assert.equal(fieldsFrozen(checking), true);
});

test("§8.4: successful verification unfreezes, locks the phone, reveals WhatsApp", () => {
  const state = verifiedState();
  assert.equal(state.status, "verified");
  assert.equal(fieldsFrozen(state), false);
  assert.equal(phoneLocked(state), true);
  assert.equal(whatsappVisible(state), true);
  assert.equal(phoneStepComplete(state), true);
  // The code is kept so it still submits as owner_phone_code (backward compat).
  assert.equal(state.code, "123456");
});

test("§8.3: a wrong code keeps everything frozen and clears the code for a retry", () => {
  const checking = run([{ type: "verify_started" }], {
    ...sentState(),
    code: "000000",
  });
  const state = run(
    [{ type: "verify_failed", message: "That code isn't right" }],
    checking,
  );
  assert.equal(state.status, "awaiting_code");
  assert.equal(state.code, "");
  assert.equal(state.error, "That code isn't right");
  assert.equal(fieldsFrozen(state), true);
  assert.equal(whatsappVisible(state), false);
});

test("§8: changing the phone after verification resets and re-freezes until re-verified", () => {
  const changed = run(
    [{ type: "phone_changed", phone: "0244000222" }],
    verifiedState(),
  );
  assert.equal(changed.status, "reverify_needed");
  assert.equal(changed.code, "");
  assert.equal(fieldsFrozen(changed), true);
  assert.equal(whatsappVisible(changed), false);
  assert.equal(phoneLocked(changed), false);
  assert.equal(phoneStepComplete(changed), false);

  // The new number verifies through the same cycle and unfreezes again.
  const reverified = run(
    [
      REQUEST,
      REQUEST_OK,
      { type: "code_changed", code: "654321" },
      { type: "verify_started" },
      VERIFY_OK,
    ],
    changed,
  );
  assert.equal(reverified.status, "verified");
  assert.equal(fieldsFrozen(reverified), false);
});

test("clearing the phone entirely is the escape hatch (phone is optional)", () => {
  for (const from of [verifiedState(), sentState()]) {
    const state = run([{ type: "phone_changed", phone: "  " }], from);
    assert.equal(state.status, "idle");
    assert.equal(fieldsFrozen(state), false);
  }
});

test("editing the phone while a code is pending abandons the attempt and unfreezes", () => {
  const state = run(
    [{ type: "phone_changed", phone: "0244000111" }],
    sentState(),
  );
  assert.equal(state.status, "idle");
  assert.equal(state.code, "");
  assert.equal(fieldsFrozen(state), false);
});

test("a late verify response from an abandoned attempt cannot verify the new number", () => {
  // User requested a code, then edited the phone mid-check; the old request's
  // success arrives after the state already moved to idle.
  const stale = run([VERIFY_OK], initialPhoneVerification);
  assert.equal(stale.status, "idle");

  const staleFail = run(
    [{ type: "verify_failed", message: "stale" }],
    initialPhoneVerification,
  );
  assert.equal(staleFail.status, "idle");
  assert.equal(staleFail.error, "");
});

test("typing in reverify_needed stays frozen; clearing drops back to idle", () => {
  const changed = run(
    [{ type: "phone_changed", phone: "0244000222" }],
    verifiedState(),
  );
  const stillTyping = run(
    [{ type: "phone_changed", phone: "02440002223" }],
    changed,
  );
  assert.equal(stillTyping.status, "reverify_needed");
  assert.equal(fieldsFrozen(stillTyping), true);

  const cleared = run([{ type: "phone_changed", phone: "" }], changed);
  assert.equal(cleared.status, "idle");
});

test("error message mapping: request (resend_too_soon) and verify codes", () => {
  assert.match(otpRequestErrorMessage("resend_too_soon"), /wait a moment/i);
  assert.match(otpRequestErrorMessage("anything_else"), /couldn't send/i);

  assert.match(otpVerifyErrorMessage("invalid_code"), /isn't right/i);
  assert.match(otpVerifyErrorMessage("code_expired"), /expired/i);
  assert.match(otpVerifyErrorMessage("too_many_attempts"), /too many/i);
  assert.match(otpVerifyErrorMessage("invalid_phone"), /phone number/i);
  assert.match(otpVerifyErrorMessage("whatsapp_unavailable"), /unavailable/i);
  assert.match(otpVerifyErrorMessage("something_new"), /try again/i);
});
