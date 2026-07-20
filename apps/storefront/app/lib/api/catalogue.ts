import { enc, getJSON, type TenantScope } from "./core";
import type {
  AvailabilityPage,
  CollectionPage,
  Design,
  PublicShopsPage,
  SearchPage,
  SponsoredPage,
  StorePage,
} from "./types";

export const store = (handle: string, tenant?: TenantScope) =>
  getJSON<StorePage>(`/public/stores/${enc(handle)}`, tenant);

export const design = (handle: string, tenant?: TenantScope) =>
  getJSON<Design>(`/public/designs/${enc(handle)}`, tenant);

export const collection = (handle: string, tenant?: TenantScope) =>
  getJSON<CollectionPage>(`/public/collections/${enc(handle)}`, tenant);

export const search = (handle: string, query: string, tenant?: TenantScope) =>
  getJSON<SearchPage>(
    `/public/stores/${enc(handle)}/search?q=${enc(query)}`,
    tenant,
  );

export const availability = (
  handle: string,
  range?: { from?: string; to?: string },
  tenant?: TenantScope,
) => {
  const params = new URLSearchParams();
  if (range?.from) {
    params.set("from", range.from);
  }
  if (range?.to) {
    params.set("to", range.to);
  }
  const query = params.toString();
  return getJSON<AvailabilityPage>(
    `/public/stores/${enc(handle)}/availability${query ? `?${query}` : ""}`,
    tenant,
  );
};

// shops/sponsored are deliberately tenant-less: they are cross-store discovery
// endpoints that only the marketplace may call — on a tenant host the §6
// middleware 404s them, so tenant hosts must not call them at all.
export const shops = () => getJSON<PublicShopsPage>(`/public/shops`);

export const sponsored = (limit = 8) =>
  getJSON<SponsoredPage>(`/public/sponsored?limit=${limit}`);
