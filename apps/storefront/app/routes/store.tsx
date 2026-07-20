import type { Route } from "./+types/store";
import { api } from "../lib/api";
import { requestTenant } from "../lib/tenant";
import { StoreView } from "../components/storefront";

export async function loader({ params, request }: Route.LoaderArgs) {
  // §6: on a tenant host only that tenant's own store exists — a /store/:handle
  // for any other store is a 404, exactly as if the page were never built.
  const tenant = requestTenant(request);
  if (tenant && params.handle !== tenant) {
    throw new Response("Store not found", { status: 404 });
  }
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

  if (query) {
    const result = await api.search(params.handle, query, tenant);
    if (!result) {
      throw new Response("Store not found", { status: 404 });
    }
    return {
      store: result.store,
      designs: result.designs,
      collections: [],
      query,
      marketplace: [],
      tenantHost: Boolean(tenant),
    };
  }

  // The cross-store discovery strip's data is only fetched where it can render
  // (the marketplace host); on a tenant host the §6 middleware would 404 it.
  const [page, shopsPage] = await Promise.all([
    api.store(params.handle, tenant),
    tenant ? Promise.resolve(null) : api.shops(),
  ]);
  if (!page) {
    throw new Response("Store not found", { status: 404 });
  }
  return {
    store: page.store,
    designs: page.designs,
    collections: page.collections,
    query: "",
    marketplace: shopsPage?.shops ?? [],
    tenantHost: Boolean(tenant),
  };
}

export function meta({ data }: Route.MetaArgs) {
  const name = data?.store.name ?? "Store";
  return [
    { title: `${name} · Xtiitch` },
    {
      name: "description",
      content: `Browse and order from ${name} on Xtiitch.`,
    },
  ];
}

export default function Store({ loaderData }: Route.ComponentProps) {
  const { store, designs, collections, query, marketplace, tenantHost } =
    loaderData;
  return (
    <StoreView
      store={store}
      designs={designs}
      collections={collections}
      query={query}
      marketplace={marketplace}
      tenantHost={tenantHost}
    />
  );
}
