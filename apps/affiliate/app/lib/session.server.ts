import { createCookieSessionStorage, redirect } from "react-router";

export type AffiliateSession = {
  accessToken: string;
  refreshToken: string;
  accountID: string;
  affiliateID: string;
  displayName: string;
};

// Matches the SESSION_SECRET convention of the other web apps: a default dev
// secret is used when unset (insecure for prod), but production refuses to
// boot without a strong secret so a misconfigured deploy cannot silently sign
// affiliate session cookies with a public value.
function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) {
    return value;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return "dev-affiliate-session-secret-change-me";
}

const storage = createCookieSessionStorage<AffiliateSession>({
  cookie: {
    name: "__xtiitch_affiliate",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret()],
    secure: process.env.NODE_ENV === "production"
  }
});

export async function readAffiliateSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function requireAffiliateSession(request: Request) {
  const session = await readAffiliateSession(request);
  if (!session.get("accessToken") || !session.get("affiliateID")) {
    throw redirect("/login");
  }
  return session;
}

export async function commitAffiliateSession(
  request: Request,
  value: AffiliateSession
) {
  const session = await readAffiliateSession(request);
  for (const [key, item] of Object.entries(value)) {
    session.set(key as keyof AffiliateSession, item);
  }
  return storage.commitSession(session);
}

export async function destroyAffiliateSession(request: Request) {
  const session = await readAffiliateSession(request);
  return storage.destroySession(session);
}
