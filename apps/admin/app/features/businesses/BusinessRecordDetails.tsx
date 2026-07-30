import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import AlternateEmailRounded from "@mui/icons-material/AlternateEmailRounded";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import FingerprintRounded from "@mui/icons-material/FingerprintRounded";
import GppMaybeRounded from "@mui/icons-material/GppMaybeRounded";
import LinkRounded from "@mui/icons-material/LinkRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import ToggleOnRounded from "@mui/icons-material/ToggleOnRounded";
import UpdateRounded from "@mui/icons-material/UpdateRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import type { AdminBusiness } from "../../lib/api";
import { tokens } from "../../theme";
import { DetailLine } from "../shared/DetailLine";
import { shortID, shortTimeOrFallback } from "../shared/dates";
import { formatOwnerPhone, phoneHref, whatsAppHref } from "./ownerContact";

function labelStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ContactDetail({
  label,
  value,
  href,
  icon,
}: {
  label: string;
  value: string;
  href?: string;
  icon: ReactNode;
}) {
  const display = value || "Not set";
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 74,
        p: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        borderRadius: 1.5,
        bgcolor: "rgba(var(--surface-rgb), 0.62)",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 38,
          height: 38,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          color: tokens.burgundy,
          bgcolor: alpha(tokens.burgundy, 0.08),
          "& .MuiSvgIcon-root": { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            color: "text.secondary",
            fontWeight: 800,
            letterSpacing: 0.35,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Typography>
        {href && display !== "Not set" ? (
          <Link
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            underline="hover"
            sx={{
              mt: 0.45,
              display: "inline-block",
              fontWeight: 900,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
              color: tokens.burgundy,
            }}
          >
            {display}
          </Link>
        ) : (
          <Typography
            variant="body2"
            sx={{ mt: 0.45, fontWeight: 900, overflowWrap: "anywhere" }}
          >
            {display}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function OwnerContacts({ business }: { business: AdminBusiness }) {
  const phone = formatOwnerPhone(business.ownerPhone);
  const whatsapp = formatOwnerPhone(business.ownerWhatsApp);
  return (
    <Stack spacing={1.25}>
      <Typography variant="h6">Owner contacts</Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        Use these when following up on verification or payout setup.
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <DetailLine
          label="Owner name"
          value={business.ownerName || "Not set"}
          icon={<BadgeRounded />}
        />
        <ContactDetail
          label="Email"
          value={business.ownerEmail || "Not set"}
          icon={<AlternateEmailRounded />}
          href={
            business.ownerEmail.includes("@")
              ? `mailto:${business.ownerEmail}`
              : undefined
          }
        />
        <ContactDetail
          label="Phone"
          value={phone}
          icon={<PhoneRounded />}
          href={phoneHref(business.ownerPhone)}
        />
        <ContactDetail
          label="WhatsApp"
          value={whatsapp}
          icon={<WhatsApp />}
          href={whatsAppHref(business.ownerWhatsApp)}
        />
      </Box>
    </Stack>
  );
}

export function BusinessRecord({ business }: { business: AdminBusiness }) {
  return (
    <Stack spacing={1.25}>
      <Typography variant="h6">Business record</Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        }}
      >
        <DetailLine
          label="Business ID"
          value={shortID(business.id)}
          icon={<FingerprintRounded />}
        />
        <DetailLine
          label="Handle"
          value={`${business.handle}.xtiitch.com`}
          icon={<LinkRounded />}
        />
        <DetailLine
          label="Verification"
          value={labelStatus(business.verificationStatus)}
          icon={<VerifiedUserRounded />}
        />
        <DetailLine
          label="Operational status"
          value={labelStatus(business.operationalStatus)}
          icon={<ToggleOnRounded />}
        />
        <DetailLine
          label="Plan"
          value={business.plan}
          icon={<WorkspacePremiumRounded />}
        />
        <DetailLine
          label="Risk"
          value={labelStatus(business.riskLevel)}
          icon={<GppMaybeRounded />}
        />
        <DetailLine
          label="Subaccount"
          value={business.subaccountRef || "Not provisioned"}
          icon={<AccountBalanceRounded />}
        />
        <DetailLine
          label="Created"
          value={shortTimeOrFallback(business.createdAt)}
          icon={<CalendarMonthRounded />}
        />
        <DetailLine
          label="Updated"
          value={shortTimeOrFallback(business.updatedAt)}
          icon={<UpdateRounded />}
        />
        {business.suspensionReason ? (
          <DetailLine
            label="Suspension reason"
            value={business.suspensionReason}
            icon={<GppMaybeRounded />}
          />
        ) : null}
        {business.suspendedAt ? (
          <DetailLine
            label="Suspended at"
            value={shortTimeOrFallback(business.suspendedAt)}
            icon={<CalendarMonthRounded />}
          />
        ) : null}
      </Box>
    </Stack>
  );
}
