import AccountBalanceWalletRounded from "@mui/icons-material/AccountBalanceWalletRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import ContactPhoneRounded from "@mui/icons-material/ContactPhoneRounded";
import DesignServicesRounded from "@mui/icons-material/DesignServicesRounded";
import InsightsRounded from "@mui/icons-material/InsightsRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import QueryStatsRounded from "@mui/icons-material/QueryStatsRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import TimelineRounded from "@mui/icons-material/TimelineRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { tokens } from "../../theme";
import { WorkspaceNavItem, DashboardSection, WorkspaceNavGroup, DashboardPageMeta } from "../shared/types";

export const managementWorkspaceNav: WorkspaceNavItem[] = [
  {
    href: "/dashboard",
    section: "overview",
    label: "Overview",
    helper: "Studio pulse",
    icon: <TuneRounded />,
  },
  {
    href: "/dashboard/reports",
    section: "reports",
    label: "Reports",
    helper: "Revenue signals",
    icon: <QueryStatsRounded />,
  },
  {
    href: "/dashboard/analytics",
    section: "analytics",
    label: "Analytics",
    helper: "Plan-tiered insight",
    icon: <InsightsRounded />,
  },
  {
    href: "/dashboard/orders",
    section: "orders",
    label: "Orders",
    helper: "Production board",
    icon: <TimelineRounded />,
  },
  {
    href: "/dashboard/money",
    section: "money",
    label: "Money",
    helper: "Tracked income",
    icon: <AccountBalanceWalletRounded />,
  },
  {
    href: "/dashboard/customers",
    section: "customers",
    label: "Customers",
    helper: "Auto-built CRM",
    icon: <ContactPhoneRounded />,
  },
  {
    href: "/dashboard/visits",
    section: "visits",
    label: "Visits",
    helper: "Fitting queue",
    icon: <CalendarMonthRounded />,
  },
  {
    href: "/dashboard/handovers",
    section: "handovers",
    label: "Handovers",
    helper: "Pickup delivery",
    icon: <LocalShippingRounded />,
  },
  {
    href: "/dashboard/catalogue",
    section: "catalogue",
    label: "Catalogue",
    helper: "Storefront pieces",
    icon: <DesignServicesRounded />,
  },
  {
    href: "/dashboard/measurements",
    section: "measurements",
    label: "Measurements",
    helper: "Fitting setup",
    icon: <StraightenRounded />,
  },
  {
    href: "/dashboard/availability",
    section: "availability",
    label: "Availability",
    helper: "Visit hours",
    icon: <ScheduleRounded />,
  },
  {
    href: "/dashboard/settings",
    section: "settings",
    label: "Settings",
    helper: "Store switches",
    icon: <SettingsRounded />,
  },
  {
    href: "/dashboard/team",
    section: "team",
    label: "Team",
    helper: "Access roles",
    icon: <PeopleAltRounded />,
  },
  {
    href: "/dashboard/messages",
    section: "messages",
    label: "Messages",
    helper: "Customer outbox",
    icon: <NotificationsRounded />,
  },
];

export const staffWorkspaceNav: WorkspaceNavItem[] = [
  {
    href: "/dashboard",
    section: "tasks",
    label: "Tasks",
    helper: "Shift queue",
    icon: <TuneRounded />,
  },
  {
    href: "/dashboard/orders",
    section: "orders",
    label: "Orders",
    helper: "Stage movement",
    icon: <TimelineRounded />,
  },
  {
    href: "/dashboard/visits",
    section: "visits",
    label: "Visits",
    helper: "Fitting queue",
    icon: <CalendarMonthRounded />,
  },
  {
    href: "/dashboard/handovers",
    section: "handovers",
    label: "Handovers",
    helper: "Pickup delivery",
    icon: <LocalShippingRounded />,
  },
  {
    href: "/dashboard/messages",
    section: "messages",
    label: "Messages",
    helper: "Customer outbox",
    icon: <NotificationsRounded />,
  },
];

export function workspaceNavItem(
  items: WorkspaceNavItem[],
  section: DashboardSection,
): WorkspaceNavItem {
  const item = items.find((candidate) => candidate.section === section);
  if (!item) {
    throw new Error(`Missing dashboard nav item: ${section}`);
  }
  return item;
}

export function workspaceNavItems(
  items: WorkspaceNavItem[],
  sections: DashboardSection[],
): WorkspaceNavItem[] {
  return sections.map((section) => workspaceNavItem(items, section));
}

export const managementWorkspaceGroups: WorkspaceNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <TuneRounded />,
    items: workspaceNavItems(managementWorkspaceNav, ["overview"]),
  },
  {
    id: "operations",
    label: "Operations",
    icon: <TimelineRounded />,
    items: workspaceNavItems(managementWorkspaceNav, [
      "orders",
      "money",
      "customers",
      "visits",
      "handovers",
      "messages",
    ]),
  },
  {
    id: "storefront",
    label: "Storefront",
    icon: <StorefrontRounded />,
    items: workspaceNavItems(managementWorkspaceNav, ["catalogue"]),
  },
  {
    id: "setup",
    label: "Setup",
    icon: <SettingsRounded />,
    items: workspaceNavItems(managementWorkspaceNav, [
      "measurements",
      "availability",
      "settings",
      "team",
    ]),
  },
  {
    id: "command",
    label: "Command",
    icon: <TuneRounded />,
    items: workspaceNavItems(managementWorkspaceNav, ["reports", "analytics"]),
  },
];

