import {
  useActionData,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "../../routes/+types/account";
import { AccountHub } from "./account-hub";
import { SignIn } from "./sign-in";
import type { ActionResult, OtpChannel, Step } from "./types";

export default function Account({ loaderData }: Route.ComponentProps) { // eslint-disable-line complexity -- prop-forwarding wrapper with several action-state branches; refactor in follow-up
  const action = useActionData<ActionResult>();
  const navigation = useNavigation();
  // Which form is mid-submit, so the matching button can show a spinner.
  const pendingIntent =
    navigation.state === "submitting"
      ? String(navigation.formData?.get("intent") ?? "")
      : null;
  const { signedInPhone, redirectTo, orders, profile, tenantHost } = loaderData;
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
    return (
      <AccountHub
        phone={signedInPhone}
        profile={profile}
        orders={orders}
        saved={action?.profileSaved}
        error={action?.profileError}
        tenantHost={tenantHost}
        orderNotice={action?.orderNotice}
        orderError={action?.orderError}
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
