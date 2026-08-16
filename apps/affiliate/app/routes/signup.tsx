/* eslint-disable max-lines -- the wizard's three step bodies are long-form copy, not logic */
import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  FacebookLogo,
  GlobeHemisphereWest,
  InstagramLogo,
  TiktokLogo,
  UsersThree,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  type MetaFunction,
} from "react-router";
import { affiliateAPI } from "../lib/api.server";
import { AuthLayout } from "../features/auth/AuthLayout";
import { ChoiceCards } from "../components/ChoiceCards";
import { PhoneField } from "../components/PhoneField";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "../components/Icons";

export const meta: MetaFunction = () => [
  { title: "Join | Xtiitch Affiliates" },
  {
    name: "description",
    content: "Create a Xtiitch affiliate account and earn on every referral.",
  },
];

// Signup provisions an affiliate under the active default programme and sends
// an activation link. Commission remains configurable centrally by admins.
const CHANNELS = [
  { value: "instagram", label: "Instagram", icon: InstagramLogo },
  { value: "tiktok", label: "TikTok", icon: TiktokLogo },
  { value: "whatsapp", label: "WhatsApp", icon: WhatsappLogo },
  { value: "other", label: "X (Twitter)", icon: XLogo },
  { value: "youtube", label: "YouTube", icon: YoutubeLogo },
  { value: "facebook", label: "Facebook", icon: FacebookLogo },
  { value: "blog", label: "Blog or website", icon: GlobeHemisphereWest },
  { value: "other", label: "In person", icon: UsersThree },
];

const AFFILIATE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,30}[A-Za-z0-9]$/;

const STEPS = [
  { title: "About you", hint: "Who's joining" },
  { title: "Contact", hint: "How we reach you" },
  { title: "Audience", hint: "How you'll promote" },
];

// Required fields per step, checked before Continue will advance. Keeping this
// as data rather than branching code means the wizard and the messages cannot
// drift apart as fields move between steps.
const REQUIRED: { name: string; label: string }[][] = [
  [
    { name: "applicant_type", label: "Choose how you're joining" },
    { name: "display_name", label: "Enter a display name" },
    { name: "contact_name", label: "Enter your contact name" },
  ],
  [
    { name: "email", label: "Enter your email address" },
    { name: "requested_code", label: "Enter your preferred referral code" },
  ],
  [],
];

