import type { MetaDescriptor } from "react-router";

const FALLBACK_ORIGIN = "https://store.xtiitch.com";

export type StorefrontSeo = {
  title: string;
  description: string;
  canonicalURL: string;
  imageURL?: string;
  imageAlt?: string;
  type?: "website" | "product";
};

function absoluteImageURL(canonicalURL: string, imageURL?: string): string {
  if (imageURL?.startsWith("https://") || imageURL?.startsWith("http://")) {
    return imageURL;
  }
  try {
    const origin = new URL(canonicalURL).origin;
    return `${origin}${imageURL ?? "/og.png"}`;
  } catch {
    return `${FALLBACK_ORIGIN}${imageURL ?? "/og.png"}`;
  }
}

export function storefrontMeta({
  title,
  description,
  canonicalURL,
  imageURL,
  imageAlt,
  type = "website",
}: StorefrontSeo): MetaDescriptor[] {
  const image = absoluteImageURL(canonicalURL, imageURL);
  const alt = imageAlt ?? title;
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalURL },
    { property: "og:type", content: type },
    { property: "og:site_name", content: "Xtiitch" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonicalURL },
    { property: "og:image", content: image },
    { property: "og:image:secure_url", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: alt },
  ];
}

// JSON-LD is rendered inside a script tag. Escaping '<' prevents API-managed
// names/descriptions from closing that tag while preserving valid JSON.
export function structuredDataJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
