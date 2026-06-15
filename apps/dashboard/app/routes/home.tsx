import { redirect } from "react-router";

// The dashboard root sends owners straight into their store; the dashboard
// loader bounces to /login when there is no session.
export function loader() {
  return redirect("/dashboard");
}

export default function Home() {
  return null;
}
