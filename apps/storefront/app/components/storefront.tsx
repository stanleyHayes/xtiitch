import { type ReactNode } from "react";
import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CollectionsBookmarkRounded from "@mui/icons-material/CollectionsBookmarkRounded";
import ContentCutRounded from "@mui/icons-material/ContentCutRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import StarRounded from "@mui/icons-material/StarRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type {
  Collection,
  Design,
  PublicShop,
  StoreSummary,
} from "../lib/api";
import { ThemeModeToggle } from "../theme-mode";
import TextField from "./form-text-field";
import { priceLabel } from "../lib/format";
import { tokens } from "../theme";

const fallbackDesignImages = [
  "/images/storefront-atelier-review.webp",
  "/images/storefront-fitting.webp",
  "/images/storefront-atelier-hero.webp",
];

// Readable text colour for an arbitrary brand background.
function contrastText(hex: string): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) {
    return "#ffffff";
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#15111a" : "#ffffff";
}

export function StoreHeader({
  store,
  designs,
  query,
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
}) {
  const brand = store.brand_color || "#800020";
  const onBrand = contrastText(brand);
  const customisableCount = designs.filter(
    (design) => design.customisation_allowed,
  ).length;
  const pricedCount = designs.filter(
    (design) => design.prices.length > 0,
  ).length;
  return (
    <Box
      component="header"
      sx={{
        color: onBrand,
        position: "relative",
        overflow: "hidden",
        backgroundImage: `
          linear-gradient(90deg, ${alpha(brand, 0.96)} 0%, ${alpha(brand, 0.88)} 46%, ${alpha(brand, 0.46)} 100%),
          url("/images/storefront-atelier-hero.webp")
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: { xs: 500, md: 560 },
        display: "flex",
        flexDirection: "column",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${alpha(onBrand, 0.08)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(onBrand, 0.08)} 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
          maskImage:
            "linear-gradient(90deg, black 0%, black 58%, transparent 100%)",
          pointerEvents: "none",
        },
      }}
    >
      <Container
        sx={{
          position: "relative",
          zIndex: 1,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(onBrand, 0.13),
              border: "1px solid",
              borderColor: alpha(onBrand, 0.18),
              flexShrink: 0,
            }}
          >
            <StorefrontOutlined />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 900 }} noWrap>
              {store.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{ opacity: 0.72, fontWeight: 800 }}
              noWrap
            >
              {store.handle}.xtiitch.com
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center" }}
        >
          <ThemeModeToggle sx={{ color: onBrand }} />
          <Button
            href="#designs"
            variant="contained"
            sx={{
              bgcolor: alpha(onBrand, 0.92),
              color: brand,
              "&:hover": { bgcolor: onBrand },
            }}
          >
            Browse pieces
          </Button>
          <Button
            component={RouterLink}
            to="/track"
            variant="outlined"
            sx={{
              color: onBrand,
              borderColor: alpha(onBrand, 0.32),
              "&:hover": { borderColor: alpha(onBrand, 0.58) },
            }}
          >
            Track order
          </Button>
          <Button
            href="https://xtiitch.com"
            variant="outlined"
            sx={{
              color: onBrand,
              borderColor: alpha(onBrand, 0.32),
              "&:hover": { borderColor: alpha(onBrand, 0.58) },
            }}
          >
            About Xtiitch
          </Button>
        </Stack>
      </Container>

      <Container
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "grid",
          alignItems: "center",
          py: { xs: 5, md: 7 },
        }}
      >
        <Box sx={{ maxWidth: 720 }}>
          <Stack
            direction="row"
            spacing={1.2}
            sx={{ alignItems: "center", mb: 1.25, flexWrap: "wrap" }}
          >
            <Chip
              size="small"
              icon={<VerifiedRounded />}
              label="Verified Xtiitch store"
              sx={{
                color: onBrand,
                bgcolor: alpha(onBrand, 0.12),
                border: "1px solid",
                borderColor: alpha(onBrand, 0.18),
                "& .MuiChip-icon": { color: alpha(onBrand, 0.78) },
              }}
            />
            <Chip
              size="small"
              label={`${designs.length} ${designs.length === 1 ? "piece" : "pieces"}`}
              sx={{
                color: onBrand,
                bgcolor: alpha(onBrand, 0.12),
                border: "1px solid",
                borderColor: alpha(onBrand, 0.18),
              }}
            />
          </Stack>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              maxWidth: 680,
              fontSize: { xs: "2.6rem", md: "4.15rem" },
              lineHeight: 0.98,
            }}
          >
            {store.name}
          </Typography>
          <Typography
            sx={{
              mt: 2,
              opacity: 0.82,
              maxWidth: 620,
              fontSize: { xs: 17, md: 20 },
            }}
          >
            Browse available pieces, choose a fit route, and start an order from
            the design that feels right.
          </Typography>

          <Form method="get" role="search">
            <TextField
              name="q"
              defaultValue={query}
              placeholder="Search pieces"
              size="medium"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                mt: 3,
                maxWidth: 560,
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(var(--surface-rgb), 0.96)",
                  color: "text.primary",
                  boxShadow: `0 16px 42px ${alpha(tokens.ink, 0.16)}`,
                },
              }}
            />
          </Form>

          <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
            {[
              { label: "Priced pieces", value: String(pricedCount) },
              { label: "Custom options", value: String(customisableCount) },
            ].map((signal) => (
              <Chip
                key={signal.label}
                label={`${signal.value} ${signal.label.toLowerCase()}`}
                sx={{
                  color: onBrand,
                  bgcolor: alpha(onBrand, 0.12),
                  border: "1px solid",
                  borderColor: alpha(onBrand, 0.18),
                  fontWeight: 850,
                }}
              />
            ))}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

function storeServices(store: StoreSummary): {
  label: string;
  active: boolean;
  helper: string;
  icon: ReactNode;
}[] {
  return [
    {
      label: "Bespoke",
      active: store.settings.bespoke_enabled,
      helper: "Custom order requests",
      icon: <ContentCutRounded />,
    },
    {
      label: "Measurements",
      active: store.settings.measurements_enabled,
      helper: "Fit details supported",
      icon: <StraightenRounded />,
    },
    {
      label: "Delivery",
      active:
        store.settings.delivery_enabled || store.settings.dispatch_enabled,
      helper: "Pickup or handover options",
      icon: <LocalShippingRounded />,
    },
    {
      label: "Collections",
      active: store.settings.collections_enabled,
      helper: "Grouped store drops",
      icon: <StorefrontOutlined />,
    },
  ];
}

function StoreServiceBand({ store }: { store: StoreSummary }) {
  const brand = store.brand_color || tokens.burgundy;
  const services = storeServices(store);

  return (
    <Box
      sx={{
        borderBlock: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgba(var(--surface-rgb), 0.86)",
      }}
    >
      <Container
        sx={{
          py: { xs: 2, md: 2.5 },
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {services.map((service) => (
          <Stack
            key={service.label}
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: "center",
              minWidth: 0,
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: service.active
                ? alpha(brand, 0.055)
                : alpha(tokens.ink, 0.025),
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 1.25,
                display: "grid",
                placeItems: "center",
                color: service.active ? brand : tokens.mutedText,
                bgcolor: service.active
                  ? alpha(brand, 0.1)
                  : alpha(tokens.ink, 0.04),
                flexShrink: 0,
              }}
            >
              {service.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center" }}
              >
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  {service.label}
                </Typography>
                <Box
                  aria-hidden
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: service.active ? brand : alpha(tokens.ink, 0.25),
                    flexShrink: 0,
                  }}
                />
              </Stack>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary" }}
                noWrap
              >
                {service.active ? service.helper : "Ask the store"}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Container>
    </Box>
  );
}

function CollectionStrip({
  store,
  collections,
}: {
  store: StoreSummary;
  collections: Collection[];
}) {
  if (collections.length === 0 || !store.settings.collections_enabled) {
    return null;
  }

  const brand = store.brand_color || tokens.burgundy;

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgba(var(--surface-rgb), 0.9)",
      }}
    >
      <Container sx={{ py: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "8px",
                display: "grid",
                placeItems: "center",
                color: brand,
                bgcolor: alpha(brand, 0.08),
                flexShrink: 0,
              }}
            >
              <CollectionsBookmarkRounded />
            </Box>
            <Box>
              <Typography variant="h6">Shop by collection</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Curated store drops from {store.name}
              </Typography>
            </Box>
          </Stack>
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
              },
              flex: 1,
              maxWidth: { md: 760 },
            }}
          >
            {collections.slice(0, 6).map((collection) => (
              <Box
                key={collection.collection_id}
                component={RouterLink}
                to={`/c/${collection.handle}`}
                sx={{
                  p: 1.5,
                  minHeight: 96,
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: alpha(brand, 0.14),
                  bgcolor: alpha(brand, 0.045),
                  color: "inherit",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition:
                    "transform 180ms ease, border-color 180ms ease, background-color 180ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: alpha(brand, 0.28),
                    bgcolor: alpha(brand, 0.075),
                  },
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 950 }} noWrap>
                    {collection.name}
                  </Typography>
                  {collection.theme ? (
                    <Typography
                      variant="body2"
                      sx={{
                        mt: 0.5,
                        color: "text.secondary",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {collection.theme}
                    </Typography>
                  ) : null}
                </Box>
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    mt: 1,
                    alignItems: "center",
                    color: brand,
                    fontWeight: 900,
                    fontSize: 13,
                  }}
                >
                  <span>Browse</span>
                  <ArrowForwardRounded sx={{ fontSize: 16 }} />
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

function StoreOrderGuide({ store }: { store: StoreSummary }) {
  const brand = store.brand_color || tokens.burgundy;
  const steps = [
    {
      title: "Choose the piece",
      helper:
        "Open a design to compare prices, available sizes, and custom fit routes.",
      icon: <ContentCutRounded />,
    },
    {
      title: "Select a fit route",
      helper: store.settings.bespoke_enabled
        ? "Order a listed size, send measurements, book a visit, or reserve shop measurement."
        : "Use the listed-size checkout this store has published.",
      icon: <StraightenRounded />,
    },
    {
      title: "Pay or reserve",
      helper:
        "Online payments open in the secure checkout; shop-measurement requests can start without payment.",
      icon: <CreditCardRounded />,
    },
    {
      title: "Track production",
      helper:
        "Keep the tracking link to follow stage updates, pickup, or delivery handover.",
      icon: <LocalShippingRounded />,
    },
  ];

  return (
    <Box
      sx={{
        bgcolor: "rgba(var(--surface-rgb), 0.68)",
        borderBottom: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
      }}
    >
      <Container sx={{ py: { xs: 3.5, md: 4.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2.5}
          sx={{
            alignItems: { xs: "flex-start", md: "flex-end" },
            justifyContent: "space-between",
            mb: 2.5,
          }}
        >
          <Box sx={{ maxWidth: 620 }}>
            <Typography
              variant="caption"
              sx={{
                color: brand,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              How ordering works
            </Typography>
            <Typography variant="h5" component="h2">
              From browse to handover
            </Typography>
            <Typography sx={{ mt: 0.75, color: "text.secondary" }}>
              Each store controls its catalogue and fulfilment; Xtiitch keeps
              the order route, checkout, and tracking link in one place.
            </Typography>
          </Box>
          <Chip
            icon={<VerifiedRounded />}
            label="No account needed to browse"
            sx={{
              bgcolor: alpha(brand, 0.08),
              color: brand,
              fontWeight: 900,
              "& .MuiChip-icon": { color: brand },
            }}
          />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          {steps.map((step, index) => (
            <Box
              key={step.title}
              sx={{
                p: 1.75,
                minHeight: 176,
                borderRadius: "8px",
                border: "1px solid",
                borderColor: alpha(brand, 0.13),
                bgcolor: "rgba(var(--surface-rgb), 0.78)",
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", minWidth: 0 }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(brand, 0.08),
                    color: brand,
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 900 }}
                >
                  Step {index + 1}
                </Typography>
              </Stack>
              <Box>
                <Typography sx={{ fontWeight: 950 }}>{step.title}</Typography>
                <Typography
                  variant="body2"
                  sx={{ mt: 0.6, color: "text.secondary" }}
                >
                  {step.helper}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// StoreView is the full storefront page — header, in-store search, and the
// design grid. It is rendered both at <handle>.xtiitch.com (the home route
// resolving the store from the subdomain) and at the legacy /store/:handle path.
export function StoreView({
  store,
  designs,
  query,
  collections = [],
  marketplace = [],
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
  collections?: Collection[];
  marketplace?: PublicShop[];
}) {
  const brand = store.brand_color || tokens.burgundy;
  const otherShops = marketplace.filter((shop) => shop.handle !== store.handle);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(brand, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(brand, 0.035)} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        "@keyframes storeSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      <StoreHeader store={store} designs={designs} query={query} />
      <StoreServiceBand store={store} />
      {!query ? (
        <>
          <CollectionStrip store={store} collections={collections} />
          <StoreOrderGuide store={store} />
        </>
      ) : null}

      <Box
        sx={{
          minWidth: 0,
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "storeSurfaceIn 500ms ease both",
          },
        }}
      >
        <Container id="designs" sx={{ py: { xs: 4, md: 7 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              mb: 3,
              alignItems: { xs: "flex-start", sm: "flex-end" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                {query ? "Search results" : "Store catalogue"}
              </Typography>
              <Typography variant="h5" component="h2">
                {query ? `Results for "${query}"` : "Available pieces"}
              </Typography>
              <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
                {query
                  ? "Matched designs from this store, with pricing and custom options close at hand."
                  : "Choose a design to see its price, custom options, and order route."}
              </Typography>
            </Box>
            <Chip
              label={`${designs.length} ${designs.length === 1 ? "piece" : "pieces"}`}
              sx={{
                bgcolor: alpha(brand, 0.1),
                color: brand,
                fontWeight: 900,
              }}
            />
          </Stack>
          <DesignGrid designs={designs} featuredFirst={!query} />
        </Container>
      </Box>

      {!query && otherShops.length > 0 ? (
        <MarketplaceStrip shops={otherShops} brand={brand} />
      ) : null}
    </Box>
  );
}

// A cross-shop discovery rail shown at the foot of every storefront: other
// verified, active studios on Xtiitch, so a customer who lands on one store can
// keep browsing the marketplace. (Sponsored placements slot in here once ad
// campaigns are live; until then it lists peers.)
function MarketplaceStrip({
  shops,
  brand,
}: {
  shops: PublicShop[];
  brand: string;
}) {
  return (
    <Box
      component="section"
      sx={{
        borderTop: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgba(var(--surface-rgb), 0.5)",
      }}
    >
      <Container sx={{ py: { xs: 5, md: 7 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{
            mb: 3,
            gap: 1,
            alignItems: { xs: "flex-start", sm: "flex-end" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              More on Xtiitch
            </Typography>
            <Typography variant="h5" component="h2">
              Discover other studios
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/"
            endIcon={<ArrowForwardRounded />}
            sx={{ color: brand, fontWeight: 800, whiteSpace: "nowrap" }}
          >
            Browse all
          </Button>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              sm: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
          }}
        >
          {shops.slice(0, 8).map((shop) => (
            <MarketplaceShopCard key={shop.business_id} shop={shop} />
          ))}
        </Box>
      </Container>
    </Box>
  );
}

function MarketplaceShopCard({ shop }: { shop: PublicShop }) {
  const shopBrand = shop.brand_color || tokens.burgundy;
  const cover = shop.designs.find((design) => design.image)?.image;
  return (
    <Card
      component={RouterLink}
      to={`/store/${shop.handle}`}
      sx={{
        textDecoration: "none",
        height: "100%",
        overflow: "hidden",
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgb(var(--surface-rgb))",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: `0 22px 48px ${alpha(tokens.ink, 0.14)}`,
          borderColor: alpha(shopBrand, 0.3),
        },
      }}
    >
      <Box
        sx={{
          height: 116,
          position: "relative",
          background: cover
            ? `center/cover no-repeat url(${cover})`
            : `linear-gradient(135deg, ${shopBrand}, ${alpha(shopBrand, 0.65)})`,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${alpha(tokens.ink, 0)} 40%, ${alpha(tokens.ink, 0.42)} 100%)`,
          }}
        />
      </Box>
      <Box sx={{ p: 2 }}>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: 17,
            color: "text.primary",
            lineHeight: 1.15,
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {shop.name}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 700 }}
        >
          {shop.design_count} {shop.design_count === 1 ? "piece" : "pieces"}
        </Typography>
      </Box>
    </Card>
  );
}

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
        borderColor: featured ? alpha(tokens.burgundy, 0.55) : alpha(tokens.ink, 0.08),
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
          boxShadow: `0 30px 64px ${alpha(tokens.ink, 0.16)}`,
          borderColor: alpha(tokens.burgundy, 0.24),
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
                borderColor: alpha(tokens.ink, 0.08),
                boxShadow: `0 6px 16px ${alpha(tokens.ink, 0.12)}`,
              }}
            >
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: tokens.burgundy,
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
                color: tokens.burgundy,
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
                fontWeight: 900,
                color: tokens.burgundy,
                letterSpacing: "0.01em",
              }}
            >
              {priceLabel(design.prices)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: alpha(tokens.ink, 0.5),
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {priced ? "Size pricing" : "Request quote"}
            </Typography>
          </Stack>
          <Box
            aria-hidden
            sx={{
              height: "1px",
              backgroundImage: `linear-gradient(90deg, ${alpha("#c58b2c", 0.65)}, ${alpha(tokens.ink, 0.08)} 40%)`,
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

export function DesignGrid({
  designs,
  featuredFirst = false,
}: {
  designs: Design[];
  featuredFirst?: boolean;
}) {
  if (designs.length === 0) {
    return (
      <Box
        sx={{
          py: 8,
          px: 2,
          textAlign: "center",
          border: "1px dashed",
          borderColor: alpha(tokens.burgundy, 0.28),
          borderRadius: "8px",
          bgcolor: "rgba(var(--surface-rgb), 0.58)",
        }}
      >
        <Typography variant="h6">No designs matched</Typography>
        <Typography sx={{ color: "text.secondary", mt: 0.75 }}>
          Try a different search, or check back when the store publishes more
          pieces.
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: {
          xs: "minmax(0, min(100%, 430px))",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(auto-fill, minmax(280px, 360px))",
        },
        justifyContent: { xs: "center", sm: "start" },
      }}
    >
      {designs.map((design, index) => (
        <DesignCard
          key={design.design_id}
          design={design}
          index={index}
          featured={featuredFirst && index === 0}
        />
      ))}
    </Box>
  );
}
