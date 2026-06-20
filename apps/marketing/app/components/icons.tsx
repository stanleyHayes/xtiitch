import type { SvgIconProps } from "@mui/material/SvgIcon";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import CollectionsOutlined from "@mui/icons-material/CollectionsOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import LocalShippingOutlined from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import SavingsOutlined from "@mui/icons-material/SavingsOutlined";
import NotificationsActiveOutlined from "@mui/icons-material/NotificationsActiveOutlined";
import PaletteOutlined from "@mui/icons-material/PaletteOutlined";
import PlaylistAddCheckOutlined from "@mui/icons-material/PlaylistAddCheckOutlined";
import VerifiedUserOutlined from "@mui/icons-material/VerifiedUserOutlined";
import type { ComponentType } from "react";
import type { FeatureIcon } from "../content";

const map: Record<FeatureIcon, ComponentType<SvgIconProps>> = {
  store: StorefrontOutlined,
  catalogue: CollectionsOutlined,
  orders: ReceiptLongOutlined,
  tracking: LocalShippingOutlined,
  payments: PaymentsOutlined,
  bookings: EventAvailableOutlined,
  money: SavingsOutlined,
  notifications: NotificationsActiveOutlined,
  branding: PaletteOutlined,
  waitlist: PlaylistAddCheckOutlined,
  security: VerifiedUserOutlined,
};

export function FeatureGlyph({
  icon,
  ...props
}: { icon: FeatureIcon } & SvgIconProps) {
  const Icon = map[icon];
  return <Icon {...props} />;
}
