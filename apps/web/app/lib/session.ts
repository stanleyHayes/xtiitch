import { createCookieSessionStorage } from "react-router";

// The dashboard session holds the API access + refresh tokens in an httpOnly,
// signed cookie. Tokens never reach the browser's JavaScript.
type SessionData = {
  access: string;
  refresh: string;
};

const storage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "xt_dashboard",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [process.env.SESSION_SECRET ?? "dev-dashboard-session-secret-change-me"],
    maxAge: 60 * 60 * 24 * 30,
  },
});

export const { getSession, commitSession, destroySession } = storage;
