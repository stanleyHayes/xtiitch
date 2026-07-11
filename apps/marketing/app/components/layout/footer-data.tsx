import type { ReactNode } from "react";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import PrivacyTipRoundedIcon from "@mui/icons-material/PrivacyTipRounded";

export const footerGroups: {
  heading: string;
  icon: ReactNode;
  links: {
    label: string;
    href: string;
    icon: ReactNode;
    // Legal pages aren't ready for public review, so the labels stay but must
    // not navigate to their (unreviewed) routes yet.
    nonNavigating?: boolean;
  }[];
}[] = [
  {
    heading: "Product",
    icon: <StorefrontRoundedIcon />,
    links: [
      { label: "Features", href: "/features", icon: <Inventory2RoundedIcon /> },
      { label: "Growth", href: "/growth", icon: <TrendingUpRoundedIcon /> },
      {
        label: "How it works",
        href: "/how-it-works",
        icon: <ChecklistRoundedIcon />,
      },
      { label: "Pricing", href: "/pricing", icon: <LocalOfferRoundedIcon /> },
    ],
  },
  {
    heading: "For people",
    icon: <GroupsRoundedIcon />,
    links: [
      {
        label: "For customers",
        href: "/for-customers",
        icon: <GroupsRoundedIcon />,
      },
      { label: "FAQ", href: "/faq", icon: <HelpRoundedIcon /> },
    ],
  },
  {
    heading: "Trust",
    icon: <SecurityRoundedIcon />,
    links: [
      { label: "Security", href: "/security", icon: <SecurityRoundedIcon /> },
      {
        label: "Join the waitlist",
        href: "/contact",
        icon: <MailRoundedIcon />,
      },
    ],
  },
  {
    heading: "Legal",
    icon: <ArticleRoundedIcon />,
    links: [
      {
        label: "Privacy",
        href: "/privacy",
        icon: <PrivacyTipRoundedIcon />,
        nonNavigating: true,
      },
      {
        label: "Terms",
        href: "/terms",
        icon: <ArticleRoundedIcon />,
        nonNavigating: true,
      },
      {
        label: "Payment policy",
        href: "/payment-policy",
        icon: <PaymentsRoundedIcon />,
        nonNavigating: true,
      },
    ],
  },
];

export const footerProof: { label: string; icon: ReactNode }[] = [
  { label: "Branded storefront", icon: <StorefrontRoundedIcon /> },
  { label: "Growth programmes", icon: <CampaignRoundedIcon /> },
  { label: "Paystack payments", icon: <PaymentsRoundedIcon /> },
  { label: "Order tracking", icon: <TimelineRoundedIcon /> },
];
