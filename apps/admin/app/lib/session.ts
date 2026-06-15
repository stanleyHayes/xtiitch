import { createCookieSessionStorage, redirect } from "react-router";

type SessionData = {
  adminEmail: string;
  adminRole: "owner" | "operator" | "support";
};

const storage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "xt_admin",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET ?? "dev-admin-session-secret-change-me"],
    maxAge: 60 * 60 * 12,
  },
});

export const { getSession, commitSession, destroySession } = storage;

export async function requireAdmin(request: Request): Promise<SessionData> {
  const session = await getSession(request.headers.get("Cookie"));
  const adminEmail = session.get("adminEmail");
  const adminRole = session.get("adminRole");
  if (!adminEmail || !adminRole) {
    throw redirect("/login");
  }
  return { adminEmail, adminRole };
}

export async function logOut(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
}
