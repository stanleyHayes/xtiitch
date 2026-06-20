import type { Route } from "./+types/home";
import { api } from "../lib/api";
import { storeHandleFromHost } from "../lib/tenant";
import { StoreView } from "../components/storefront";
import { Marketplace } from "../components/marketplace";

// The storefront root. On a business subdomain (<handle>.xtiitch.com) it resolves
// and renders that store; on the apex/marketplace host it shows the marketplace —
// every studio, featured placements, and the AI-search entry.
export async function loader({ request }: Route.LoaderArgs) {
  const handle = storeHandleFromHost(request.headers.get("host"));
  if (!handle) {
    const [shopsPage, sponsoredPage] = await Promise.all([
      api.shops(),
      api.sponsored(8),
    ]);
    return {
      mode: "marketplace" as const,
      shops: shopsPage?.shops ?? [],
      sponsored: sponsoredPage?.placements ?? [],
    };
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query) {
    const page = await api.search(handle, query);
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
    };
  }

  const [page, shopsPage] = await Promise.all([api.store(handle), api.shops()]);
  if (!page) {
    throw new Response("Store not found", { status: 404 });
  }
  return {
    mode: "store" as const,
    store: page.store,
    designs: page.designs,
    collections: page.collections,
    query: "",
    marketplace: shopsPage?.shops ?? [],
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (data?.mode === "store") {
    const title = `${data.store.name} · Xtiitch`;
    const description = `Browse and order ${data.store.name}'s designs on Xtiitch — see prices and order online, no account needed.`;
    return [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://store.xtiitch.com/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://store.xtiitch.com/og.png" },
    ];
  }
  const title = "Discover Ghana's fashion studios · Xtiitch";
  const description =
    "Browse Ghanaian fashion studios and their designs, or describe what you want and let AI find it across every shop. Order online — no account needed to look.";
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: "Xtiitch — Ghana's fashion marketplace" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://store.xtiitch.com/" },
    { property: "og:image", content: "https://store.xtiitch.com/og.png" },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: "https://store.xtiitch.com/og.png" },
  ];
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
      />
    );
  }
  return (
    <Marketplace shops={loaderData.shops} sponsored={loaderData.sponsored} />
  );
}
