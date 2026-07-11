import { redirect } from "react-router";
import type { Route } from "./+types/collection-redirect";

// The dashboard's "Copy collection link" shares .../collection/:handle, but the
// storefront serves collections at /c/:handle. Permanently redirect the shared
// long path to the canonical short one — preserving any query string — so
// existing shared links resolve instead of falling through to the 404 catch-all.
export function loader({ params, request }: Route.LoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(`/c/${encodeURIComponent(params.handle)}${search}`, 301);
}