export const staffWorkspaceGroups: WorkspaceNavGroup[] = [
  {
    id: "shift",
    label: "Shift work",
    icon: <TuneRounded />,
    items: workspaceNavItems(staffWorkspaceNav, ["tasks", "orders"]),
  },
  {
    id: "customers",
    label: "Customer flow",
    icon: <PeopleAltRounded />,
    items: workspaceNavItems(staffWorkspaceNav, [
      "visits",
      "handovers",
      "messages",
    ]),
  },
];

export function dashboardPageMeta(section: DashboardSection): DashboardPageMeta { // eslint-disable-line complexity -- per-section meta switch; the §14/§15 cases extend it
  switch (section) {
    case "tasks":
      return {
        eyebrow: "Shift desk",
        title: "Task queue",
        helper:
          "The work staff can safely move today: fittings, visits, production stages, handovers, and message checks.",
        icon: <TuneRounded />,
        tone: tokens.success,
      };
    case "reports":
      return {
        eyebrow: "Reports",
        title: "Studio performance snapshot",
        helper:
          "Read revenue movement, collection health, production status, and follow-up pressure without digging through every order.",
        icon: <QueryStatsRounded />,
        tone: tokens.info,
      };
    case "analytics":
      return {
        eyebrow: "Analytics",
        title: "Store analytics",
        helper:
          "Totals, trends, breakdowns and exports — depth ladders with your plan, and every gated tier says what upgrade unlocks it.",
        icon: <InsightsRounded />,
        tone: tokens.gold,
      };
    case "customers":
      return {
        eyebrow: "CRM",
        title: "Customer list",
        helper:
          "Every customer who orders lands here automatically — call or WhatsApp them, review their orders and measurements, and annotate by plan.",
        icon: <ContactPhoneRounded />,
        tone: tokens.info,
      };
    case "orders":
      return {
        eyebrow: "Production",
        title: "Order board",
        helper:
          "Filter live work, capture measurements, and move confirmed garments through the studio in clear stages.",
        icon: <TimelineRounded />,
        tone: tokens.burgundy,
      };
    case "money":
      return {
        eyebrow: "Money",
        title: "Money desk",
        helper:
          "Track platform payments, manual takings, commission, and net income while keeping funds outside Xtiitch.",
        icon: <AccountBalanceWalletRounded />,
        tone: tokens.success,
      };
    case "visits":
      return {
        eyebrow: "Appointments",
        title: "Visit queue",
        helper:
          "Manage held and booked home visits, keep customers updated, and protect the shop calendar.",
        icon: <CalendarMonthRounded />,
        tone: tokens.info,
      };
    case "handovers":
      return {
        eyebrow: "Fulfilment",
        title: "Handover desk",
        helper:
          "Arrange pickup and delivery work for finished garments, then close the customer loop cleanly.",
        icon: <LocalShippingRounded />,
        tone: tokens.warning,
      };
    case "catalogue":
      return {
        eyebrow: "Storefront",
        title: "Design studio",
        helper:
          "Publish, retire, and refresh the designs customers see before they order or request custom work.",
        icon: <DesignServicesRounded />,
        tone: tokens.burgundy,
      };
    case "measurements":
      return {
        eyebrow: "Fittings",
        title: "Measurement setup",
        helper:
          "Define the fields staff use for visit, shop, and self-measurement flows so order records stay consistent.",
        icon: <StraightenRounded />,
        tone: tokens.info,
      };
    case "availability":
      return {
        eyebrow: "Calendar",
        title: "Visit hours",
        helper:
          "Set the appointment windows customers can book and keep fitting capacity realistic.",
        icon: <ScheduleRounded />,
        tone: tokens.gold,
      };
    case "settings":
      return {
        eyebrow: "Storefront setup",
        title: "Store switches",
        helper:
          "Control what customers can request, which services appear, and how your public store is branded.",
        icon: <SettingsRounded />,
        tone: tokens.burgundy,
      };
    case "team":
      return {
        eyebrow: "Access",
        title: "Team permissions",
        helper:
          "Create admin and staff accounts, keep inactive people out, and see who can manage the studio.",
        icon: <PeopleAltRounded />,
        tone: tokens.info,
      };
    case "messages":
      return {
        eyebrow: "Outbox",
        title: "Message log",
        helper:
          "Review order, payment, booking, and handover notifications so customer communication stays accountable.",
        icon: <NotificationsRounded />,
        tone: tokens.burgundy,
      };
    case "overview":
    default:
      return {
        eyebrow: "Control room",
        title: "Studio command center",
        helper:
          "Spot the studio decisions that need attention first, then move into the room that needs action.",
        icon: <TuneRounded />,
        tone: tokens.burgundy,
      };
  }
}