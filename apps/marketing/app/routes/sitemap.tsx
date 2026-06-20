// Resource route: /sitemap.xml — the marketing site's public pages.
const BASE = "https://xtiitch.com";

const PATHS = [
  "",
  "shops",
  "designs",
  "discover",
  "features",
  "growth",
  "how-it-works",
  "pricing",
  "for-customers",
  "security",
  "faq",
  "privacy",
  "terms",
  "payment-policy",
  "contact",
];

export function loader() {
  const urls = PATHS.map((p) => {
    const loc = p ? `${BASE}/${p}` : BASE;
    const priority = p === "" ? "1.0" : "0.7";
    return `  <url><loc>${loc}</loc><changefreq>weekly</changefreq><priority>${priority}</priority></url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
