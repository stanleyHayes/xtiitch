import { api } from "../lib/api";

// Resource route: /sitemap.xml — the marketplace, the AI-search page, and every
// public shop's storefront (<handle>.xtiitch.com), so search engines discover
// each studio. Fetched live from the public shops directory.
const MARKETPLACE = "https://store.xtiitch.com";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function loader() {
  const shopsPage = await api.shops();
  const shops = shopsPage?.shops ?? [];

  // Pull each public store once so the sitemap includes its canonical tenant
  // collection and design URLs, not just the studio landing page. A failed store
  // is skipped without taking down the entire sitemap.
  const storePages = await Promise.all(
    shops.map(async (shop) => ({
      shop,
      page: await api.store(shop.handle).catch(() => null),
    })),
  );

  const entries = [
    { loc: MARKETPLACE, priority: "1.0" },
    { loc: `${MARKETPLACE}/discover`, priority: "0.8" },
    ...storePages.flatMap(({ shop, page }) => {
      const origin = `https://${shop.handle}.xtiitch.com`;
      return [
        { loc: origin, priority: "0.8" },
        ...(page?.collections ?? []).map((collection) => ({
          loc: `${origin}/c/${collection.handle}`,
          priority: "0.6",
        })),
        ...(page?.designs ?? []).map((design) => ({
          loc: `${origin}/d/${design.handle}`,
          priority: "0.7",
        })),
      ];
    }),
  ];

  const urls = entries
    .map(
      (e) =>
        `  <url><loc>${esc(e.loc)}</loc><changefreq>weekly</changefreq><priority>${e.priority}</priority></url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
