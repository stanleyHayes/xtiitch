import { createCookieSessionStorage } from "react-router";

// The dashboard session holds the API access + refresh tokens in an httpOnly,
// signed cookie. Tokens never reach the browser's JavaScript.
type SessionData = {
  access: string;
  refresh: string;
  // Short-lived: set after a password check when the account has MFA enabled,
  // cleared once the second factor is verified.
  mfaChallenge: string;
};

// Read env defensively: this module is server-only, but a client bundle can pull
// it in transitively (e.g. a route that also exports an action, or the activation
// helpers), and `process` is undefined in the browser — an unguarded
// `process.env` there throws at module load and kills hydration (the signup form
// went dead, Continue stuck disabled). Session ops only ever run server-side, so
// the browser just needs this not to throw.
const nodeEnv =
  typeof process !== "undefined" ? process.env.NODE_ENV : undefined;
const sessionSecret =
  typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;

const storage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "xt_dashboard",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: nodeEnv === "production",
    secrets: [sessionSecret ?? "dev-dashboard-session-secret-change-me"],
    maxAge: 60 * 60 * 24 * 30,
  },
});

export const { getSession, commitSession, destroySession } = storage;
