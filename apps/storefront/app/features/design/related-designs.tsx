import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { Design, StoreSummary } from "../../lib/api";
import { tokens } from "../../theme";
import { DesignCard } from "../storefront/design-card";

export function RelatedDesigns({
  designs,
  store,
}: {
  designs: Design[];
  store?: StoreSummary;
}) {
  if (designs.length === 0) {
    return null;
  }

  const brand = store?.brand_color || tokens.burgundy;

  return (
    <Box
      sx={{
        mt: { xs: 4, md: 5 },
        pt: { xs: 3, md: 4 },
        borderTop: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 2.5,
          alignItems: { xs: "flex-start", sm: "flex-end" },
          justifyContent: "space-between",
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
            Keep browsing
          </Typography>
          <Typography variant="h5" component="h2">
            More from {store?.name ?? "this store"}
          </Typography>
          <Typography sx={{ color: "text.secondary", maxWidth: 620 }}>
            Similar pieces from the same storefront, kept close so shoppers can
            compare before ordering.
          </Typography>
        </Box>
        {store?.handle ? (
          <Button
            component={RouterLink}
            to={`/store/${store.handle}`}
            variant="outlined"
            sx={{ flexShrink: 0 }}
          >
            View store
          </Button>
        ) : null}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {designs.map((design, index) => (
          <DesignCard key={design.design_id} design={design} index={index} />
        ))}
      </Box>
    </Box>
  );
}
