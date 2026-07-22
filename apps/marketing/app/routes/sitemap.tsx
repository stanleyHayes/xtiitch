// Resource route: /sitemap.xml — public marketing and legal pages.
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
  "privacy",
  "terms",
  "payment-policy",
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
