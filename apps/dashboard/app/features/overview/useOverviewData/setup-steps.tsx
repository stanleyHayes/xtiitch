import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import PriceCheckRounded from "@mui/icons-material/PriceCheckRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import type {
  AvailabilityWindow,
  MeasurementField,
  SetupStep,
  SizeBand,
  StoreSettings,
} from "../../shared/types";

export function buildSetupSteps({
  profile,
  activeDesigns,
  cataloguePriceCount,
  activeStoreSettings,
  measurementFields,
  availabilityWindows,
  activeTeamUsers,
  sizeBands,
  storeSettings,
}: {
  profile: { verification_status: string; payout_ready?: boolean };
  activeDesigns: number;
  cataloguePriceCount: number;
  activeStoreSettings: number;
  measurementFields: MeasurementField[];
  availabilityWindows: AvailabilityWindow[];
  activeTeamUsers: number;
  sizeBands: SizeBand[];
  storeSettings: StoreSettings;
}): SetupStep[] {
  const verified = profile.verification_status === "verified";
  return [
    {
      label: "Business verified",
      helper: verified
        ? "Store can operate with the verified business profile."
        : "Verification is still pending before customers can fully trust checkout.",
      href: "/dashboard/settings",
      done: verified,
      icon: <VerifiedUserRounded fontSize="small" />,
    },
    {
      label: "Payouts set up",
      helper: (profile.payout_ready ?? false)
        ? "Your mobile money is linked — customers can pay and money reaches you."
        : "Add your mobile money number so customers can check out and pay you.",
      href: "/dashboard/settings#payouts",
      done: profile.payout_ready ?? false,
      icon: <PaymentsRounded fontSize="small" />,
    },
    {
      label: "Catalogue live",
      helper:
        activeDesigns > 0
          ? `${activeDesigns} active storefront pieces are available.`
          : "Add at least one active design with imagery.",
      href: "/dashboard/catalogue",
      done: activeDesigns > 0,
      icon: <DesignServicesRounded fontSize="small" />,
    },
    {
      label: "Checkout pricing",
      helper:
        cataloguePriceCount > 0
          ? `${cataloguePriceCount} design prices are configured.`
          : "Add size bands and prices before standard checkout feels complete.",
      href: "/dashboard/catalogue",
      done: sizeBands.length > 0 && cataloguePriceCount > 0,
      icon: <PriceCheckRounded fontSize="small" />,
    },
    {
      label: "Request paths",
      helper:
        activeStoreSettings > 0
          ? `${activeStoreSettings} storefront switches are enabled.`
          : "Turn on the customer request paths this business accepts.",
      href: "/dashboard/settings",
      done: activeStoreSettings > 0,
      icon: <SettingsRounded fontSize="small" />,
    },
    {
      label: "Measurements",
      helper:
        measurementFields.length > 0
          ? `${measurementFields.length} measurement fields are ready for staff.`
          : "Define the fitting fields staff record on orders.",
      href: "/dashboard/measurements",
      done:
        !storeSettings.measurements_enabled || measurementFields.length > 0,
      icon: <StraightenRounded fontSize="small" />,
    },
    {
      label: "Visit availability",
      helper:
        availabilityWindows.length > 0
          ? `${availabilityWindows.length} visit windows are configured.`
          : "Add appointment windows for home visit and fitting work.",
      href: "/dashboard/availability",
      done: availabilityWindows.length > 0,
      icon: <CalendarMonthRounded fontSize="small" />,
    },
    {
      label: "Team access",
      helper:
        activeTeamUsers > 1
          ? `${activeTeamUsers} active users can operate the workspace.`
          : "Invite at least one admin or staff account for daily operations.",
      href: "/dashboard/team",
      done: activeTeamUsers > 1,
      icon: <PeopleAltRounded fontSize="small" />,
    },
  ];
}
