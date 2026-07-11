import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import { tokens } from "../../theme";
import { priceLabel } from "../../lib/format";
import type { Design, DesignVariation } from "../../lib/api";

export function Gallery({
  design,
  images: variationImages,
}: {
  design: Design;
  images: string[];
}) {
  const fallback = "/images/storefront-atelier-review.webp";
  const images = variationImages.length > 0 ? variationImages : [fallback];
  const [cover, setCover] = useState(images[0] ?? fallback);
  const hasUploadedCover = variationImages.includes(cover);
  return (
    <Box sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.08),
          boxShadow: `0 24px 70px ${alpha(tokens.ink, 0.12)}`,
          bgcolor: "background.paper",
        }}
      >
        <Box
          component="img"
          src={cover}
          alt={
            hasUploadedCover
              ? design.title
              : `Studio preview for ${design.title}`
          }
          sx={{
            width: "100%",
            aspectRatio: "4 / 5",
            objectFit: "cover",
            display: "block",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: "auto 0 0",
            height: "34%",
            background: `linear-gradient(0deg, ${alpha(tokens.ink, 0.52)}, transparent)`,
          }}
        />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 14,
            flexWrap: "wrap",
          }}
        >
          <Chip
            icon={<CreditCardRounded />}
            label={priceLabel(design.prices)}
            sx={{
              bgcolor: "rgba(var(--surface-rgb), 0.92)",
              color: "text.primary",
              fontWeight: 900,
              backdropFilter: "blur(10px)",
              "& .MuiChip-icon": { color: tokens.burgundy },
            }}
          />
          {design.customisation_allowed ? (
            <Chip
              icon={<StraightenRounded />}
              label="Custom fit available"
              sx={{
                bgcolor: alpha(tokens.ink, 0.78),
                color: tokens.white,
                fontWeight: 900,
                backdropFilter: "blur(10px)",
                "& .MuiChip-icon": { color: tokens.white },
              }}
            />
          ) : null}
        </Stack>
      </Box>
      {images.length > 1 ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {images.slice(0, 5).map((src, index) => {
            const selected = src === cover;
            return (
              <Box
                key={src}
                component="button"
                type="button"
                onClick={() => setCover(src)}
                aria-label={`Show ${design.title} image ${index + 1}`}
                sx={{
                  width: 72,
                  height: 90,
                  p: 0,
                  border: "2px solid",
                  borderColor: selected ? tokens.burgundy : "transparent",
                  bgcolor: "transparent",
                  cursor: "pointer",
                  borderRadius: 1.5,
                  overflow: "hidden",
                  boxShadow: selected
                    ? `0 0 0 3px ${alpha(tokens.burgundy, 0.14)}`
                    : "none",
                }}
              >
                <Box
                  component="img"
                  src={src}
                  alt=""
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      ) : null}
    </Box>
  );
}

export const DEFAULT_SWATCH_ID = "__default__";
export const GALLERY_FALLBACK = "/images/storefront-atelier-review.webp";

export type ColourSwatch = {
  id: string;
  label: string;
  thumb: string;
  images: string[];
};

// Builds the colour-swatch list: the design's own photos as the first ("default")
// swatch, then each non-default variation ordered by sequence. Variations share
// the design's price and order flow; only the gallery images differ.
export function buildSwatches(design: Design): ColourSwatch[] {
  const base: ColourSwatch = {
    id: DEFAULT_SWATCH_ID,
    label: "Original",
    thumb: design.images[0] ?? GALLERY_FALLBACK,
    images: design.images,
  };
  const variations = (design.variations ?? [])
    .filter((variation) => !variation.is_default)
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((variation: DesignVariation) => ({
      id: variation.variation_id,
      label: variation.name,
      thumb: variation.images[0] ?? design.images[0] ?? GALLERY_FALLBACK,
      images: variation.images.length > 0 ? variation.images : design.images,
    }));
  return [base, ...variations];
}

export function ColourVariations({
  swatches,
  activeId,
  onSelect,
  brand,
}: {
  swatches: ColourSwatch[];
  activeId: string;
  onSelect: (id: string) => void;
  brand: string;
}) {
  // Nothing to switch between when the design only has its default images.
  if (swatches.length <= 1) {
    return null;
  }
  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 900 }}>
        Colour variations
      </Typography>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ flexWrap: "wrap", rowGap: 1.25 }}
      >
        {swatches.map((swatch) => {
          const selected = swatch.id === activeId;
          return (
            <Stack
              key={swatch.id}
              spacing={0.5}
              sx={{ alignItems: "center", width: 72 }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => onSelect(swatch.id)}
                aria-label={`Show ${swatch.label} images`}
                aria-pressed={selected}
                sx={{
                  width: 72,
                  height: 90,
                  p: 0,
                  border: "2px solid",
                  borderColor: selected ? brand : alpha(tokens.ink, 0.12),
                  bgcolor: "transparent",
                  cursor: "pointer",
                  borderRadius: 1.5,
                  overflow: "hidden",
                  boxShadow: selected
                    ? `0 0 0 3px ${alpha(brand, 0.16)}`
                    : "none",
                }}
              >
                <Box
                  component="img"
                  src={swatch.thumb}
                  alt=""
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    objectFit: "cover",
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                noWrap
                sx={{
                  maxWidth: 72,
                  fontWeight: selected ? 900 : 600,
                  color: selected ? "text.primary" : "text.secondary",
                }}
              >
                {swatch.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
