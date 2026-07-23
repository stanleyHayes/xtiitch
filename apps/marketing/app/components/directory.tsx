import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
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

// Featured placements get a distinctly more pronounced, premium treatment than the
// regular directory cards: a gold accent border + warm glow, a top accent bar, and
// a "Featured" badge, so paid/featured studios visibly stand apart from the grid.
const featuredCardSx = {
  borderRadius: 1.5,
  border: "1.5px solid",
  borderColor: (theme: Theme) =>
    theme.palette.mode === "dark"
      ? "rgba(214,162,74,0.6)"
      : "rgba(197,139,44,0.55)",
  bgcolor: "background.paper",
  overflow: "hidden",
  position: "relative",
  transition: "transform 220ms ease, box-shadow 220ms ease",
  boxShadow: (theme: Theme) =>
    theme.palette.mode === "dark"
      ? "0 26px 64px -38px rgba(214,162,74,0.5)"
      : "0 26px 64px -34px rgba(197,139,44,0.45)",
  "&::before": {
    content: '""',
    position: "absolute",
    insetInline: 0,
    top: 0,
    height: 4,
    zIndex: 2,
    background: (theme: Theme) =>
      `linear-gradient(90deg, ${theme.palette.mode === "dark" ? "#d6a24a" : "#c58b2c"}, ${theme.palette.primary.main})`,
  },
  "&:hover": {
    transform: "translateY(-6px)",
    boxShadow: (theme: Theme) =>
      theme.palette.mode === "dark"
        ? "0 38px 84px -40px rgba(214,162,74,0.62)"
        : "0 38px 84px -38px rgba(197,139,44,0.58)",
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
  "/images/directory-craft.webp",
  "/images/directory-adire.webp",
  "/images/directory-fitting.webp",
  "/images/directory-accessories.webp",
] as const;

export function SponsoredRail({ placements }: { placements: SponsoredPlacement[] }) {
  if (placements.length === 0) {
    return null;
  }
  return (
    <Box
      sx={{
        display: "grid",
        // With a single featured studio, auto-fit collapses the empty tracks and
        // stretches the lone card to full width (its 16/9 image then dominates the
        // page). Cap that case to a normal featured-card width; keep the responsive
        // grid for two or more.
        gridTemplateColumns: {
          xs: "1fr",
          md:
            placements.length === 1
              ? "minmax(0, 460px)"
              : "repeat(auto-fit, minmax(300px, 1fr))",
        },
        gap: 2.5,
      }}
    >
      {placements.map((placement, index) => (
        <Box
          key={placement.campaignId}
          sx={{ ...featuredCardSx, display: "flex", flexDirection: "column" }}
        >
          <Box sx={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden", bgcolor: "secondary.main" }}>
            <Box
              component="img"
              src={placement.imageUrl || sponsoredFallback[index % sponsoredFallback.length]}
              alt=""
              loading="lazy"
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(21,17,26,0) 45%, rgba(21,17,26,0.55) 100%)",
              }}
            />
            <Chip
              icon={<AutoAwesomeRoundedIcon />}
              label="Featured"
              size="small"
              sx={{
                position: "absolute",
                left: 12,
                top: 12,
                borderRadius: 1,
                fontWeight: 900,
                letterSpacing: "0.02em",
                color: "#1c1206",
                background: (theme: Theme) =>
                  `linear-gradient(135deg, ${theme.palette.mode === "dark" ? "#e7b85f" : "#d9a83f"}, ${theme.palette.mode === "dark" ? "#c58b2c" : "#b97f25"})`,
                boxShadow: "0 8px 20px -10px rgba(197,139,44,0.7)",
                "& .MuiChip-icon": { color: "#1c1206", fontSize: 15 },
              }}
            />
          </Box>
          <Box sx={{ p: 2.75, display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
            <Box>
              <Typography
                sx={{
                  color: (theme: Theme) =>
                    theme.palette.mode === "dark" ? "#d6a24a" : "#a8741f",
                  fontWeight: 900,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {placement.businessName}
              </Typography>
              <Typography
                variant="h5"
                component="h3"
                sx={{ mt: 0.5, lineHeight: 1.15 }}
              >
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
                    : "Featured studio"
                }
                size="small"
                variant="outlined"
                sx={{
                  borderRadius: 1,
                  fontWeight: 800,
                  borderColor: (theme: Theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(214,162,74,0.5)"
                      : "rgba(197,139,44,0.5)",
                  color: (theme: Theme) =>
                    theme.palette.mode === "dark" ? "#d6a24a" : "#a8741f",
                }}
              />
            </Stack>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
