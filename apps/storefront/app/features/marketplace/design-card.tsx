import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { Link as RouterLink } from "react-router";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import type { FlatDesign } from "./types";
import { designHref } from "./utils";

export function DesignCard({ d }: { d: FlatDesign }) {
  const accent = d.brand_color || tokens.burgundy;
  return (
    <Box
      component={RouterLink}
      to={designHref(d.handle)}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        transition:
          "transform .2s ease, box-shadow .2s ease, border-color .2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 24px 56px ${alpha(tokens.ink, 0.18)}`,
          borderColor: alpha(accent, 0.4),
        },
        "&:hover .design-img": { transform: "scale(1.05)" },
      }}
    >
      <Box sx={{ position: "relative", aspectRatio: "4 / 5", overflow: "hidden" }}>
        <Box
          className="design-img"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: alpha(tokens.ink, 0.05),
            backgroundImage: d.image ? `url(${d.image})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "grid",
            placeItems: "center",
            transition: "transform .45s ease",
          }}
        >
          {!d.image && (
            <StorefrontRounded sx={{ color: alpha(tokens.ink, 0.25), fontSize: 40 }} />
          )}
        </Box>
        {/* Scrim so the price pill stays legible over any image. */}
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, ${alpha(tokens.ink, 0.5)} 0%, transparent 40%)`,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: 10,
            bottom: 10,
            px: 1.25,
            py: 0.4,
            borderRadius: 999,
            bgcolor: tokens.white,
            color: tokens.ink,
            fontWeight: 900,
            fontSize: 13,
            boxShadow: `0 6px 18px ${alpha(tokens.ink, 0.3)}`,
          }}
        >
          {formatGHS(d.price_minor)}
        </Box>
      </Box>
      <Box sx={{ p: 1.75 }}>
        <Typography sx={{ fontWeight: 900, lineHeight: 1.25 }} noWrap>
          {d.title}
        </Typography>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ mt: 0.75, alignItems: "center" }}
        >
          <Box
            aria-hidden
            sx={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              bgcolor: accent,
              color: tokens.white,
              fontSize: 9.5,
              fontWeight: 900,
            }}
          >
            {d.store_name.charAt(0).toUpperCase()}
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
            {d.store_name}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
