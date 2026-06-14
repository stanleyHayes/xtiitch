import type { MetaDescriptor } from "react-router";

// Update to the real domain before public launch.
const BASE_URL = "https://xtiitch.com";
const BRAND = "Xtiitch";

export type PageSeo = {
  title: string;
  description: string;
  path: string;
  /** When true the brand name is not appended (used by the home page). */
  rootTitle?: boolean;
};

export function pageMeta({
  title,
  description,
  path,
  rootTitle,
}: PageSeo): MetaDescriptor[] {
  const fullTitle = rootTitle ? title : `${title} · ${BRAND}`;
  const url = `${BASE_URL}${path}`;

  return [
    { title: fullTitle },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
  ];
}
