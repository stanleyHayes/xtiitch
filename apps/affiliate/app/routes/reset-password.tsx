import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
  type MetaFunction
} from "react-router";
import { affiliateAPI } from "../lib/api.server";
import { AuthLayout } from "../features/auth/AuthLayout";
import { PasswordField } from "../components/PasswordField";
import { LockIcon } from "../components/Icons";

export const meta: MetaFunction = () => [
  { title: "Set a new password | Xtiitch Affiliates" }
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");

  if (!token) {
    return { error: "This reset link is incomplete. Request a new one." };
  }
  if (password.length < 8) {
    return { error: "Use at least eight characters." };
  }
  if (password !== confirmation) {
    return { error: "The passwords do not match." };
  }

  try {
    await affiliateAPI("/affiliate/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
  } catch {
    return { error: "This reset link is invalid or has expired." };
  }

  // Resetting does not sign you in — the API issues no session here. Send the
  // affiliate to sign-in with a notice rather than a bare form, so the reset
  // visibly succeeded.
  return redirect("/login?notice=password-reset");
}

export default function ResetPassword() {
  const [search] = useSearchParams();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const token = search.get("token") ?? "";
  const submitting = navigation.state === "submitting";

  return (
    <AuthLayout
      title="Set a new password."
      lede="Choose something you don't use anywhere else. At least eight characters."
    >
      {token ? (
        <Form method="post" className="form">
          <input name="token" type="hidden" value={token} />
          <div className="form-head">
            <h2>New password</h2>
            <p className="muted">
              This account is separate from any Xtiitch business or admin login.
            </p>
          </div>

          <PasswordField
            name="password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
          />

          <PasswordField
            name="confirmation"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            required
          />

          {result?.error ? (
            <p className="form-error" role="alert">
              {result.error}
            </p>
          ) : null}

          <button className="button" disabled={submitting} type="submit">
            {submitting ? "Saving..." : "Save new password"}
            <LockIcon />
          </button>
        </Form>
      ) : (
        <div className="form">
          <div className="form-head">
            <h2>This link is incomplete</h2>
            <p className="muted">
              Open the reset link straight from the email, or request a new one.
            </p>
          </div>
          <Link className="button" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
