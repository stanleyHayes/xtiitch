export const styleCategories = [
  {
    slug: "wedding_guest",
    label: "Wedding guest",
    helper: "Elegant looks",
    query: "wedding guest",
    image: "/images/style-wedding-guest.webp",
  },
  {
    slug: "kente_adire",
    label: "Kente & Adire",
    helper: "Heritage weaves",
    query: "kente adire",
    image: "/images/style-kente-adire.webp",
  },
  {
    slug: "menswear",
    label: "Menswear",
    helper: "Sharp & modern",
    query: "menswear men shirt kaftan",
    image: "/images/style-menswear.webp",
  },
  {
    slug: "ready_to_wear",
    label: "Ready to wear",
    helper: "Everyday styles",
    query: "ready to wear ready casual everyday",
    image: "/images/style-ready-to-wear.webp",
  },
  {
    slug: "accessories",
    label: "Accessories",
    helper: "Finishing touches",
    query: "accessories",
    image: "/images/style-accessories.webp",
  },
  {
    slug: "bridal",
    label: "Bridal",
    helper: "Timeless beauty",
    query: "bridal wedding bride",
    image: "/images/style-bridal.webp",
  },
] as const;

export type StyleCategorySlug = (typeof styleCategories)[number]["slug"];

export function styleLabelFor(slug?: string): string {
  return styleCategories.find((category) => category.slug === slug)?.label ?? "";
}
