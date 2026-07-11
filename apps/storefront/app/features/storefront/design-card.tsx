import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
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
          aspectRatio: { xs: "5 / 4", sm: "4 / 5" },
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
        aspectRatio: { xs: "5 / 4", sm: "4 / 5" },
        objectFit: "cover",
        width: "100%",
        filter: "saturate(0.92) contrast(1.02)",
        transition: "transform 260ms ease, filter 260ms ease",
      }}
    />
  );
}

export function DesignCard({
  design,
  index = 0,
  featured = false,
}: {
  design: Design;
  index?: number;
  featured?: boolean;
}) {
  const priced = design.prices.length > 0;
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
        "&:hover .design-reveal": {
          opacity: 1,
          transform: "translateY(0)",
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
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(180deg, ${alpha(tokens.ink, 0)} 54%, ${alpha(tokens.ink, 0.46)} 100%)`,
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
          <Box
            className="design-reveal"
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              p: 1.5,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
              opacity: { xs: 1, md: 0 },
              transform: { md: "translateY(10px)" },
              transition: "opacity 240ms ease, transform 240ms ease",
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                px: 1.75,
                py: 0.85,
                borderRadius: 999,
                bgcolor: "rgba(var(--surface-rgb), 0.96)",
                color: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 215, 224, 0.96)"
                    : tokens.burgundy,
                fontWeight: 800,
                fontSize: 13,
                boxShadow: `0 12px 28px ${alpha(tokens.ink, 0.24)}`,
              }}
            >
              View design
              <ArrowForwardRounded sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </Box>
        <CardContent
          sx={{
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.85,
            p: { xs: 2, sm: 2.25 },
          }}
        >
          <Stack
            direction="row"
            sx={{
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: { xs: 19, sm: 18 },
                fontWeight: 800,
                color: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 146, 173, 0.98)"
                    : tokens.burgundy,
                letterSpacing: "0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {priceLabel(design.prices)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 247, 242, 0.68)"
                    : alpha(tokens.ink, 0.56),
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {priced ? "Size pricing" : "Request quote"}
            </Typography>
          </Stack>
          <Box
            aria-hidden
            sx={{
              height: "1px",
              backgroundImage: (theme) =>
                theme.palette.mode === "dark"
                  ? `linear-gradient(90deg, ${alpha(theme.palette.warning.main, 0.72)}, ${alpha(theme.palette.common.white, 0.1)} 42%)`
                  : `linear-gradient(90deg, ${alpha("#c58b2c", 0.65)}, ${alpha(tokens.ink, 0.08)} 40%)`,
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontSize: { xs: 22, sm: 21 },
              lineHeight: 1.06,
              color: "text.primary",
              mt: 0.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {design.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.5,
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
