import { redirect } from "react-router";
import type { Route } from "../../routes/+types/security";
import { fetchApi } from "../../lib/api-base";
import { requireAccess } from "./security-loader";

export async function action({ request }: Route.ActionArgs) { // eslint-disable-line complexity -- route action/loader with many conditional branches; refactor in follow-up
  const access = await requireAccess(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const auth = { Authorization: `Bearer ${access}` };

  // An expired/revoked access token surfaces as 401 on these POSTs; send the
  // user back to sign in rather than showing a misleading "wrong code" error.
  const redirectIfUnauthorized = (response: Response) => {
    if (response.status === 401) {
      throw redirect("/login");
    }
  };

  if (intent === "setup") {
    const response = await fetchApi("/auth/business/mfa/setup", {
      method: "POST",
      headers: auth,
    });
    redirectIfUnauthorized(response);
    if (!response.ok) {
      return { error: "Could not start setup. Try again." };
    }
    const setup = (await response.json()) as {
      secret: string;
      provisioning_uri: string;
    };
    return { setup };
  }

  if (intent === "activate") {
    const code = String(form.get("code") ?? "").trim();
    const response = await fetchApi("/auth/business/mfa/activate", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    redirectIfUnauthorized(response);
    if (!response.ok) {
      return {
        error:
          "That code didn't match. Check the time on your phone and try again.",
      };
    }
    const data = (await response.json()) as { backup_codes: string[] };
    return { backupCodes: data.backup_codes };
  }

  if (intent === "disable") {
    const code = String(form.get("code") ?? "").trim();
    const response = await fetchApi("/auth/business/mfa/disable", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    redirectIfUnauthorized(response);
    if (!response.ok) {
      return { error: "That code didn't match, so two-step is still on." };
    }
    return { disabled: true };
  }

  if (intent === "change_password") {
    const currentPassword = String(form.get("current_password") ?? "");
    const newPassword = String(form.get("new_password") ?? "");
    const confirmPassword = String(form.get("confirm_password") ?? "");
    if (newPassword.length < 8 || newPassword.length > 72) {
      return {
        error: "Your new password must be 8 to 72 characters.",
        context: "password" as const,
      };
    }
    if (newPassword !== confirmPassword) {
      return {
        error: "The new passwords don't match.",
        context: "password" as const,
      };
    }
    if (newPassword === currentPassword) {
      return {
        error: "Choose a new password that's different from your current one.",
        context: "password" as const,
      };
    }
    const response = await fetchApi("/auth/business/password", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    // A wrong current password also comes back as 401 (invalid_credentials), so
    // we can't blanket-redirect here: only a genuine token problem
    // (missing_token/invalid_token) should bounce the user to sign in.
    if (response.status === 401) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (body.error === "invalid_credentials") {
        return {
          error: "That current password is incorrect.",
          context: "password" as const,
        };
      }
      throw redirect("/login");
    }
    if (!response.ok) {
      return {
        error: "Could not change your password. Try again.",
        context: "password" as const,
      };
    }
    return { passwordChanged: true };
  }

  return { error: "Unknown action." };
}
