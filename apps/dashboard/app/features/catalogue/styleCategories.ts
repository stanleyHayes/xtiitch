export const styleCategories = [
  {
    slug: "wedding_guest",
    label: "Wedding guest",
    helper: "Elegant event looks",
  },
  {
    slug: "kente_adire",
    label: "Kente & Adire",
    helper: "Heritage weaves and prints",
  },
  { slug: "menswear", label: "Menswear", helper: "Sharp tailored pieces" },
  {
    slug: "ready_to_wear",
    label: "Ready to wear",
    helper: "Everyday pieces shoppers can buy now",
  },
  {
    slug: "accessories",
    label: "Accessories",
    helper: "Finishing touches and add-ons",
  },
  { slug: "bridal", label: "Bridal", helper: "Wedding and ceremony looks" },
] as const;

export type StyleCategorySlug = (typeof styleCategories)[number]["slug"];
