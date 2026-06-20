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

  const entries = [
    { loc: MARKETPLACE, priority: "1.0" },
    { loc: `${MARKETPLACE}/discover`, priority: "0.8" },
    ...shops.map((s) => ({
      loc: `https://${s.handle}.xtiitch.com`,
      priority: "0.7",
    })),
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
