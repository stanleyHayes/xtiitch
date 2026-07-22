import assert from "node:assert/strict";
import test from "node:test";
import { storefrontMeta, structuredDataJSON } from "./seo";

test("storefrontMeta emits canonical Open Graph and Twitter descriptors", () => {
  const meta = storefrontMeta({
    title: "Kente dress · Xtiitch",
    description: "A hand-finished kente dress.",
    canonicalURL: "https://kwadwo.xtiitch.com/d/kente-dress",
    imageURL: "https://images.example/kente.jpg",
    imageAlt: "Kente dress by Kwadwo Couture",
    type: "product",
  });

  assert.deepEqual(
    meta.find((item) => "rel" in item && item.rel === "canonical"),
    {
      tagName: "link",
      rel: "canonical",
      href: "https://kwadwo.xtiitch.com/d/kente-dress",
    },
  );
  assert.ok(
    meta.some(
      (item) =>
        "property" in item &&
        item.property === "og:type" &&
        item.content === "product",
    ),
  );
  assert.ok(
    meta.some(
      (item) =>
        "name" in item &&
        item.name === "twitter:image" &&
        item.content === "https://images.example/kente.jpg",
    ),
  );
});

test("storefrontMeta resolves the shared card on a tenant origin", () => {
  const meta = storefrontMeta({
    title: "Kwadwo Couture · Xtiitch",
    description: "Browse the store.",
    canonicalURL: "https://kwadwo.xtiitch.com/",
  });
  assert.ok(
    meta.some(
      (item) =>
        "property" in item &&
        item.property === "og:image" &&
        item.content === "https://kwadwo.xtiitch.com/og.png",
    ),
  );
});

test("structuredDataJSON cannot terminate its script tag", () => {
  const output = structuredDataJSON({ name: "</script><script>alert(1)</script>" });
  assert.equal(output.includes("</script>"), false);
  assert.match(output, /\\u003c\/script>/);
});