function fieldErrorMessage(code: string): string {
  if (code === "affiliate_code_taken") {
    return "That referral code is already taken. Try another one.";
  }
  if (code === "affiliate_email_taken") {
    return "An affiliate account already exists for this email. Sign in or reset your password.";
  }
  if (code === "invalid_application") {
    return "Some details are missing or invalid. Check the form and try again.";
  }
  return "We could not create your account right now. Please try again.";
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const consent = form.get("consent") === "on";
  if (!consent) {
    return { error: "Please accept the programme terms to join." };
  }

  const channels = form
    .getAll("promotion_channels")
    .map((value) => String(value))
    .filter(Boolean);

  try {
    await affiliateAPI("/public/affiliate-applications", {
      method: "POST",
      body: JSON.stringify({
        applicant_type: String(form.get("applicant_type") ?? "person"),
        display_name: String(form.get("display_name") ?? "").trim(),
        contact_name: String(form.get("contact_name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        website_url: String(form.get("website_url") ?? "").trim(),
        requested_code: String(form.get("requested_code") ?? "").trim(),
        audience_summary: String(form.get("audience_summary") ?? "").trim(),
        promotion_channels: channels,
        consent,
      }),
    });
    return redirect("/login?notice=account-created");
  } catch (error) {
    if (error instanceof Response) {
      // affiliateAPI throws a Response whose body is the API's machine code.
      // Map it to something an applicant can act on; never show the raw code.
      return { error: fieldErrorMessage(await error.text()) };
    }
    return { error: fieldErrorMessage("") };
  }
}

// eslint-disable-next-line max-lines-per-function, complexity -- three-step application form; the steps share validation and must stay mounted so values survive going back
export default function Signup() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  const formRef = useRef<HTMLFormElement | null>(null);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  // Server-rendered HTML shows every step at once, so the form still works
  // with no JavaScript: it is one plain form that happens to be long. The
  // wizard only takes over once React has hydrated.
  const [wizard, setWizard] = useState(false);
  useEffect(() => setWizard(true), []);

  useEffect(() => {
    const normalized = code.trim().toUpperCase();
    if (!AFFILIATE_CODE_PATTERN.test(normalized)) {
      setCodeStatus("idle");
      return;
    }
    setCodeStatus("checking");
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/affiliate-code-check?code=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((result: { available?: boolean; reason?: string }) => {
          setCodeStatus(
            result.available
              ? "available"
              : result.reason === "taken"
                ? "taken"
                : "error",
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) setCodeStatus("error");
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [code]);

  // eslint-disable-next-line complexity -- validation mirrors the three visible wizard steps and their async code state
  const missingOnStep = (index: number): string | null => {
    const form = formRef.current;
    if (!form) {
      return null;
    }
    const data = new FormData(form);
    for (const field of REQUIRED[index] ?? []) {
      if (!String(data.get(field.name) ?? "").trim()) {
        return field.label;
      }
    }
    if (index === 1) {
      const email = String(data.get("email") ?? "");
      if (email && !email.includes("@")) {
        return "Enter a valid email address";
      }
      const code = String(data.get("requested_code") ?? "").trim();
      if (code && !AFFILIATE_CODE_PATTERN.test(code)) {
        return "Use 3–32 letters, numbers, hyphens, or underscores for your referral code";
      }
      if (codeStatus === "checking" || codeStatus === "idle") {
        return "Wait while we check that referral code";
      }
      if (codeStatus === "taken") {
        return "That referral code is already taken. Try another one";
      }
      if (codeStatus === "error") {
        return "We could not check that code. Try again in a moment";
      }
    }
    if (index === 2 && data.getAll("promotion_channels").length === 0) {
      return "Choose at least one promotion channel";
    }
    return null;
  };

  const goNext = () => {
    const missing = missingOnStep(step);
    if (missing) {
      setStepError(missing);
      return;
    }
    setStepError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError(null);
    setStep((current) => Math.max(current - 1, 0));
  };

  // Guards the final submit. Fields on earlier steps are hidden but still in
  // the form, so a browser that skipped them must not post a half-empty
  // application — this walks every step, not just the visible one.
  const onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = (event) => {
    if (!wizard) {
      return;
    }
    for (let index = 0; index < STEPS.length; index += 1) {
      const missing = missingOnStep(index);
      if (missing) {
        event.preventDefault();
        setStep(index);
        setStepError(missing);
        return;
      }
    }
    const data = new FormData(event.currentTarget);
    if (data.get("consent") !== "on") {
      event.preventDefault();
      setStepError("Please accept the programme terms to join.");
    }
  };

  // Inactive steps stay mounted and merely hidden, so their values survive
  // moving back and forth and all of them post together at the end.
  const stepClass = (index: number) =>
    !wizard || index === step ? "wizard-step" : "wizard-step is-hidden";

  const isLast = step === STEPS.length - 1;

  return (
    <AuthLayout
      wide
      title="Earn on every business you bring to Xtiitch."
      lede="Share your link and earn commission on qualified signups and sales. Create your account and start promoting without waiting for approval."
    >
      <Form
        method="post"
        className="form form-wide auth-form"
        ref={formRef}
        onSubmit={onSubmit}
      >
        <div className="form-head">
          <h2>Create your affiliate account</h2>
          <p className="muted">
            Tell us who you are and how you'll promote Xtiitch. We'll email your
            secure activation link as soon as you finish.
          </p>
        </div>

        {wizard ? (
          <ol className="stepper" aria-label="Account setup progress">
            {STEPS.map((item, index) => (
              <li
                key={item.title}
                className={
                  index === step
                    ? "stepper-item is-active"
                    : index < step
                      ? "stepper-item is-done"
                      : "stepper-item"
                }
                aria-current={index === step ? "step" : undefined}
              >
                <span className="stepper-dot">
                  {index < step ? <CheckIcon size={13} /> : index + 1}
                </span>
                <span className="stepper-text">
                  <span className="stepper-title">{item.title}</span>
                  <span className="stepper-hint">{item.hint}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className={stepClass(0)}>
          <ChoiceCards
            name="applicant_type"
            legend="I'm joining as"
            defaultValue="person"
            choices={[
              {
                value: "person",
                label: "An individual",
                hint: "Creator, student, or personal network",
              },
              {
                value: "business",
                label: "A business or agency",
                hint: "Registered company promoting on behalf of clients",
              },
            ]}
          />
          <div className="field-pair">
            <label>
              Display name
              <input
                name="display_name"
                type="text"
                placeholder="How you'll appear to us"
              />
            </label>
            <label>
              Contact name
              <input
                name="contact_name"
                type="text"
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>
          </div>
        </div>

        <div className={stepClass(1)}>
          <div className="field-pair">
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <PhoneField />
          </div>
          <div className="field-pair">
            <label>
              Website or main profile
              <input
                name="website_url"
                type="url"
                placeholder="https://instagram.com/yourhandle"
              />
            </label>
            <label>
              Preferred referral code
              <input
                name="requested_code"
                type="text"
                placeholder="e.g. AMA20"
                maxLength={24}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                aria-describedby="referral-code-status"
              />
              <span
                id="referral-code-status"
                className={`field-status ${codeStatus}`}
                aria-live="polite"
              >
                {codeStatus === "checking"
                  ? "Checking availability…"
                  : codeStatus === "available"
                    ? `✓ ${code.trim().toUpperCase()} is available`
                    : codeStatus === "taken"
                      ? "That referral code is already taken — try another."
                      : codeStatus === "error"
                        ? "Could not check availability. Try again."
                        : "3–32 letters, numbers, hyphens, or underscores."}
              </span>
            </label>
          </div>
        </div>

        <div className={stepClass(2)}>
          <fieldset className="field-set channel-picker">
            <legend>Where will you promote Xtiitch?</legend>
            <p className="channel-picker-note" id="channel-picker-help">
              Choose every channel you plan to use. You can update this later.
            </p>
            <div
              className="channel-grid"
              aria-describedby="channel-picker-help"
            >
              {CHANNELS.map(({ value, label, icon: Icon }) => (
                <label className="channel-card" key={label}>
                  <input
                    type="checkbox"
                    name="promotion_channels"
                    value={value}
                  />
                  <span className="channel-icon" aria-hidden="true">
                    <Icon size={30} weight="duotone" />
                  </span>
                  <span className="channel-label">{label}</span>
                  <span className="channel-selected" aria-hidden="true">
                    <CheckIcon size={13} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Tell us about your audience
            <textarea
              name="audience_summary"
              rows={4}
              placeholder="Who follows you, roughly how many, and why Xtiitch suits them."
            />
          </label>

          <label className="checkbox-row consent-row">
            <input type="checkbox" name="consent" />
            <span>
              I have read and accept the{" "}
              <Link to="/terms" target="_blank" rel="noopener noreferrer">
                affiliate programme terms
              </Link>
              , and agree to receive programme and account messages.
            </span>
          </label>
        </div>

        {stepError ? (
          <p className="form-error" role="alert">
            {stepError}
          </p>
        ) : null}
        {result?.error ? (
          <p className="form-error" role="alert">
            {result.error}
          </p>
        ) : null}

        {wizard ? (
          <div className="wizard-actions">
            {step > 0 ? (
              <button
                className="button secondary-button"
                type="button"
                onClick={goBack}
              >
                <ArrowLeftIcon />
                Back
              </button>
            ) : (
              <span />
            )}
            {/* The keys matter. Without them React sees one <button
                className="button"> in both branches and reuses the same DOM
                node, so advancing into the last step flips that very node's
                type from "button" to "submit" while its click is still being
                handled — and the browser submits the form the instant you
                press Continue. Distinct keys force a fresh element. */}
            {isLast ? (
              <button
                key="submit"
                className={submitting ? "button is-loading" : "button"}
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Creating account..." : "Create account"}
                <ArrowRightIcon />
              </button>
            ) : (
              <button
                key="continue"
                className="button"
                type="button"
                onClick={goNext}
              >
                Continue
                <ArrowRightIcon />
              </button>
            )}
          </div>
        ) : (
          <button
            className={submitting ? "button is-loading" : "button"}
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating account..." : "Create account"}
            <ArrowRightIcon />
          </button>
        )}

        <p className="form-foot">
          Already an affiliate? <Link to="/login">Sign in</Link>
        </p>
      </Form>
    </AuthLayout>
  );
}
