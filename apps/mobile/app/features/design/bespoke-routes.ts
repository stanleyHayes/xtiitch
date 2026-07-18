import type {
  AvailabilitySlot,
  CustomSizeMode,
  Design,
  StoreSummary,
} from "../../../src/api";

// Bespoke deposit: the design's own override wins, else the store default
// (mirrors resolveDepositMinor in apps/storefront/app/features/design/utils.ts).
export function resolveDepositMinor(
  design: Design,
  store: StoreSummary,
): number {
  return design.deposit_override_minor ?? store.default_deposit_minor;
}

export type BespokeRoute = {
  mode: CustomSizeMode;
  title: string;
  helper: string;
  enabled: boolean;
  disabledReason?: string;
  buttonLabel: string;
};

// Ports apps/storefront/app/features/design/bespoke-routes.tsx: same enabled
// rules, disabled reasons, and button copy — only the MUI icons are dropped.
export function bespokeRoutes(
  store: StoreSummary,
  depositLabel: string,
  visitSlots: AvailabilitySlot[],
): BespokeRoute[] {
  const routes: BespokeRoute[] = [
    {
      mode: "self_measure",
      title: "Self-measure",
      helper: `Send the fit details you already have and pay the ${depositLabel} bespoke deposit.`,
      enabled:
        store.settings.measurements_enabled &&
        store.measurement_fields.length > 0,
      disabledReason: !store.settings.measurements_enabled
        ? "Self-measure is not enabled for this store yet."
        : "This store needs to add measurement fields first.",
      buttonLabel: "Pay bespoke deposit",
    },
    {
      mode: "home_visit",
      title: "Home visit",
      helper: `Pick an open visit slot, pay the ${depositLabel} deposit, then the store captures measurements at the address.`,
      enabled: visitSlots.length > 0,
      disabledReason:
        "No home-visit slots are open for the next four weeks. Try self-measure or come to the shop.",
      buttonLabel: "Pay visit deposit",
    },
    {
      mode: "come_to_shop",
      title: "Come to the shop",
      helper:
        "Reserve the request now, then visit the store for measurement and payment arrangements.",
      enabled: true,
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
