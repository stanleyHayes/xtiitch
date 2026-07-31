import { redirect } from "react-router";
import { affiliateAPI, authorized, type AffiliateAuthResponse } from "./api.server";
import {
  commitAffiliateSession,
  destroyAffiliateSession,
  requireAffiliateSession,
} from "./session.server";

// Keeps an affiliate signed in for as long as their cookie lasts.
//
// The session cookie lives 30 days, but the access token it carries expires in
// minutes. Nothing ever called /affiliate/auth/refresh — the refresh token was
// stored at sign-in and only ever read again by logout, to revoke it. So once
// the access token died, every portal request 401'd and the affiliate was
// bounced to the sign-in screen with a perfectly valid cookie in their browser.
//
// This runs an authenticated call, and on 401 refreshes once and retries. The
// API ROTATES the refresh token (it revokes the old session and issues a new
// pair), so the new tokens must be written back to the cookie — keeping the old
// one would break the next refresh and reintroduce the bounce one cycle later.
export type AuthedResult<T> = {
  data: T;
  // Present only when a refresh happened. The caller must return it as a
  // Set-Cookie header, or the rotated tokens are lost and the next request
  // refreshes again (and eventually fails, because the old token is revoked).
  setCookie?: string;
};

export async function withAffiliateAuth<T>(
  request: Request,
  run: (headers: HeadersInit) => Promise<T>,
): Promise<AuthedResult<T>> {
  const session = await requireAffiliateSession(request);
  const accessToken = session.get("accessToken") as string;

  try {
    return { data: await run(authorized(accessToken)) };
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }
  }

  const refreshToken = session.get("refreshToken") as string | undefined;
  if (!refreshToken) {
    throw await signOut(request);
  }

  let refreshed: AffiliateAuthResponse;
  try {
    refreshed = await affiliateAPI<AffiliateAuthResponse>(
      "/affiliate/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );
  } catch {
    // The refresh token is revoked, expired, or the account is no longer
    // active. Nothing to recover: clear the cookie so the browser stops
    // presenting a dead session on every request.
    throw await signOut(request);
  }

  const setCookie = await commitAffiliateSession(request, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    accountID: refreshed.account.account_id,
    affiliateID: refreshed.account.affiliate_id,
    displayName: refreshed.account.display_name,
  });

  try {
    return { data: await run(authorized(refreshed.access_token)), setCookie };
  } catch (error) {
    // A 401 with a token minted seconds ago is not an expiry — the account was
    // suspended or the endpoint rejects this principal. Retrying would loop.
    if (isUnauthorized(error)) {
      throw await signOut(request);
    }
    throw error;
  }
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof Response && error.status === 401;
}

async function signOut(request: Request): Promise<Response> {
  return redirect("/login", {
    headers: { "Set-Cookie": await destroyAffiliateSession(request) },
  });
}
