import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import Inventory2Rounded from "@mui/icons-material/Inventory2Rounded";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router";
import type { PublicShop } from "../../lib/api";
import { tokens } from "../../theme";
import { storeHref } from "./utils";

export function StudioCard({
  shop,
  promoted = false,
}: {
  shop: PublicShop;
  promoted?: boolean;
}) {
  const accent = shop.brand_color || tokens.burgundy;
  const designImages = shop.designs
    .filter((design) => Boolean(design.image))
    .slice(0, 3);

  return (
    <Box
      component={RouterLink}
      to={storeHref(shop.handle)}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        borderRadius: 1.5,
        textDecoration: "none",
        color: "text.primary",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.12),
        boxShadow: `0 14px 34px ${alpha(tokens.ink, 0.1)}`,
        transition: "transform .22s ease, box-shadow .22s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 24px 54px ${alpha(tokens.ink, 0.2)}`,
        },
        "&:hover .studio-arrow": { transform: "translateX(3px)" },
      }}
    >
      <Box
        sx={{
          height: 88,
          flexShrink: 0,
          bgcolor: accent,
          backgroundImage: shop.banner_url
            ? `linear-gradient(${alpha(tokens.ink, 0.28)}, ${alpha(tokens.ink, 0.28)}), url(${shop.banner_url})`
            : `linear-gradient(135deg, ${alpha(tokens.white, 0.14)}, transparent 66%)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {promoted ? (
        <Chip
          size="small"
          label="Featured"
          sx={{
            position: "absolute",
            zIndex: 2,
            top: 12,
            right: 12,
            bgcolor: tokens.burgundy,
            color: tokens.white,
            fontWeight: 850,
          }}
        />
      ) : null}

      <Box sx={{ position: "relative", flex: 1, px: 2, pt: 4.25, pb: 2 }}>
        <Box
          sx={{
            position: "absolute",
            top: -28,
            left: 18,
            width: 56,
            height: 56,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: accent,
            border: "3px solid",
            borderColor: "background.paper",
            boxShadow: `0 8px 20px ${alpha(tokens.ink, 0.18)}`,
            color: tokens.white,
            fontFamily: '"Fraunces", serif',
            fontSize: 21,
            fontWeight: 850,
          }}
        >
          {shop.name.trim().charAt(0).toUpperCase()}
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{ fontSize: 18, fontWeight: 900, lineHeight: 1.15 }}
              noWrap
            >
              {shop.name}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.25, color: "text.secondary" }}
            >
              {shop.design_count}{" "}
              {shop.design_count === 1 ? "design" : "designs"}
            </Typography>
          </Box>
          <Box
            className="studio-arrow"
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              color: tokens.burgundy,
              bgcolor: alpha(tokens.burgundy, 0.08),
              transition: "transform .18s ease",
            }}
          >
            <ArrowForwardRounded fontSize="small" />
          </Box>
        </Stack>

        <DesignPreview designs={designImages} />
      </Box>
    </Box>
  );
}

function DesignPreview({ designs }: { designs: PublicShop["designs"] }) {
  if (!designs.length) {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mt: 1.5,
          minHeight: 64,
          px: 1.25,
          alignItems: "center",
          color: "text.secondary",
          borderRadius: 1,
          bgcolor: alpha(tokens.burgundy, 0.045),
        }}
      >
        <Inventory2Rounded fontSize="small" />
        <Typography variant="caption">Catalogue coming soon</Typography>
      </Stack>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 0.75,
        mt: 1.5,
        minHeight: 64,
      }}
    >
      {designs.map((design) => (
        <Box
          key={design.handle}
          component="img"
          src={design.image}
          alt={design.title}
          sx={{
            width: "100%",
            aspectRatio: "1 / 1",
            objectFit: "cover",
            borderRadius: 1,
            bgcolor: alpha(tokens.ink, 0.05),
          }}
        />
      ))}
    </Box>
  );
}
