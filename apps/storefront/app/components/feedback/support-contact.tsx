import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PrivacyTipRounded from "@mui/icons-material/PrivacyTipRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import type { ReactNode } from "react";

// §4 Contact us channels. Emails open the mail client; WhatsApp uses the wa.me
// deep link (the Ghana number in international form, no leading zero).
type ContactChannel = {
  label: string;
  detail: string;
  href: string;
  icon: ReactNode;
};

const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: "Request support",
    detail: "support@xtiitch.com",
    href: "mailto:support@xtiitch.com?subject=Support%20request",
    icon: <SupportAgentRounded />,
  },
  {
    label: "Inquire about billing",
    detail: "billing@xtiitch.com",
    href: "mailto:billing@xtiitch.com?subject=Billing%20enquiry",
    icon: <ReceiptLongRounded />,
  },
  {
    label: "Inquire about privacy",
    detail: "privacy@xtiitch.com",
    href: "mailto:privacy@xtiitch.com?subject=Privacy%20request",
    icon: <PrivacyTipRounded />,
  },
  {
    label: "WhatsApp",
    detail: "0594667183",
    href: "https://wa.me/233594667183",
    icon: <WhatsApp />,
  },
];

// The Contact us channels — email (mailto) and WhatsApp (wa.me).
export function ContactList() {
  return (
    <Stack spacing={1}>
      {CONTACT_CHANNELS.map((channel) => (
        <SupportChoice
          key={channel.label}
          icon={channel.icon}
          title={channel.label}
          helper={channel.detail}
          href={channel.href}
        />
      ))}
    </Stack>
  );
}

// One tappable row in the Support menu / contact list. Renders as a link when
// an href is given (email or WhatsApp), otherwise as a button that switches view.
export function SupportChoice({
  icon,
  title,
  helper,
  onClick,
  href,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  onClick?: () => void;
  href?: string;
}) {
  return (
    <Button
      {...(href
        ? {
            component: "a",
            href,
            target: href.startsWith("http") ? "_blank" : undefined,
            rel: href.startsWith("http") ? "noopener noreferrer" : undefined,
          }
        : { onClick })}
      variant="outlined"
      startIcon={icon}
      fullWidth
      sx={{
        justifyContent: "flex-start",
        textAlign: "left",
        textTransform: "none",
        color: "text.primary",
        borderColor: "divider",
        px: 1.75,
        py: 1.25,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800 }} noWrap>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
          {helper}
        </Typography>
      </Box>
    </Button>
  );
}
