import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import {
  formatGHS,
  type DirectoryDesign,
  type DirectoryShop,
} from "../lib/directory";
import type { SponsoredPlacement } from "../lib/sponsored";

const cardSx = {
  borderRadius: 1,
  border: "1px solid",
  borderColor: "divider",
  bgcolor: "background.paper",
  overflow: "hidden",
  transition: "transform 200ms ease, box-shadow 200ms ease",
  boxShadow: "0 18px 48px -44px rgba(21,17,26,0.42)",
  "&:hover": {
    transform: "translateY(-4px)",
    boxShadow: "0 30px 70px -48px rgba(21,17,26,0.6)",
  },
} as const;

// A brand-coloured swatch used when a design has no image yet.
function Swatch({ color, sx }: { color: string; sx?: object }) {
  return (
    <Box
      aria-hidden
      sx={{
        background: `linear-gradient(135deg, ${color}, ${color}cc 60%, rgba(21,17,26,0.6))`,
        display: "grid",
        placeItems: "center",
        ...sx,
      }}
    >
      <StorefrontRoundedIcon sx={{ color: "rgba(255,255,255,0.5)", fontSize: 30 }} />
    </Box>
  );
}

export function ShopCard({ shop }: { shop: DirectoryShop }) {
  const samples = shop.designs.slice(0, 3);
  return (
    <Box sx={cardSx}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          p: 2.5,
          color: "common.white",
          background: `linear-gradient(135deg, ${shop.brandColor}, ${shop.brandColor}cc)`,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: -40,
            right: -30,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.18), transparent 65%)",
          }}
        />
        <Typography variant="h5" component="h3" sx={{ position: "relative" }}>
          {shop.name}
        </Typography>
        <Typography
          variant="body2"
          sx={{ position: "relative", mt: 0.5, color: "rgba(255,255,255,0.82)" }}
        >
          {shop.handle}.xtiitch.com
        </Typography>
        <Chip
          label={`${shop.designCount} design${shop.designCount === 1 ? "" : "s"}`}
          size="small"
          sx={{
            position: "relative",
            mt: 1.5,
            bgcolor: "rgba(var(--surface-rgb), 0.2)",
            color: "common.white",
            fontWeight: 700,
          }}
        />
      </Box>
      <Box sx={{ p: 2.5 }}>
        {samples.length > 0 ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1,
              mb: 2,
            }}
          >
            {samples.map((design) =>
              design.image ? (
                <Box
                  key={design.handle}
                  component="img"
                  src={design.image}
                  alt={design.title}
                  loading="lazy"
                  sx={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Swatch
                  key={design.handle}
                  color={shop.brandColor}
                  sx={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 1 }}
                />
              ),
            )}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            New studio — pieces coming soon.
          </Typography>
        )}
        <Button
          component="a"
          href={shop.href}
          target="_blank"
          rel="noreferrer"
          variant="contained"
          fullWidth
          endIcon={<ArrowForwardRoundedIcon />}
        >
          Visit storefront
        </Button>
      </Box>
    </Box>
  );
}

export function DesignCard({ design }: { design: DirectoryDesign }) {
  return (
    <Box
      component="a"
      href={design.href}
      target="_blank"
      rel="noreferrer"
      sx={{ ...cardSx, display: "block", textDecoration: "none", color: "inherit" }}
    >
      {design.image ? (
        <Box
          component="img"
          src={design.image}
          alt={design.title}
          loading="lazy"
          sx={{ width: "100%", aspectRatio: "4 / 5", objectFit: "cover", display: "block" }}
        />
      ) : (
        <Swatch color={design.brandColor} sx={{ width: "100%", aspectRatio: "4 / 5" }} />
      )}
      <Box sx={{ p: 2 }}>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontWeight: 800,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {design.shopName}
        </Typography>
        <Typography variant="h6" component="h3" sx={{ mt: 0.5, fontSize: 18 }}>
          {design.title}
        </Typography>
        <Typography sx={{ mt: 0.5, color: "primary.main", fontWeight: 800 }}>
          {formatGHS(design.priceMinor)}
        </Typography>
      </Box>
    </Box>
  );
}

const sponsoredFallback = [
  "/images/atelier-review.webp",
  "/images/payment-handoff.webp",
  "/images/tracking-fitting.webp",
] as const;

export function SponsoredRail({ placements }: { placements: SponsoredPlacement[] }) {
  if (placements.length === 0) {
    return null;
  }
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(300px, 1fr))" },
        gap: 2.5,
      }}
    >
      {placements.map((placement, index) => (
        <Box key={placement.campaignId} sx={{ ...cardSx, display: "flex", flexDirection: "column" }}>
          <Box sx={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden", bgcolor: "secondary.main" }}>
            <Box
              component="img"
              src={placement.imageUrl || sponsoredFallback[index % sponsoredFallback.length]}
              alt=""
              loading="lazy"
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Chip
              label="Sponsored"
              size="small"
              sx={{
                position: "absolute",
                left: 12,
                top: 12,
                borderRadius: 1,
                bgcolor: "rgba(var(--surface-rgb), 0.92)",
                color: "primary.main",
                fontWeight: 800,
              }}
            />
          </Box>
          <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
            <Box>
              <Typography
                sx={{
                  color: "text.secondary",
                  fontWeight: 800,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {placement.businessName}
              </Typography>
              <Typography variant="h6" component="h3" sx={{ mt: 0.5 }}>
                {placement.headline || placement.targetLabel}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: "auto", alignItems: "center" }}>
              <Button
                component="a"
                href={placement.href}
                target="_blank"
                rel="noreferrer sponsored"
                variant="contained"
                size="small"
                endIcon={<ArrowForwardRoundedIcon />}
              >
                Visit
              </Button>
              <Chip
                label={
                  placement.placementType === "promoted_design"
                    ? "Promoted design"
                    : "Featured business"
                }
                size="small"
                variant="outlined"
                sx={{ borderRadius: 1, fontWeight: 700 }}
              />
            </Stack>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
