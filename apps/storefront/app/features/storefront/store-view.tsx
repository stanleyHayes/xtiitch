import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { Collection, Design, PublicShop, StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";
import { CollectionStrip } from "./collection-strip";
import { DesignGrid } from "./design-grid";
import { MarketplaceStrip } from "./marketplace-strip";
import { PoweredByBadge } from "./powered-by-badge";
import { StoreHeader } from "./store-header";
import { StoreOrderGuide } from "./store-order-guide";
import { StoreServiceBand } from "./store-service-band";

// StoreView is the full storefront page — header, in-store search, and the
// design grid. It is rendered both at <handle>.xtiitch.com (the home route
// resolving the store from the subdomain) and at the legacy /store/:handle path.
export function StoreView({
  store,
  designs,
  query,
  collections = [],
  marketplace = [],
  tenantHost = false,
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
  collections?: Collection[];
  marketplace?: PublicShop[];
  // True when the page is served on the store's own tenant host
  // (business-name.xtiitch.com) — §6 isolation then hides the cross-store
  // discovery strip on every plan, identical everywhere.
  tenantHost?: boolean;
}) {
  const brand = store.brand_color || tokens.burgundy;
  const otherShops = marketplace.filter((shop) => shop.handle !== store.handle);
  // "Discover other studios" only shows on free-plan storefronts; paid plans get
  // a clean, distraction-free store with no cross-promotion of other shops.
  // §6: on a tenant host it NEVER shows, regardless of plan.
  const showDiscover = !tenantHost && store.plan_code === "free";

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

      {showDiscover && !query && otherShops.length > 0 ? (
        <MarketplaceStrip shops={otherShops} brand={brand} />
      ) : null}

      {/* Last on the page, below the store's own content and the discovery rail.
          The API resolves this from the plan's entitlement, so an older payload
          that omits it shows the badge — the safe default is attribution, not a
          free upgrade. */}
      {store.show_powered_by_badge !== false ? (
        <PoweredByBadge brand={brand} />
      ) : null}
    </Box>
  );
}
