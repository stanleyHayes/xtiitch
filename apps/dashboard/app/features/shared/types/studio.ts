import type { DesignVariation } from "../../../lib/api";
import type { SizeChartItem } from "./orders";

export type CollectionSummary = {
  collection_id: string;
  name: string;
  theme: string;
  handle: string;
  status: string;
  sequence: number;
};

export type SizeBand = {
  size_band_id: string;
  label: string;
  chart: SizeChartItem[];
  sequence: number;
};

export type DesignSizeBandOverride = {
  size_band_id: string;
  label: string | null;
  chart: SizeChartItem[];
  chart_set: boolean;
};

export type DesignExtrasData = {
  variations?: DesignVariation[];
  overrides?: DesignSizeBandOverride[];
  ok?: boolean;
  error?: string;
};
