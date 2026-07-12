import type { Route } from "./+types/security";
import Security from "../features/security/Security";

export { action } from "../features/security/security-action";
export { loader } from "../features/security/security-loader";
export { meta } from "../features/security/Security";

// React Router injects loaderData/actionData props only into a route module's
// LOCALLY-declared default export, not a bare re-export — wrap the moved
// component so the props are injected here and forwarded on. (Security reads
// loaderData.status directly, so a re-export left it undefined and crashed.)
export default function SecurityRoute(props: Route.ComponentProps) {
  return <Security {...props} />;
}
