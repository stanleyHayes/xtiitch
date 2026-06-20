// Resource route: /robots.txt — allow crawling and point at the sitemap.
export function loader() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    "Sitemap: https://xtiitch.com/sitemap.xml",
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
