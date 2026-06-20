import { createCookieSessionStorage } from "react-router";

// The storefront customer session holds the phone-OTP access token in an
// httpOnly, signed cookie. The token never reaches the browser's JavaScript; it
// is attached server-side (in loaders/actions) when calling the API so the
// shopper is metered by identity and gets the larger AI-search allowance.
type SessionData = {
  customerToken: string;
  customerPhone: string;
};

const storage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "xt_customer",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [
      process.env.SESSION_SECRET ?? "dev-storefront-session-secret-change-me",
    ],
    maxAge: 60 * 60 * 24 * 30,
  },
});

export const { getSession, commitSession, destroySession } = storage;
