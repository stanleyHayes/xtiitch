import type { Route } from "./+types/track";
import { api } from "../lib/api";

export async function loader({ params }: Route.LoaderArgs) {
  const tracking = await api.tracking(params.orderId);
  if (!tracking) {
    throw new Response("Order not found", { status: 404 });
  }
  return { tracking };
}

export function meta({ data }: Route.MetaArgs) {
  const store = data?.tracking.store_name ?? "Order";
  return [
    { title: `Track your order · ${store}` },
    { name: "robots", content: "noindex" },
  ];
}

// React Router injects loaderData/actionData props only into a route module's
// LOCALLY-declared default export, not a bare re-export — wrap the moved
// component so the props are injected here and forwarded on.
import TrackPage from "../features/track/track-page";

export default function TrackRoute(props: Route.ComponentProps) {
  return <TrackPage {...props} />;
}
