import { Link as RouterLink, data } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CollectionsBookmarkRounded from "@mui/icons-material/CollectionsBookmarkRounded";
import type { Route } from "./+types/collection";
import { api } from "../lib/api";
import { DesignGrid, StoreNotice } from "../components/storefront";
import { tokens } from "../theme";

export async function loader({ params }: Route.LoaderArgs) {
  const page = await api.collection(params.handle);
  if (!page) {
    // Deleted or unpublished: render a friendly in-store notice (below) rather
    // than a hard error page. The 404 status keeps it out of search results.
    return data({ notFound: true } as const, { status: 404 });
  }
  return { collection: page.collection, designs: page.designs };
}

export function meta({ data: loaded }: Route.MetaArgs) {
  const collection =
    loaded && "collection" in loaded ? loaded.collection : null;
  if (!collection) {
    return [
      { title: "Collection unavailable · Xtiitch" },
      { name: "robots", content: "noindex" },
    ];
  }
  const name = collection.name;
  return [
    { title: `${name} · Xtiitch` },
    {
      name: "description",
      content: collection.theme || `Browse the ${name} collection on Xtiitch.`,
    },
  ];
}

export default function CollectionPage({ loaderData }: Route.ComponentProps) {
  if ("notFound" in loaderData) {
    return (
      <StoreNotice
        title="This collection is no longer available"
        message="The collection you're looking for has been removed or unpublished. Head back to the store to browse everything on offer."
      />
    );
  }
  const { collection, designs } = loaderData;
  const store = designs.find((design) => design.store)?.store;

  const customisableCount = designs.filter(
    (design) => design.customisation_allowed,
  ).length;
  const pricedCount = designs.filter(
    (design) => design.prices.length > 0,
  ).length;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
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
      <Box
        sx={{
          bgcolor: tokens.charcoal,
          color: "common.white",
          position: "relative",
          overflow: "hidden",
          backgroundImage: `
            linear-gradient(${alpha(tokens.white, 0.06)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(tokens.white, 0.06)} 1px, transparent 1px),
            linear-gradient(135deg, ${alpha(tokens.burgundy, 0.42)}, transparent 54%)
          `,
          backgroundSize: "36px 36px, 36px 36px, auto",
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            right: { xs: -38, md: 64 },
            bottom: -52,
            color: alpha(tokens.white, 0.08),
            "& .MuiSvgIcon-root": { fontSize: { xs: 180, md: 260 } },
          }}
        >
          <CollectionsBookmarkRounded />
        </Box>
        <Container sx={{ py: { xs: 4.5, md: 7 }, position: "relative" }}>
          <Stack spacing={2.5} sx={{ maxWidth: 860 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Chip
                size="small"
                label="Collection"
                sx={{
                  color: tokens.white,
                  bgcolor: "rgba(var(--surface-rgb), 0.12)",
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.16),
                  fontWeight: 900,
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: alpha(tokens.white, 0.64), fontWeight: 900 }}
              >
                {designs.length} {designs.length === 1 ? "piece" : "pieces"}
              </Typography>
            </Stack>
            <Box>
              <Typography variant="h3" component="h1">
                {collection.name}
              </Typography>
              {collection.theme ? (
                <Typography
                  sx={{
                    mt: 1.5,
                    color: alpha(tokens.white, 0.74),
                    maxWidth: 640,
                    fontSize: { xs: 16, md: 18 },
                  }}
                >
                  {collection.theme}
                </Typography>
              ) : null}
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ alignItems: { xs: "stretch", sm: "center" } }}
            >
              {[
                { label: "Priced", value: String(pricedCount) },
                { label: "Custom", value: String(customisableCount) },
              ].map((signal) => (
                <Box
                  key={signal.label}
                  sx={{
                    minWidth: 128,
                    p: 1.25,
                    borderRadius: "8px",
                    bgcolor: "rgba(var(--surface-rgb), 0.09)",
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.14),
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: alpha(tokens.white, 0.64), fontWeight: 900 }}
                  >
                    {signal.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 22 }}>
                    {signal.value}
                  </Typography>
                </Box>
              ))}
              <Button
                component={RouterLink}
                to={store ? `/store/${store.handle}` : "/"}
                variant="outlined"
                sx={{
                  color: tokens.white,
                  borderColor: alpha(tokens.white, 0.28),
                  "&:hover": { borderColor: alpha(tokens.white, 0.56) },
                }}
              >
                Back to store
              </Button>
              <Button
                href="#collection-designs"
                variant="contained"
                endIcon={<ArrowForwardRounded />}
                sx={{
                  bgcolor: "rgb(var(--surface-rgb))",
                  color: "text.primary",
                  ml: { sm: 1 },
                  "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.86)" },
                }}
              >
                Browse pieces
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container id="collection-designs" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{
            mb: 3,
            alignItems: { xs: "flex-start", sm: "flex-end" },
            justifyContent: "space-between",
            "@media (prefers-reduced-motion: no-preference)": {
              animation: "storeSurfaceIn 420ms ease both",
            },
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
              Designs in this collection
            </Typography>
            <Typography variant="h5" component="h2">
              Choose a piece to order
            </Typography>
          </Box>
          <Chip
            label={`${designs.length} ${designs.length === 1 ? "piece" : "pieces"}`}
            sx={{
              bgcolor: alpha(tokens.burgundy, 0.1),
              color: tokens.burgundy,
              fontWeight: 900,
            }}
          />
        </Stack>
        <DesignGrid designs={designs} />
      </Container>
    </Box>
  );
}
