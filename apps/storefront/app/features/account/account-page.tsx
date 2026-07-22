import { useActionData, useNavigation, useRouteLoaderData } from "react-router";
import type { Route } from "../../routes/+types/account";
import { AccountHub } from "./account-hub";
import { SignIn } from "./sign-in";
import type { ActionResult, OtpChannel, Step } from "./types";

// eslint-disable-next-line complexity -- prop-forwarding wrapper with several action-state branches.
export default function Account({ loaderData }: Route.ComponentProps) {
  const action = useActionData<ActionResult>();
  const navigation = useNavigation();
  // Which form is mid-submit, so the matching button can show a spinner.
  const pendingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : null;
  const {
    signedInPhone,
    redirectTo,
    orders,
    profile,
    tenantHost,
    paymentReturn,
  } = loaderData;
  // Whether a code can reach a phone at all — over SMS (default) or WhatsApp. The
  // root loader surfaces this from GET /v1/branding (phone_otp_enabled) so SSR and
  // client agree; default false on fetch failure, then only email shows.
  const rootData = useRouteLoaderData("root") as
    | { phoneOtpEnabled?: boolean }
    | undefined;
  const phoneEnabled = rootData?.phoneOtpEnabled ?? false;
  const step: Step = action?.step ?? "identify";
  const channel: OtpChannel =
    action?.channel ?? (phoneEnabled ? "whatsapp" : "email");

  if (signedInPhone) {
    // Outcome of a "Pay now" return (the loader verified the Paystack
    // reference): action feedback wins when both exist.
    const paymentNotice =
      paymentReturn === "succeeded"
        ? "Payment confirmed — thank you! The studio has your order."
        : undefined;
    const paymentError =
      paymentReturn === "retry"
        ? "That payment wasn't completed — nothing was charged. Use Pay now on the order to try again."
        : paymentReturn === "pending"
          ? "Paystack is still confirming that payment. We haven't started another charge; refresh shortly to check again."
          : paymentReturn === "unconfirmed"
            ? "We couldn't confirm that payment just now. If you completed it, it will reflect here shortly."
            : undefined;
    return (
      <AccountHub
        phone={signedInPhone}
        profile={profile}
        orders={orders}
        saved={action?.profileSaved}
        error={action?.profileError}
        tenantHost={tenantHost}
        orderNotice={action?.orderNotice ?? paymentNotice}
        orderError={action?.orderError ?? paymentError}
      />
    );
  }

  return (
    <SignIn
      redirectTo={redirectTo}
      action={action}
      step={step}
      channel={channel}
      phoneEnabled={phoneEnabled}
      pendingIntent={pendingIntent}
    />
  );
}
