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
  { title: "New activation link | Xtiitch Affiliates" }
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter the email address you used to sign up." };
  }

  await affiliateAPI("/affiliate/auth/activation/resend", {
    method: "POST",
    body: JSON.stringify({ email })
  }).catch(() => undefined);
  return { sent: true };
}

export default function ResendActivation() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <AuthLayout
      title="Request a new activation link"
      lede="We'll replace your previous link with a fresh one that is valid for 48 hours."
    >
      {result?.sent ? (
        <div className="form">
          <div className="form-head">
            <h2>Check your email</h2>
            <p className="muted">
              If that address belongs to an affiliate account awaiting
              activation, a fresh link is on its way.
            </p>
          </div>
          <p className="muted">
            Check your spam folder if it does not arrive within a few minutes.
          </p>
          <Link className="button" to="/login">Back to sign in</Link>
        </div>
      ) : (
        <Form method="post" className="form">
          <div className="form-head">
            <h2>Send a fresh link</h2>
            <p className="muted">Enter the email address used during affiliate sign-up.</p>
          </div>
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          {result?.error ? <p className="form-error" role="alert">{result.error}</p> : null}
          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Sending..." : "Send new activation link"}
            <MailIcon />
          </button>
          <p className="form-foot">Have a working link? <Link to="/activate">Back to activation</Link></p>
        </Form>
      )}
    </AuthLayout>
  );
}
