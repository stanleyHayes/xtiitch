import { redirect } from "react-router";
import type { Route } from "./+types/design-redirect";

// The dashboard's "Copy design link" shares .../design/:handle, but the
// storefront serves designs at /d/:handle. Permanently redirect the shared long
// path to the canonical short one — preserving any reward/referral query string —
// so existing shared links resolve instead of falling through to the 404
// catch-all.
export function loader({ params, request }: Route.LoaderArgs) {
  const { search } = new URL(request.url);
  return redirect(`/d/${encodeURIComponent(params.handle)}${search}`, 301);
}
