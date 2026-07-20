import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import StarRounded from "@mui/icons-material/StarRounded";
import type { Design } from "../../lib/api";
import { priceLabel } from "../../lib/format";
import { tokens } from "../../theme";

const fallbackDesignImages = [
  "/images/storefront-atelier-review.webp",
  "/images/storefront-fitting.webp",
  "/images/storefront-atelier-hero.webp",
];

function fallbackDesignImage(design: Design): string {
  const key = design.handle || design.design_id || design.title;
  const index = Array.from(key).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return fallbackDesignImages[index % fallbackDesignImages.length] ?? "";
}

function DesignImage({ design }: { design: Design }) {
  const first = design.images[0];
  if (first) {
    return (
      <CardMedia
        component="img"
        image={first}
        alt={design.title}
        sx={{
          // §10.1.6: the image stays fully visible — fixed aspect, cover,
          // exactly like the marketplace homepage cards.
          aspectRatio: "4 / 5",
          objectFit: "cover",
          width: "100%",
          transition: "transform 260ms ease, filter 260ms ease",
        }}
      />
    );
  }
  return (
    <CardMedia
      component="img"
      image={fallbackDesignImage(design)}
      alt={`Studio preview for ${design.title}`}
      sx={{
        aspectRatio: "4 / 5",
        objectFit: "cover",
        width: "100%",
        filter: "saturate(0.92) contrast(1.02)",
        transition: "transform 260ms ease, filter 260ms ease",
      }}
    />
  );
}

// §10.1: the studio/tenant design card mirrors the marketplace homepage card —
// price as a pill on the image (the "From …" minimum for ranges), the design
// name FIRST below the image, no "View design" icon, no "Size pricing" text,
// and a short clamped description that can never overflow the card.
export function DesignCard({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  design,
  index = 0,
  featured = false,
}: {
  design: Design;
  index?: number;
  featured?: boolean;
}) {
  return (
    <Card
      sx={{
        height: "100%",
        overflow: "hidden",
        borderRadius: 2,
        border: featured ? "1.5px solid" : "1px solid",
        borderColor: (theme) =>
          featured || theme.palette.mode === "dark"
            ? alpha(theme.palette.primary.main, featured ? 0.58 : 0.32)
            : alpha(tokens.ink, 0.08),
        bgcolor: "rgb(var(--surface-rgb))",
        boxShadow: featured
          ? `0 18px 44px ${alpha(tokens.burgundy, 0.16)}`
          : `0 14px 36px ${alpha(tokens.ink, 0.06)}`,
        transition:
          "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
        "@media (prefers-reduced-motion: no-preference)": {
          animation: "storeSurfaceIn 420ms ease both",
          animationDelay: `${Math.min(index, 8) * 40}ms`,
        },
        "&:hover": {
          transform: "translateY(-6px)",
          boxShadow: (theme) =>
            `0 30px 64px ${
              theme.palette.mode === "dark"
                ? alpha("#000000", 0.34)
                : alpha(tokens.ink, 0.16)
            }`,
          borderColor: (theme) => alpha(theme.palette.primary.main, 0.46),
        },
        "&:hover img": {
          transform: "scale(1.06)",
          filter: "saturate(1.02) contrast(1.04)",
        },
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={`/d/${design.handle}`}
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <Box
          sx={{
            position: "relative",
            width: "100%",
            overflow: "hidden",
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
          }}
        >
          <DesignImage design={design} />
          {/* Scrim so the price pill stays legible over any image. */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(to top, ${alpha(tokens.ink, 0.5)} 0%, transparent 40%)`,
            }}
          />
          {featured ? (
            <Box
              sx={{
                position: "absolute",
                top: 12,
                right: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1.25,
                py: 0.4,
                borderRadius: 999,
                bgcolor: tokens.burgundy,
                color: tokens.white,
                boxShadow: `0 6px 16px ${alpha(tokens.burgundy, 0.4)}`,
              }}
            >
              <StarRounded sx={{ fontSize: 13 }} />
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                }}
              >
                Featured
              </Typography>
            </Box>
          ) : null}
          {design.customisation_allowed ? (
            <Box
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                px: 1.25,
                py: 0.4,
                borderRadius: 999,
                bgcolor: "rgba(var(--surface-rgb), 0.92)",
                backdropFilter: "blur(8px)",
                border: "1px solid",
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.common.white, 0.16)
                    : alpha(tokens.ink, 0.08),
                boxShadow: `0 6px 16px ${alpha(tokens.ink, 0.12)}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 215, 224, 0.96)"
                      : tokens.burgundy,
                }}
              >
                Made to measure
              </Typography>
            </Box>
          ) : null}
          {/* §10.1.1: the price replaces the old floating "View design" icon —
              the minimum ("From GHS …") when the design has a price range,
              exactly as on the marketplace homepage. */}
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
              maxWidth: "calc(100% - 20px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {priceLabel(design.prices)}
          </Box>
        </Box>
        <CardContent
          sx={{
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            p: { xs: 1.75, sm: 2 },
            overflow: "hidden",
          }}
        >
          {/* §10.1.2: the design name comes FIRST (font scaled to fit); the
              price no longer leads the text block. */}
          <Typography
            variant="h6"
            sx={{
              fontSize: { xs: 17, sm: 18 },
              fontWeight: 900,
              lineHeight: 1.2,
              color: "text.primary",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {design.title}
          </Typography>
          {/* §10.1.4/5: the excerpt stays short — clamped with an ellipsis,
              contained in the card with no overflow. ("Size pricing" is gone
              for good, §10.1.3.) */}
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.45,
              fontSize: { xs: 12.5, sm: 13.5 },
            }}
          >
            {design.description ||
              "A store-ready piece with order details handled on Xtiitch."}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
