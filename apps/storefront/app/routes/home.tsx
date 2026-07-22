import type { Route } from "./+types/home";
import { api } from "../lib/api";
import { requestTenant } from "../lib/tenant";
import { storefrontMeta } from "../lib/seo";
import { StoreView } from "../components/storefront";
import { Marketplace } from "../components/marketplace";

// The storefront root. On a business subdomain (<handle>.xtiitch.com) it resolves
// and renders that store; on the apex/marketplace host it shows the marketplace —
// every studio, featured placements, and the AI-search entry.
export async function loader({ request }: Route.LoaderArgs) {
  const handle = requestTenant(request);
  const requestedURL = new URL(request.url);
  const canonicalURL = `${requestedURL.origin}${requestedURL.pathname}`;
  if (!handle) {
    const [shopsPage, sponsoredPage] = await Promise.all([
      api.shops(),
      api.sponsored(8),
    ]);
    return {
      mode: "marketplace" as const,
      shops: shopsPage?.shops ?? [],
      sponsored: sponsoredPage?.placements ?? [],
      canonicalURL,
    };
  }

  // §6 tenant isolation: every upstream call below carries the
  // X-Xtiitch-Tenant header, and cross-store reads (api.shops for the
  // discovery strip) are not made at all on a tenant host — the strip never
  // renders there, on any plan.
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query) {
    const page = await api.search(handle, query, handle);
    if (!page) {
      throw new Response("Store not found", { status: 404 });
    }
    return {
      mode: "store" as const,
      store: page.store,
      designs: page.designs,
      collections: [],
      query,
      marketplace: [],
      tenantHost: true,
      canonicalURL,
    };
  }

  const page = await api.store(handle, handle);
  if (!page) {
    throw new Response("Store not found", { status: 404 });
  }
  return {
    mode: "store" as const,
    store: page.store,
    designs: page.designs,
    collections: page.collections,
    query: "",
    marketplace: [],
    tenantHost: true,
    canonicalURL,
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (data?.mode === "store") {
    const title = `${data.store.name} · Xtiitch`;
    const description = `Browse and order ${data.store.name}'s designs on Xtiitch — see prices and order online, no account needed.`;
    return storefrontMeta({
      title,
      description,
      canonicalURL: data.canonicalURL,
      imageAlt: `${data.store.name} storefront on Xtiitch`,
    });
  }
  const title = "Discover Ghana's fashion studios · Xtiitch";
  const description =
    "Browse Ghanaian fashion studios and their designs, or describe what you want and let AI find it across every shop. Order online — no account needed to look.";
  return storefrontMeta({
    title,
    description,
    canonicalURL: data?.canonicalURL ?? "https://store.xtiitch.com/",
    imageAlt: "Xtiitch — Ghana's fashion marketplace",
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.mode === "store") {
    return (
      <StoreView
        store={loaderData.store}
        designs={loaderData.designs}
        collections={loaderData.collections}
        query={loaderData.query}
        marketplace={loaderData.marketplace}
        tenantHost={loaderData.tenantHost}
      />
    );
  }
  return (
    <Marketplace shops={loaderData.shops} sponsored={loaderData.sponsored} />
  );
}
