import { request } from "./businessApi";

export type CatalogueDesign = {
  design_id: string;
  collection_id: string | null;
  title: string;
  description: string;
  style_category: string;
  images: string[];
  customisation_allowed: boolean;
  deposit_override_minor: number | null;
  bespoke_display_minor: number;
  handle: string;
  status: "active" | "retired" | string;
  sequence: number;
  prices?: { size_band_id: string; label: string; price_minor: number }[];
  variations?: DesignVariation[];
};

export type DesignVariation = {
  variation_id: string;
  name: string;
  images: string[];
  is_default: boolean;
  sequence: number;
};

export type CatalogueCollection = {
  collection_id: string;
  name: string;
  theme: string;
  handle: string;
  status: "active" | "retired" | string;
  sequence: number;
};

export type StoreSettings = {
  bespoke_enabled: boolean;
  measurements_enabled: boolean;
  customisation_enabled: boolean;
  collections_enabled: boolean;
  delivery_enabled: boolean;
  dispatch_enabled: boolean;
  fee_pass_xtiitch_fee: boolean;
  fee_pass_tax: boolean;
  fee_pass_paystack_fee: boolean;
  brand_color: string;
  logo_url: string;
  banner_url: string;
  layout_variant: string;
};

export type DesignInput = {
  collection_id: string | null;
  title: string;
  description: string;
  style_category: string;
  images: string[];
  customisation_allowed: boolean;
  deposit_override_minor: number | null;
  bespoke_display_minor: number;
  sequence: number;
};
export type DeliveryZoneSetting = {
  zone_id: string;
  name: string;
  fee_minor: number;
  sequence: number;
  active: boolean;
};

export const businessCatalogueApi = {
  designs: () => request<{ designs: CatalogueDesign[] }>("/designs"),
  design: (designId: string) =>
    request<CatalogueDesign>(`/designs/${encodeURIComponent(designId)}`),
  createDesign: (input: DesignInput) =>
    request<{ design_id: string }>("/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateDesign: (designId: string, input: DesignInput) =>
    request<null>(`/designs/${encodeURIComponent(designId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  setPrice: (designId: string, sizeBandId: string, priceMinor: number) =>
    request<null>(
      `/designs/${encodeURIComponent(designId)}/prices/${encodeURIComponent(sizeBandId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_minor: priceMinor }),
      },
    ),
  createVariation: (
    designId: string,
    input: Omit<DesignVariation, "variation_id">,
  ) =>
    request<{ variation_id: string }>(
      `/designs/${encodeURIComponent(designId)}/variations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  updateVariation: (
    designId: string,
    variationId: string,
    input: Omit<DesignVariation, "variation_id">,
  ) =>
    request<null>(
      `/designs/${encodeURIComponent(designId)}/variations/${encodeURIComponent(variationId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    ),
  deleteVariation: (designId: string, variationId: string) =>
    request<null>(
      `/designs/${encodeURIComponent(designId)}/variations/${encodeURIComponent(variationId)}`,
      { method: "DELETE" },
    ),
  reorderVariations: (designId: string, orderedIds: string[]) =>
    request<null>(
      `/designs/${encodeURIComponent(designId)}/variations/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      },
    ),
  collections: () =>
    request<{ collections: CatalogueCollection[] }>("/collections"),
  createCollection: (input: {
    name: string;
    theme: string;
    sequence: number;
  }) =>
    request<{ collection_id: string }>("/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateCollection: (
    collectionId: string,
    input: { name: string; theme: string; sequence: number },
  ) =>
    request<null>(`/collections/${encodeURIComponent(collectionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  retireCollection: (collectionId: string) =>
    request<null>(`/collections/${encodeURIComponent(collectionId)}/retire`, {
      method: "POST",
    }),
  restoreCollection: (collectionId: string) =>
    request<null>(`/collections/${encodeURIComponent(collectionId)}/restore`, {
      method: "POST",
    }),
  deleteCollection: (collectionId: string) =>
    request<null>(`/collections/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
    }),
  settings: () => request<StoreSettings>("/store-settings"),
  updateSettings: (settings: StoreSettings) =>
    request<StoreSettings>("/store-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }),
  deliveryZones: () =>
    request<{ zones: DeliveryZoneSetting[] }>("/delivery-zones"),
  createDeliveryZone: (input: Omit<DeliveryZoneSetting, "zone_id">) =>
    request<{ zone_id: string }>("/delivery-zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateDeliveryZone: (
    id: string,
    input: Omit<DeliveryZoneSetting, "zone_id">,
  ) =>
    request<{ status: string }>(`/delivery-zones/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  deleteDeliveryZone: (id: string) =>
    request<null>(`/delivery-zones/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  retireDesign: (designId: string) =>
    request<null>(`/designs/${encodeURIComponent(designId)}/retire`, {
      method: "POST",
    }),
  restoreDesign: (designId: string) =>
    request<null>(`/designs/${encodeURIComponent(designId)}/restore`, {
      method: "POST",
    }),
  deleteDesign: (designId: string) =>
    request<null>(`/designs/${encodeURIComponent(designId)}`, {
      method: "DELETE",
    }),
};
