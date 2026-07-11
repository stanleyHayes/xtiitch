import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router";
import type { PublicShop } from "../../lib/api";
import { tokens } from "../../theme";
import { storeHref } from "./utils";

export function StudioCard({ shop }: { shop: PublicShop }) {
  const accent = shop.brand_color || tokens.burgundy;
  return (
    <Box
      component={RouterLink}
      to={storeHref(shop.handle)}
      sx={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 20px 50px ${alpha(tokens.ink, 0.14)}`,
          borderColor: alpha(accent, 0.45),
        },
      }}
    >
      <Box
        sx={{
          height: 96,
          backgroundImage: shop.banner_url
            ? `url(${shop.banner_url})`
            : `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.55)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <Box sx={{ p: 1.75, pt: 1.25 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", mt: -3.5, mb: 1 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              bgcolor: accent,
              color: tokens.white,
              fontWeight: 950,
              border: "2px solid rgb(var(--surface-rgb))",
              flexShrink: 0,
            }}
          >
            {shop.name.trim().charAt(0).toUpperCase()}
          </Box>
        </Stack>
        <Typography sx={{ fontWeight: 950, lineHeight: 1.2 }} noWrap>
          {shop.name}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1.25 }}>
          {shop.design_count} {shop.design_count === 1 ? "design" : "designs"}
        </Typography>
        <Stack direction="row" spacing={0.75}>
          {shop.designs.slice(0, 3).map((d) => (
            <Box
              key={d.handle}
              sx={{
                flex: 1,
                aspectRatio: "1 / 1",
                borderRadius: "8px",
                bgcolor: alpha(tokens.ink, 0.05),
                backgroundImage: d.image ? `url(${d.image})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))}
          {shop.designs.length === 0 &&
            [0, 1, 2].map((i) => (
              <Box key={i} sx={{ flex: 1, aspectRatio: "1 / 1", borderRadius: "8px", bgcolor: alpha(tokens.ink, 0.05) }} />
            ))}
        </Stack>
      </Box>
    </Box>
  );
}
