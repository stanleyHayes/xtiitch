import type { ReactNode } from "react";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import CheckroomRoundedIcon from "@mui/icons-material/CheckroomRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";

export type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: ReactNode;
};

export type NavGroup = { label: string; blurb: string; items: NavItem[] };

// Grouped navigation. Keeping the top bar to a couple of rich dropdowns instead
// of a long row of links — each entry carries an icon, a one-line description
// and a soft background decoration.
export const navGroups: NavGroup[] = [
  {
    label: "Discover",
    blurb: "Browse real shops and designs on Xtiitch.",
    items: [
      {
        label: "Shops",
        href: "/shops",
        description: "Verified studios running their storefronts on Xtiitch.",
        icon: <StorefrontRoundedIcon />,
      },
      {
        label: "Designs",
        href: "/designs",
        description: "Browse pieces and order from the studio directly.",
        icon: <CheckroomRoundedIcon />,
      },
    ],
  },
  {
    label: "Platform",
    blurb: "Everything to run a fashion business in one place.",
    items: [
      {
        label: "Features",
        href: "/features",
        description: "Storefront, catalogue, orders, payments and tracking.",
        icon: <Inventory2RoundedIcon />,
      },
      {
        label: "How it works",
        href: "/how-it-works",
        description: "From store setup to taking payment, step by step.",
        icon: <ChecklistRoundedIcon />,
      },
      {
        label: "Pricing",
        href: "/pricing",
        description: "Free to start; a small share only on sales.",
        icon: <LocalOfferRoundedIcon />,
      },
      {
        label: "Growth",
        href: "/growth",
        description: "Promotions, referrals, affiliates and sponsored slots.",
        icon: <TrendingUpRoundedIcon />,
      },
    ],
  },
  {
    label: "Why Xtiitch",
    blurb: "Built for trust, and for the people who buy.",
    items: [
      {
        label: "For customers",
        href: "/for-customers",
        description: "Browse, order and follow “where is my cloth?”.",
        icon: <GroupsRoundedIcon />,
      },
      {
        label: "Security",
        href: "/security",
        description: "Tenant isolation, Paystack payments, no held funds.",
        icon: <SecurityRoundedIcon />,
      },
      {
        label: "FAQ",
        href: "/faq",
        description: "Answers on payments, deposits, refunds and safety.",
        icon: <HelpRoundedIcon />,
      },
    ],
  },
];

export const NAV_WATERMARK_COLORS = ["#800020", "#c58b2c", "#315f8f", "#237a4b"];
