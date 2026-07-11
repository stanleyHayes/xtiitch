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
  // A paid plan that is still pending activation is rejected by the API with 402
  // { error: "activation_required" } on every paid mutation. Handle it globally:
  // send the owner to the activation page (reads/navigation stay untouched). The
  // body is read from a clone so a non-activation 402 leaves the response intact.
  if (response.status === 402) {
    let error: string | undefined;
    try {
      const body = (await response.clone().json()) as { error?: string };
      error = body.error;
    } catch {
      error = undefined;
    }
    if (error === "activation_required") {
      // Mirrors ACTIVATION_PATH in ./activation; kept literal to avoid a cycle.
      throw redirect("/activate?blocked=1");
    }
  }
  return response;
}

export async function logOut(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
}
