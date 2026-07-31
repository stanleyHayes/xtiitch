import { redirect, type ActionFunctionArgs } from "react-router";
import { affiliateAPI } from "../lib/api.server";
import {
  destroyAffiliateSession,
  readAffiliateSession
} from "../lib/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const session = await readAffiliateSession(request);
  const refreshToken = session.get("refreshToken");
  if (refreshToken) {
    await affiliateAPI("/affiliate/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken })
    }).catch(() => undefined);
  }
  return redirect("/login", {
    headers: { "Set-Cookie": await destroyAffiliateSession(request) }
  });
}

export default function Logout() {
  return null;
}
