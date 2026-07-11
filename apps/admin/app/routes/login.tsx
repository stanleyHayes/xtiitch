import { redirect } from "react-router";
import type { Route } from "./+types/login";
import {
  commitSession,
  destroySession,
  getSession,
  setAdminSession,
} from "../lib/session";
import { AdminApiError, adminApi, adminApiBase } from "../lib/api";
import AdminLogin from "../features/auth/AdminLogin";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Admin sign in · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const accessToken = session.get("accessToken");

  if (!accessToken) {
    return null;
  }

  const currentAdmin = await adminApi.me(accessToken).catch(() => null);
  if (currentAdmin) {
    return redirect("/admin");
  }

  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your operator email and password." };
  }

  let auth;
  try {
    auth = await adminApi.login(email, password);
  } catch (error) {
    if (error instanceof AdminApiError) {
      if (error.code === "invalid_credentials") {
        return { error: "Those operator credentials are not valid." };
      }
      if (error.code === "admin_api_unavailable") {
        const message =
          process.env.NODE_ENV === "production"
            ? "Admin API is unavailable. Try again after a moment."
            : `Admin API is unavailable. Start the API at ${adminApiBase} and try again.`;
        return { error: message };
      }
    }
    return { error: "Admin sign in failed. Try again after a moment." };
  }

  const session = await getSession(request.headers.get("Cookie"));
  setAdminSession(session, auth);

  return redirect("/admin", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return <AdminLogin actionData={actionData} />;
}
