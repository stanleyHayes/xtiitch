// Resource route: /robots.txt — allow crawling the marketplace + every shop, and
// point at the sitemap (served on the marketplace host).
export function loader() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "Sitemap: https://store.xtiitch.com/sitemap.xml",
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
