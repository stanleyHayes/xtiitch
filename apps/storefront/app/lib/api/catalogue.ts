import { enc, getJSON } from "./core";
import type {
  AvailabilityPage,
  CollectionPage,
  Design,
  PublicShopsPage,
  SearchPage,
  SponsoredPage,
  StorePage,
} from "./types";

export const store = (handle: string) =>
  getJSON<StorePage>(`/public/stores/${enc(handle)}`);

export const design = (handle: string) =>
  getJSON<Design>(`/public/designs/${enc(handle)}`);

export const collection = (handle: string) =>
  getJSON<CollectionPage>(`/public/collections/${enc(handle)}`);

export const search = (handle: string, query: string) =>
  getJSON<SearchPage>(`/public/stores/${enc(handle)}/search?q=${enc(query)}`);

export const availability = (
  handle: string,
  range?: { from?: string; to?: string },
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
  );
};

export const shops = () => getJSON<PublicShopsPage>(`/public/shops`);

export const sponsored = (limit = 8) =>
  getJSON<SponsoredPage>(`/public/sponsored?limit=${limit}`);
