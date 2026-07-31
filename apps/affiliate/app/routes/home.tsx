import { redirect, type LoaderFunctionArgs } from "react-router";
import { readAffiliateSession } from "../lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await readAffiliateSession(request);
  return redirect(session.get("accessToken") ? "/portal" : "/login");
}

export default function Home() {
  return null;
}
