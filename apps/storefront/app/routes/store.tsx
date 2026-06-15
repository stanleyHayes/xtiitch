import type { Route } from "./+types/store";
import { api } from "../lib/api";
import { StoreView } from "../components/storefront";

export async function loader({ params, request }: Route.LoaderArgs) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

  if (query) {
    const result = await api.search(params.handle, query);
    if (!result) {
      throw new Response("Store not found", { status: 404 });
    }
    return { store: result.store, designs: result.designs, query };
  }

  const page = await api.store(params.handle);
  if (!page) {
    throw new Response("Store not found", { status: 404 });
  }
  return { store: page.store, designs: page.designs, query: "" };
}

export function meta({ data }: Route.MetaArgs) {
  const name = data?.store.name ?? "Store";
  return [
    { title: `${name} · Xtiitch` },
    { name: "description", content: `Browse and order from ${name} on Xtiitch.` },
  ];
}

export default function Store({ loaderData }: Route.ComponentProps) {
  const { store, designs, query } = loaderData;
  return <StoreView store={store} designs={designs} query={query} />;
}
