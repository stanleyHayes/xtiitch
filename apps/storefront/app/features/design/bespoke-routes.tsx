import type { ReactNode } from "react";
import HomeWorkRounded from "@mui/icons-material/HomeWorkRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { AvailabilitySlot, CustomSizeMode, StoreSummary } from "../../lib/api";

export type CustomRoute = {
  mode: CustomSizeMode;
  title: string;
  helper: string;
  icon: ReactNode;
  enabled: boolean;
  disabledReason?: string;
  takesPayment: boolean;
  showMeasurements: boolean;
  buttonLabel: string;
};

export function customRoutes(
  store: StoreSummary,
  depositLabel: string,
  visitSlots: AvailabilitySlot[],
): CustomRoute[] {
  const measurementFields = store.measurement_fields;

  const routes: CustomRoute[] = [
    {
      mode: "self_measure",
      title: "Self-measure",
      helper: `Send the fit details you already have and pay the ${depositLabel} bespoke deposit.`,
      icon: <StraightenRounded />,
      enabled:
        store.settings.measurements_enabled && measurementFields.length > 0,
      disabledReason: !store.settings.measurements_enabled
        ? "Self-measure is not enabled for this store yet."
        : "This store needs to add measurement fields first.",
      takesPayment: true,
      showMeasurements: true,
      buttonLabel: "Pay bespoke deposit",
    },
    {
      mode: "home_visit",
      title: "Home visit",
      helper: `Pick an open visit slot, pay the ${depositLabel} deposit, then the store captures measurements at the address.`,
      icon: <HomeWorkRounded />,
      enabled: visitSlots.length > 0,
      disabledReason:
        "No home-visit slots are open for the next four weeks. Try self-measure or come to the shop.",
      takesPayment: true,
      showMeasurements: false,
      buttonLabel: "Pay visit deposit",
    },
    {
      mode: "come_to_shop",
      title: "Come to the shop",
      helper:
        "Reserve the request now, then visit the store for measurement and payment arrangements.",
      icon: <StorefrontRounded />,
      enabled: true,
      takesPayment: false,
      showMeasurements: false,
      buttonLabel: "Reserve shop measurement",
    },
  ];

  // Online ordering is a paid plan benefit; without it every custom route is
  // closed and customers are pointed to the shop directly.
  if (store.online_ordering_enabled === false) {
    return routes.map((route) => ({
      ...route,
      enabled: false,
      disabledReason: `${store.name} isn't taking online orders here yet — reach out to the shop directly.`,
    }));
  }

  return routes;
}
