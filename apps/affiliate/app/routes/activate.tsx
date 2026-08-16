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
import {
  affiliateAPI,
  type AffiliateAuthResponse
} from "../lib/api.server";
import { commitAffiliateSession } from "../lib/session.server";
import { PasswordField } from "../components/PasswordField";

export const meta: MetaFunction = () => [
  { title: "Activate account | Xtiitch Affiliates" }
];

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirmation = String(form.get("confirmation") ?? "");
  if (password !== confirmation) {
    return { error: "The passwords do not match." };
  }
  try {
    const result = await affiliateAPI<AffiliateAuthResponse>(
      "/affiliate/auth/activate",
      {
        method: "POST",
        body: JSON.stringify({ token, password })
      }
    );
    const cookie = await commitAffiliateSession(request, {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      accountID: result.account.account_id,
      affiliateID: result.account.affiliate_id,
      displayName: result.account.display_name
    });
    return redirect("/portal", { headers: { "Set-Cookie": cookie } });
  } catch {
    return { error: "This activation link is invalid or has expired." };
  }
}

export default function Activate() {
  const [search] = useSearchParams();
  const result = useActionData<typeof action>();
  const navigation = useNavigation();
  const token = search.get("token") ?? "";
  return (
    <main className="centered-layout">
      <Form method="post" className="form standalone-form">
        <input name="token" type="hidden" value={token} />
        <div>
          <p className="eyebrow">Account activation</p>
          <h1>Choose your password</h1>
          <p className="muted">
            Use at least eight characters. This account is separate from any
            Xtiitch business or admin login.
          </p>
        </div>
        <PasswordField
          name="password"
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
        <PasswordField
          name="confirmation"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          required
        />
        {result?.error ? <p className="form-error">{result.error}</p> : null}
        <button
          className="button"
          disabled={!token || navigation.state === "submitting"}
          type="submit"
        >
          {navigation.state === "submitting"
            ? "Activating..."
            : "Activate account"}
        </button>
        <p className="form-foot">
          Link expired or not working?{" "}
          <Link to="/resend-activation">Request a new link</Link>
        </p>
      </Form>
    </main>
  );
}
