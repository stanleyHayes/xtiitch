import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { tokens } from "../../theme";
import type { AdminBusiness } from "../../lib/api";
import { formatGHS } from "../shared/formatting";
import { shortTimeOrFallback } from "../shared/dates";
import { statusColor } from "../shared/colors";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { formatOwnerPhone } from "./ownerContact";

// A directory row intentionally keeps its responsive desktop/mobile hierarchy
// together so the scan order remains obvious during visual maintenance.
// eslint-disable-next-line max-lines-per-function
export function BusinessDirectoryItem({
  business,
  isLast,
  onOpen,
}: {
  business: AdminBusiness;
  isLast: boolean;
  onOpen: () => void;
}) {
  const accent = statusColor(business.status);
  const phone = formatOwnerPhone(business.ownerPhone);
  const whatsapp = formatOwnerPhone(business.ownerWhatsApp);
  const contactLine = [
    phone !== "Not set" ? phone : null,
    whatsapp !== "Not set" ? `WhatsApp ${whatsapp}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      sx={{
        width: "100%",
        position: "relative",
        p: { xs: 2, md: 2.5 },
        display: "grid",
        gridTemplateColumns: {
          xs: "auto minmax(0, 1fr) auto",
          md: "auto minmax(260px, 1.45fr) minmax(150px, .65fr) minmax(150px, .65fr) minmax(130px, .55fr) auto",
        },
        gap: { xs: 1.25, md: 1.75 },
        alignItems: "center",
        border: 0,
        borderBottom: isLast ? 0 : "1px solid",
        borderColor: "divider",
        bgcolor: "transparent",
        color: "text.primary",
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        transition: "background-color 180ms ease, transform 180ms ease",
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 12,
          bottom: 12,
          width: 3,
          borderRadius: "0 4px 4px 0",
          bgcolor: alpha(accent, 0.7),
        },
        "&:hover": {
          bgcolor: alpha(tokens.burgundy, 0.045),
          "& .business-arrow": { transform: "translateX(3px)" },
        },
        "&:active": { transform: "scale(.997)" },
        "&:focus-visible": {
          outline: `2px solid ${alpha(tokens.burgundy, 0.45)}`,
          outlineOffset: -2,
        },
      }}
    >
      <Box
        sx={{
          width: 50,
          height: 50,
          borderRadius: 1.75,
          display: "grid",
          placeItems: "center",
          bgcolor: alpha(accent, 0.12),
          color: accent,
          flexShrink: 0,
          fontSize: 20,
          fontWeight: 900,
        }}
      >
        {business.name.trim().charAt(0).toUpperCase() || "B"}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 16, md: 17 } }}>
            {business.name}
          </Typography>
          <StatusChip status={business.status} />
        </Stack>
        <Typography
          variant="body2"
          sx={{
            mt: 0.35,
            color: "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {business.ownerName} · {business.ownerEmail}
        </Typography>
        {contactLine ? (
          <Typography
            variant="caption"
            sx={{
              mt: 0.45,
              display: "block",
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contactLine}
          </Typography>
        ) : null}
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ mt: 0.85, display: { xs: "flex", md: "none" }, flexWrap: "wrap" }}
        >
          <Chip size="small" label={business.plan} variant="outlined" />
          <Chip
            size="small"
            variant="outlined"
            label={`GMV ${formatGHS(business.gmvMinor)}`}
          />
        </Stack>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
          Setup
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.2, fontWeight: 800 }}>
          {business.verificationStatus === "verified"
            ? "Identity verified"
            : "Verification pending"}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {business.subaccountRef ? "Payout ready" : "No payout account"}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
          Performance
        </Typography>
        <Typography sx={{ mt: 0.2, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
          {formatGHS(business.gmvMinor)}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {business.orders} {business.orders === 1 ? "order" : "orders"}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 800 }}>
          Last active
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.2, fontWeight: 800 }}>
          {shortTimeOrFallback(business.lastActive, "Unknown")}
        </Typography>
        <RiskChip level={business.riskLevel} />
      </Box>

      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "flex-end" }}
      >
        <ArrowForwardRounded
          className="business-arrow"
          sx={{ color: tokens.burgundy, transition: "transform 180ms ease" }}
        />
      </Stack>
    </Box>
  );
}
