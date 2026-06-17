import { createCookieSessionStorage, redirect } from "react-router";
import { adminApi, type AdminAuthResult, type AdminRole } from "./api";

type SessionData = {
  adminUserId: string;
  adminEmail: string;
  adminDisplayName: string;
  adminRole: AdminRole;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
};

export type AdminSession = Pick<SessionData, "adminUserId" | "adminEmail" | "adminDisplayName" | "adminRole">;
export type AdminContext = { admin: AdminSession; accessToken: string };

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

export function setAdminSession(session: Awaited<ReturnType<typeof getSession>>, auth: AdminAuthResult) {
  session.set("adminUserId", auth.adminUserId);
  session.set("adminEmail", auth.email);
  session.set("adminDisplayName", auth.displayName);
  session.set("adminRole", auth.role);
  session.set("accessToken", auth.accessToken);
  session.set("refreshToken", auth.refreshToken);
  session.set("accessExpiresAt", auth.accessExpiresAt);
  session.set("refreshExpiresAt", auth.refreshExpiresAt);
}

export async function requireAdminContext(request: Request): Promise<AdminContext> {
  const session = await getSession(request.headers.get("Cookie"));
  const adminUserId = session.get("adminUserId");
  const adminEmail = session.get("adminEmail");
  const adminDisplayName = session.get("adminDisplayName");
  const adminRole = session.get("adminRole");
  const accessToken = session.get("accessToken");
  const refreshToken = session.get("refreshToken");
  if (!adminUserId || !adminEmail || !adminDisplayName || !adminRole || !accessToken || !refreshToken) {
    throw redirect("/login");
  }

  const me = await adminApi.me(accessToken).catch(async () => {
    const refreshed = await adminApi.refresh(refreshToken).catch(() => null);
    if (refreshed) {
      setAdminSession(session, refreshed);
      const url = new URL(request.url);
      throw redirect(`${url.pathname}${url.search}`, {
        headers: { "Set-Cookie": await commitSession(session) },
      });
    }
    throw redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
  });

  return {
    admin: {
      adminUserId: me.adminUserId,
      adminEmail: me.email,
      adminDisplayName: me.displayName,
      adminRole: me.role,
    },
    accessToken,
  };
}

export async function requireAdmin(request: Request): Promise<AdminSession> {
  const { admin } = await requireAdminContext(request);
  return admin;
}

export async function logOut(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  const refreshToken = session.get("refreshToken");
  if (refreshToken) {
    await adminApi.logout(refreshToken).catch(() => undefined);
  }
  return redirect("/login", { headers: { "Set-Cookie": await destroySession(session) } });
}
