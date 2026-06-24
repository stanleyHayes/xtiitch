// Resource route: /sitemap.xml — only the pages that are public at launch.
// The marketplace/browse surfaces (shops, designs, discover) are flag-gated and
// the legal pages (privacy, terms, payment-policy) aren't linked yet, so they're
// intentionally excluded until they go live — no point asking Google to index
// pages we're hiding.
const BASE = "https://xtiitch.com";

const PATHS = [
  "",
  "features",
  "growth",
  "how-it-works",
  "pricing",
  "for-customers",
  "security",
  "faq",
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
