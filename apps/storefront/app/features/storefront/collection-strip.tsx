import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CollectionsBookmarkRounded from "@mui/icons-material/CollectionsBookmarkRounded";
import type { Collection, StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";

export function CollectionStrip({
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
