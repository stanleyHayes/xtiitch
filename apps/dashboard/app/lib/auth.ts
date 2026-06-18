import { redirect } from "react-router";
import { fetchApi } from "./api-base";
import { destroySession, getSession } from "./session";

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

  let response: Response;
  try {
    response = await fetchApi(path, { ...init, headers });
  } catch {
    return new Response(JSON.stringify({ error: "dashboard_api_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (response.status === 401) {
    throw redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
  }
  return response;
}

export async function logOut(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
}
