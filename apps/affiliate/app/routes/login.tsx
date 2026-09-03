import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
  type MetaFunction,
} from "react-router";
import { affiliateAPI, type AffiliateAuthResponse } from "../lib/api.server";
import { commitAffiliateSession } from "../lib/session.server";
import { AuthLayout } from "../features/auth/AuthLayout";
import { PasswordField } from "../components/PasswordField";
import { SignInIcon } from "../components/Icons";

export const meta: MetaFunction = () => [
  { title: "Sign in | Xtiitch Affiliates" },
  {
    name: "description",
    content: "Sign in to view your Xtiitch Affiliate performance and earnings.",
  },
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  try {
    const result = await affiliateAPI<AffiliateAuthResponse>(
      "/affiliate/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    const cookie = await commitAffiliateSession(request, {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      accountID: result.account.account_id,
      affiliateID: result.account.affiliate_id,
      displayName: result.account.display_name,
    });
    return redirect("/portal", { headers: { "Set-Cookie": cookie } });
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      // Deliberately the same message for "no such email" and "wrong
      // password": saying which one was wrong tells an attacker whether an
      // address is registered.
      return { error: "The email or password is incorrect." };
    }
    if (error instanceof Response && error.status === 429) {
      return {
        error: "Too many sign-in attempts. Wait a few minutes and try again.",
      };
    }
    return { error: "Sign in is unavailable right now. Please try again." };
  }
}

export default function Login() {
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const [search] = useSearchParams();
  const submitting = navigation.state === "submitting";
  // Set by the flows that send the affiliate here after finishing something,
  // so the page can confirm it rather than looking like a plain bounce.
  const notice = search.get("notice");

  return (
    <AuthLayout
      title="Your referrals, earnings and payouts in one place."
		lede="Track referred business status and recurring subscription earnings without exposing merchant details."
    >
      <Form method="post" className="form auth-form">
        <div className="form-head">
          <h2>Sign in</h2>
          <p className="muted">Welcome back. Enter your details to continue.</p>
        </div>

        {notice === "password-reset" ? (
          <p className="form-success">
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        {notice === "account-created" ? (
          <p className="form-success">
            Account created. Check your email to set your password and start
            sharing.
          </p>
        ) : null}

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

        <PasswordField
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          required
          labelAccessory={
            <Link className="label-link" to="/forgot-password">
              Forgot password?
            </Link>
          }
        />

        {result?.error ? (
          <p className="form-error" role="alert">
            {result.error}
          </p>
        ) : null}

        <button
          className={submitting ? "button is-loading" : "button"}
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Signing in..." : "Sign in"}
          <SignInIcon />
        </button>

        <p className="form-foot">
					Not an Affiliate yet? <Link to="/signup">Create an account</Link>
        </p>
      </Form>
    </AuthLayout>
  );
}
