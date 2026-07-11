import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import type { PublicShop } from "../../lib/api";
import { tokens } from "../../theme";
import { PaginationFooter, usePagedItems } from "./pagination";
import { XtiitchPlatformLogo } from "./platform-logo";

// A cross-shop discovery rail shown at the foot of every storefront: other
// verified, active studios on Xtiitch, so a customer who lands on one store can
// keep browsing the marketplace. (Sponsored placements slot in here once ad
// campaigns are live; until then it lists peers.)
export function MarketplaceStrip({
  shops,
  brand,
}: {
  shops: PublicShop[];
  brand: string;
}) {
  const {
    page: shopPage,
    pageCount: shopPageCount,
    pagedItems: pagedShops,
    setPage: setShopPage,
  } = usePagedItems(shops, 8, shops.length);

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
          <Box
            component={RouterLink}
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: "inherit",
              textDecoration: "none",
              borderRadius: 1,
              "&:focus-visible": {
                outline: `3px solid ${alpha(brand, 0.32)}`,
                outlineOffset: 4,
              },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", mb: 0.25 }}
            >
              <XtiitchPlatformLogo size={22} />
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
            </Stack>
            <Typography variant="h5" component="h2">
              Discover other studios
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/"
            target="_blank"
            rel="noopener noreferrer"
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
          {pagedShops.map((shop) => (
            <MarketplaceShopCard key={shop.business_id} shop={shop} />
          ))}
        </Box>
        <PaginationFooter
          count={shopPageCount}
          label="studios"
          page={shopPage}
          pageSize={8}
          total={shops.length}
          onChange={setShopPage}
        />
      </Container>
    </Box>
  );
}

function MarketplaceShopCard({ shop }: { shop: PublicShop }) {
  const shopBrand = shop.brand_color || tokens.burgundy;
  // Mirror the store page hero (StoreHeader) so the card cover matches the page
  // you land on: the merchant's banner, else the shared Xtiitch atelier hero.
  const cover =
    shop.banner_url?.trim() || "/images/storefront-atelier-hero.webp";
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
        transition:
          "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
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
          background: `center/cover no-repeat url(${cover})`,
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
