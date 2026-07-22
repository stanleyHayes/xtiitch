import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router";
import type { PublicShop } from "../../lib/api";
import { tokens } from "../../theme";
import { storeHref } from "./utils";

// eslint-disable-next-line complexity -- image and featured variants share one marketplace card
export function StudioCard({
  shop,
  featured = false,
  promoted = false,
}: {
  shop: PublicShop;
  featured?: boolean;
  promoted?: boolean;
}) {
  const accent = shop.brand_color || tokens.burgundy;
  const image =
    shop.banner_url ||
    shop.designs.find((design) => Boolean(design.image))?.image ||
    (featured
      ? "/images/storefront-atelier-review.webp"
      : "/images/storefront-fitting.webp");

  return (
    <Box
      component={RouterLink}
      to={storeHref(shop.handle)}
      sx={{
        position: "relative",
        display: "flex",
        minHeight: featured ? { xs: 390, md: 464 } : { xs: 300, md: 224 },
        height: "100%",
        overflow: "hidden",
        borderRadius: 1.5,
        textDecoration: "none",
        color: tokens.white,
        backgroundImage: `url(${image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.12),
        boxShadow: `0 14px 34px ${alpha(tokens.ink, 0.1)}`,
        transition: "transform .22s ease, box-shadow .22s ease",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          bgcolor: "rgba(12, 8, 10, 0.3)",
          transition: "background-color .22s ease",
        },
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 24px 54px ${alpha(tokens.ink, 0.2)}`,
        },
        "&:hover::before": { bgcolor: "rgba(12, 8, 10, 0.42)" },
        "&:hover .studio-arrow": { transform: "translateX(3px)" },
      }}
    >
      {promoted ? (
        <Chip
          size="small"
          label="Featured"
          sx={{
            position: "absolute",
            zIndex: 2,
            top: 14,
            left: 14,
            bgcolor: tokens.burgundy,
            color: tokens.white,
            fontWeight: 850,
          }}
        />
      ) : null}

      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          position: "relative",
          zIndex: 1,
          mt: "auto",
          width: "100%",
          alignItems: "flex-end",
          p: featured ? { xs: 2, md: 2.5 } : 1.65,
          bgcolor: "rgba(12, 8, 10, 0.74)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Box
          sx={{
            width: featured ? 72 : 54,
            height: featured ? 72 : 54,
            flexShrink: 0,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: accent,
            border: "1px solid rgba(255,255,255,.72)",
            color: tokens.white,
            fontFamily: '"Fraunces", serif',
            fontSize: featured ? 27 : 20,
            fontWeight: 850,
          }}
        >
          {shop.name.trim().charAt(0).toUpperCase()}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: featured ? 21 : 17,
              fontWeight: 900,
              lineHeight: 1.15,
            }}
            noWrap
          >
            {shop.name}
          </Typography>
          <Typography
            variant="body2"
            sx={{ mt: 0.4, color: alpha(tokens.white, 0.78) }}
          >
            {shop.design_count} {shop.design_count === 1 ? "design" : "designs"}{" "}
            · Shop the studio
          </Typography>
        </Box>
        <Box
          className="studio-arrow"
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: tokens.white,
            color: tokens.burgundy,
            transition: "transform .18s ease",
          }}
        >
          <ArrowForwardRounded fontSize="small" />
        </Box>
      </Stack>
    </Box>
  );
}
