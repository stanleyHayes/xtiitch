import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import BoltRounded from "@mui/icons-material/BoltRounded";
import { Link as RouterLink } from "react-router";
import { tokens } from "../../theme";
import type { SponsoredPlacement } from "../../lib/api";
import { storeHref } from "./utils";

export function FeaturedCard({ p }: { p: SponsoredPlacement }) {
  return (
    <Box
      component={RouterLink}
      to={storeHref(p.store_handle || p.business_handle)}
      sx={{
        position: "relative",
        display: "block",
        textDecoration: "none",
        color: tokens.white,
        minWidth: { xs: 260, sm: 300 },
        flex: "0 0 auto",
        height: 200,
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.gold, 0.4),
        backgroundImage: p.image_url
          ? `linear-gradient(180deg, ${alpha(tokens.ink, 0.1)}, ${alpha(tokens.ink, 0.86)}), url(${p.image_url})`
          : `linear-gradient(135deg, ${tokens.wine}, ${tokens.ink})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "transform .2s ease, box-shadow .2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 22px 60px ${alpha(tokens.ink, 0.3)}`,
        },
      }}
    >
      <Chip
        size="small"
        icon={<BoltRounded sx={{ fontSize: 14, color: `${tokens.ink} !important` }} />}
        label="Featured"
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          fontWeight: 950,
          letterSpacing: 0.3,
          bgcolor: tokens.gold,
          color: tokens.ink,
          "& .MuiChip-label": { px: 0.75 },
        }}
      />
      <Box sx={{ position: "absolute", inset: 0, p: 1.75, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <Typography variant="caption" sx={{ fontWeight: 800, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {p.business_name}
        </Typography>
        <Typography sx={{ fontWeight: 950, lineHeight: 1.15, fontSize: 18 }} noWrap>
          {p.headline || p.target_label || "Discover the collection"}
        </Typography>
      </Box>
    </Box>
  );
}
