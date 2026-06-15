import { redirect } from "react-router";
import { destroySession, getSession } from "./session";

export const API_BASE = process.env.XTIITCH_API_URL ?? "http://localhost:8080";

// apiFetch calls the protected API with the session's access token. Without a
// session, or on a rejected token, it throws a redirect to the login page
// (clearing the cookie). Access tokens are short-lived; re-login refreshes them
// — automatic silent refresh is a follow-up.
export async function apiFetch(request: Request, path: string, init?: RequestInit): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  const access = session.get("access");
  if (!access) {
    throw redirect("/login");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${access}`);

  const response = await fetch(`${API_BASE}/v1${path}`, { ...init, headers });
  if (response.status === 401) {
    throw redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
  }
  return response;
}

export async function logOut(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
}
