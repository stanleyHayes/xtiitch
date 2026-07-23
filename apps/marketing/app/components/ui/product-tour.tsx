import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useThemeMode } from "../../theme-mode";

type ProductTourShot = {
  eyebrow: string;
  title: string;
  body: string;
  desktopImage: string;
  mobileImage: string;
  darkDesktopImage: string;
  darkMobileImage: string;
  alt: string;
  capabilities: string[];
};

const productTourShots: ProductTourShot[] = [
  {
    eyebrow: "Discover",
    title: "A marketplace built around Ghanaian fashion",
    body: "Customers can browse studios and designs, explore by style, search naturally and move straight into a store.",
    desktopImage: "/images/product-tour/marketplace-desktop.jpg",
    mobileImage: "/images/product-tour/marketplace-mobile.jpg",
    darkDesktopImage: "/images/product-tour/marketplace-dark-desktop.jpg",
    darkMobileImage: "/images/product-tour/marketplace-dark-mobile.jpg",
    alt: "Xtiitch marketplace showing studio discovery, style categories and AI-assisted search",
    capabilities: ["Studio discovery", "Style filters", "AI-assisted search"],
  },
  {
    eyebrow: "Sell",
    title: "A real storefront for every fashion business",
    body: "Each store gets a public catalogue, its own identity, fit routes, checkout, delivery choices and order tracking.",
    desktopImage: "/images/product-tour/storefront-desktop.jpg",
    mobileImage: "/images/product-tour/storefront-mobile.jpg",
    darkDesktopImage: "/images/product-tour/storefront-dark-desktop.jpg",
    darkMobileImage: "/images/product-tour/storefront-dark-mobile.jpg",
    alt: "Xtiitch branded store page showing its hero, catalogue and ordering journey",
    capabilities: ["Brand controls", "Fit routes", "Checkout and delivery"],
  },
  {
    eyebrow: "Follow",
    title: "One calm place for every customer order",
    body: "Customers can retry or close an unpaid order, see production progress, contact the store and confirm receipt.",
    desktopImage: "/images/product-tour/customer-account-desktop.jpg",
    mobileImage: "/images/product-tour/customer-account-mobile.jpg",
    darkDesktopImage:
      "/images/product-tour/customer-account-dark-desktop.jpg",
    darkMobileImage: "/images/product-tour/customer-account-dark-mobile.jpg",
    alt: "Xtiitch customer account experience for signing in and following orders",
    capabilities: ["Order history", "Payment retry", "Live progress"],
  },
];

function ScreenshotFrame({
  shot,
  featured = false,
}: {
  shot: ProductTourShot;
  featured?: boolean;
}) {
  const { isDark } = useThemeMode();
  const desktopImage = isDark ? shot.darkDesktopImage : shot.desktopImage;
  const mobileImage = isDark ? shot.darkMobileImage : shot.mobileImage;

  return (
    <Box
      sx={{
        overflow: "hidden",
        border: "1px solid",
        borderColor: isDark
          ? "rgba(239,213,157,0.2)"
          : "rgba(128,0,32,0.18)",
        borderRadius: { xs: 1.5, md: 2 },
        bgcolor: isDark ? "#120d14" : "#f8f4ef",
        boxShadow: featured
          ? "0 34px 90px -50px rgba(21,17,26,0.7)"
          : "0 26px 70px -54px rgba(21,17,26,0.62)",
      }}
    >
      <Box
        aria-hidden
        sx={{
          height: 34,
          px: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 0.65,
          borderBottom: "1px solid",
          borderColor: isDark
            ? "rgba(255,255,255,0.09)"
            : "rgba(21,17,26,0.08)",
          bgcolor: isDark
            ? "rgba(29,21,33,0.96)"
            : "rgba(255,255,255,0.92)",
        }}
      >
        {["#800020", "#d2a84d", "#4f7d65"].map((color) => (
          <Box
            key={color}
            sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }}
          />
        ))}
        <Typography
          variant="caption"
          sx={{
            ml: 0.75,
            color: isDark
              ? "rgba(255,255,255,0.58)"
              : "rgba(21,17,26,0.58)",
            fontWeight: 750,
          }}
        >
          Xtiitch product
        </Typography>
      </Box>
      <Box
        component="picture"
        sx={{
          display: "block",
          position: "relative",
          aspectRatio: { xs: "4 / 5", md: "16 / 10" },
          bgcolor: isDark ? "#120d14" : "#f8f4ef",
        }}
      >
        <source media="(max-width: 599px)" srcSet={mobileImage} />
        <Box
          component="img"
          src={desktopImage}
          alt={shot.alt}
          loading="lazy"
          decoding="async"
          sx={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      </Box>
    </Box>
  );
}

function TourCopy({
  shot,
  featured = false,
}: {
  shot: ProductTourShot;
  featured?: boolean;
}) {
  return (
    <Box sx={{ p: featured ? { xs: 2.5, md: 4 } : { xs: 2.25, md: 3 } }}>
      <Typography
        variant="overline"
        sx={{ color: "primary.main", fontWeight: 900, letterSpacing: "0.12em" }}
      >
        {shot.eyebrow}
      </Typography>
      <Typography
        variant={featured ? "h3" : "h4"}
        component="h3"
        sx={{ mt: 0.4 }}
      >
        {shot.title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ mt: 1, color: "text.secondary", lineHeight: 1.7 }}
      >
        {shot.body}
      </Typography>
      <Stack
        direction="row"
        useFlexGap
        spacing={0.75}
        sx={{ mt: 2, flexWrap: "wrap" }}
      >
        {shot.capabilities.map((capability) => (
          <Chip
            key={capability}
            size="small"
            label={capability}
            sx={{
              bgcolor: "rgba(128,0,32,0.07)",
              color: "primary.main",
              fontWeight: 800,
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}

export function ProductTour() {
  const [featured, ...supporting] = productTourShots;
  if (!featured) return null;

  return (
    <Stack spacing={{ xs: 2, md: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "0.72fr 1.28fr" },
          alignItems: "center",
          overflow: "hidden",
          border: "1px solid",
          borderColor: "rgba(128,0,32,0.16)",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <TourCopy shot={featured} featured />
        <Box sx={{ p: { xs: 1.25, md: 2 }, pl: { lg: 0 } }}>
          <ScreenshotFrame shot={featured} featured />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: { xs: 2, md: 3 },
        }}
      >
        {supporting.map((shot) => (
          <Box
            key={shot.title}
            sx={{
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
            }}
          >
            <ScreenshotFrame shot={shot} />
            <TourCopy shot={shot} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
