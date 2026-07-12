import type { Route } from "./+types/register";
import Register from "../features/auth/Register";

export { meta, loader, action } from "../features/auth/Register";

// React Router injects loaderData/actionData props only into a route module's
// LOCALLY-declared default export, not a re-export. Without this wrapper the
// component saw undefined loaderData and defaulted plans to [] — the signup page
// showed no plans to choose from.
export default function RegisterRoute(props: Route.ComponentProps) {
  return <Register {...props} />;
}
