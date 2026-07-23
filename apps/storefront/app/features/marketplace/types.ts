export type Tab = "studios" | "designs";

export type SortKey = "popular" | "name" | "price_low" | "price_high";

export type FlatDesign = {
  title: string;
  handle: string;
  style_category?: string;
  image: string;
  price_minor: number;
  store_name: string;
  store_handle: string;
  brand_color: string;
};
