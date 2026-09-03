import {
  Form,
  Link,
  useActionData,
  useNavigation,
  type ActionFunctionArgs,
  type MetaFunction
} from "react-router";
import { affiliateAPI } from "../lib/api.server";
import { AuthLayout } from "../features/auth/AuthLayout";
import { MailIcon } from "../components/Icons";

export const meta: MetaFunction = () => [
  { title: "Reset your password | Xtiitch Affiliates" }
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter the email address on your Affiliate account." };
  }

  // The response is identical whether or not the address exists. Confirming
  // "no account with that email" would turn this form into a way to test which
  // addresses are registered, so the API stays quiet and so do we — a failure
  // here is reported as sent.
  await affiliateAPI("/affiliate/auth/recovery", {
    method: "POST",
    body: JSON.stringify({ email })
  }).catch(() => undefined);

  return { sent: true };
}

export default function ForgotPassword() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <AuthLayout
      title="Forgot your password?"
      lede="We'll email you a link to set a new one. The link expires shortly after it's sent."
    >
      {result?.sent ? (
        <div className="form">
          <div className="form-head">
            <h2>Check your email</h2>
            <p className="muted">
              If that address has an Affiliate account, a reset link is on its
              way. It expires soon, so use it while it's fresh.
            </p>
          </div>
          <p className="muted">
            Nothing after a few minutes? Check your spam folder, or{" "}
            <Link to="/forgot-password">try another address</Link>.
          </p>
          <Link className="button" to="/login">
            Back to sign in
          </Link>
        </div>
      ) : (
        <Form method="post" className="form">
          <div className="form-head">
            <h2>Reset your password</h2>
            <p className="muted">
              Enter the email address on your Affiliate account.
            </p>
          </div>

          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>

          {result?.error ? (
            <p className="form-error" role="alert">
              {result.error}
            </p>
          ) : null}

          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Sending..." : "Send reset link"}
            <MailIcon />
          </button>

          <p className="form-foot">
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </Form>
      )}
    </AuthLayout>
  );
}
