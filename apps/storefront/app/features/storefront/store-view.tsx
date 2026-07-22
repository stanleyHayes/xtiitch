import { Form, Link as RouterLink } from "react-router";
import CheckroomRounded from "@mui/icons-material/CheckroomRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import type {
  Collection,
  Design,
  PublicShop,
  StoreSummary,
} from "../../lib/api";
import { tokens } from "../../theme";
import { CollectionStrip } from "./collection-strip";
import { DesignGrid } from "./design-grid";
import { MarketplaceStrip } from "./marketplace-strip";
import { PoweredByBadge } from "./powered-by-badge";
import { readableBrandText, resolveStoreBrand } from "./store-brand";
import { StoreHeader } from "./store-header";
import { StoreOrderGuide } from "./store-order-guide";
import { StoreServiceBand } from "./store-service-band";

export function StoreView(props: StoreViewProps) {
  if (props.store.live === false) {
    return <NotLiveStoreView {...props} />;
  }
  return <LiveStoreView {...props} />;
}

type StoreViewProps = {
  store: StoreSummary;
  designs: Design[];
  query: string;
  collections?: Collection[];
  marketplace?: PublicShop[];
  tenantHost?: boolean;
};

function NotLiveStoreView({ store }: StoreViewProps) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <StoreHeader store={store} />
      <NotLiveNotice storeName={store.name} />
    </Box>
  );
}

// Optional storefront modules are independently plan and route gated.
// eslint-disable-next-line complexity
function LiveStoreView({
  store,
  designs,
  query,
  collections = [],
  marketplace = [],
  tenantHost = false,
}: StoreViewProps) {
  const brand = resolveStoreBrand(store.brand_color);
  const otherShops = marketplace.filter((shop) => shop.handle !== store.handle);
  const showDiscover = !tenantHost && store.plan_code === "free";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(brand, 0.028)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(brand, 0.028)} 1px, transparent 1px)`,
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
      <StoreHeader store={store} />
      {!query && collections.length > 0 ? (
        <CollectionStrip store={store} collections={collections} />
      ) : null}

      <Box
        id="designs"
        sx={{
          minWidth: 0,
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "storeSurfaceIn 500ms ease both",
          },
        }}
      >
        <Container sx={{ py: { xs: 4, md: 5.5 } }}>
          <Box
            sx={{
              pb: 2,
              borderBottom: "1px solid",
              borderColor: alpha(tokens.ink, 0.1),
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(260px, 0.72fr) minmax(360px, 1fr)",
              },
              alignItems: "end",
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{
                  color: brand,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                {query ? "Search results" : "Store catalogue"}
              </Typography>
              <Typography variant="h5" component="h2">
                {query ? `Results for “${query}”` : "Available pieces"}
              </Typography>
            </Box>
            <Form method="get" role="search">
              <TextField
                name="q"
                defaultValue={query}
                placeholder="Search pieces"
                size="small"
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
                  "& .MuiOutlinedInput-root": {
                    bgcolor: "rgba(var(--surface-rgb), 0.9)",
                    "&.Mui-focused fieldset": { borderColor: brand },
                  },
                }}
              />
            </Form>
          </Box>

          <Box
            sx={{
              pt: 3,
              display: "grid",
              gap: { xs: 3, md: 0 },
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" },
              alignItems: "stretch",
            }}
          >
            <Box sx={{ minWidth: 0, pr: { md: 3 } }}>
              {designs.length > 0 ? (
                <DesignGrid designs={designs} featuredFirst={!query} />
              ) : (
                <StoreCatalogueEmpty
                  store={store}
                  query={query}
                  tenantHost={tenantHost}
                  showDiscover={showDiscover && otherShops.length > 0}
                />
              )}
            </Box>
            <StoreServiceBand store={store} />
          </Box>
        </Container>
      </Box>

      {!query ? <StoreOrderGuide store={store} /> : null}

      {showDiscover && !query && otherShops.length > 0 ? (
        <MarketplaceStrip shops={otherShops} brand={brand} />
      ) : null}

      {store.show_powered_by_badge !== false ? (
        <PoweredByBadge brand={brand} />
      ) : null}
    </Box>
  );
}

function StoreCatalogueEmpty({
  store,
  query,
  tenantHost,
  showDiscover,
}: {
  store: StoreSummary;
  query: string;
  tenantHost: boolean;
  showDiscover: boolean;
}) {
  const brand = resolveStoreBrand(store.brand_color);
  const onBrand = readableBrandText(brand);
  const clearSearchPath = tenantHost ? "/" : `/store/${store.handle}`;

  return (
    <Stack
      spacing={1.4}
      sx={{
        minHeight: { xs: 330, md: 470 },
        px: { xs: 2, md: 5 },
        py: { xs: 5, md: 7 },
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        bgcolor: "rgba(var(--surface-rgb), 0.5)",
      }}
    >
      <Box
        sx={{
          width: 82,
          height: 82,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: brand,
          bgcolor: alpha(brand, 0.075),
          "& svg": { fontSize: 42 },
        }}
      >
        <CheckroomRounded />
      </Box>
      <Typography variant="h5" component="h3">
        {query ? "No pieces match that search" : "No pieces published yet"}
      </Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 500 }}>
        {query
          ? "Try another search, or return to the full store catalogue."
          : "This store has not published any pieces to its catalogue. Check back soon for its next drop."}
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ pt: 1.25, alignItems: "center" }}
      >
        {query ? (
          <Button
            component={RouterLink}
            to={clearSearchPath}
            variant="contained"
            sx={{ bgcolor: brand, color: onBrand }}
          >
            View all pieces
          </Button>
        ) : (
          <Button
            component={RouterLink}
            to="/track"
            variant="contained"
            sx={{ bgcolor: brand, color: onBrand }}
          >
            Track an order
          </Button>
        )}
        {showDiscover ? (
          <Button component={RouterLink} to="/" sx={{ color: brand }}>
            Discover other studios
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
}

function NotLiveNotice({ storeName }: { storeName: string }) {
  return (
    <Container sx={{ py: { xs: 6, md: 10 } }}>
      <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
        This store is not live yet
      </Typography>
      <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
        {storeName} has not opened its storefront. Check back soon.
      </Typography>
    </Container>
  );
}
