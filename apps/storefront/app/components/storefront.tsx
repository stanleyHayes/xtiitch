import { type ReactNode } from "react";
import { Form, Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type { Design, StoreSummary } from "../lib/api";
import { priceLabel } from "../lib/format";

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

export function StoreHeader({ store, children }: { store: StoreSummary; children?: ReactNode }) {
  const brand = store.brand_color || "#800020";
  const onBrand = contrastText(brand);
  return (
    <Box component="header" sx={{ bgcolor: brand, color: onBrand }}>
      <Container sx={{ py: { xs: 4, md: 6 } }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
          <Typography variant="h3" component="h1">
            {store.name}
          </Typography>
          <VerifiedRounded sx={{ opacity: 0.85 }} titleAccess="Verified Xtiitch store" />
        </Stack>
        <Typography sx={{ opacity: 0.85 }}>
          {store.handle}.xtiitch.com
        </Typography>
        {children}
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
}: {
  store: StoreSummary;
  designs: Design[];
  query: string;
}) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <StoreHeader store={store}>
        <Box sx={{ mt: 3, maxWidth: 460 }}>
          <Form method="get" role="search">
            <TextField
              name="q"
              defaultValue={query}
              placeholder="Search this store"
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
              sx={{ bgcolor: "background.paper", borderRadius: 1 }}
            />
          </Form>
        </Box>
      </StoreHeader>

      <Container sx={{ py: { xs: 4, md: 6 } }}>
        {query ? (
          <Stack direction="row" spacing={1} sx={{ mb: 3, alignItems: "center" }}>
            <Typography variant="h6" component="h2">
              Results for “{query}”
            </Typography>
            <Chip size="small" label={`${designs.length}`} />
          </Stack>
        ) : (
          <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
            All designs
          </Typography>
        )}
        <DesignGrid designs={designs} />
      </Container>
    </Box>
  );
}

function DesignImage({ design }: { design: Design }) {
  const first = design.images[0];
  if (first) {
    return (
      <CardMedia
        component="img"
        image={first}
        alt={design.title}
        sx={{ aspectRatio: "4 / 5", objectFit: "cover" }}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={{
        aspectRatio: "4 / 5",
        display: "grid",
        placeItems: "center",
        bgcolor: "rgba(128,0,32,0.08)",
        color: "primary.main",
        fontWeight: 800,
        fontSize: 40,
      }}
    >
      {design.title.slice(0, 1).toUpperCase()}
    </Box>
  );
}

export function DesignCard({ design }: { design: Design }) {
  return (
    <Card sx={{ height: "100%", overflow: "hidden" }}>
      <CardActionArea component={RouterLink} to={`/d/${design.handle}`} sx={{ height: "100%" }}>
        <DesignImage design={design} />
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
            {design.title}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Chip size="small" color="primary" variant="outlined" label={priceLabel(design.prices)} />
            {design.customisation_allowed ? (
              <Chip size="small" variant="outlined" label="Customisable" />
            ) : null}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function DesignGrid({ designs }: { designs: Design[] }) {
  if (designs.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="h6" sx={{ color: "text.secondary" }}>
          Nothing to show here yet.
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
          xs: "1fr 1fr",
          sm: "repeat(3, 1fr)",
          md: "repeat(4, 1fr)",
        },
      }}
    >
      {designs.map((design) => (
        <DesignCard key={design.design_id} design={design} />
      ))}
    </Box>
  );
}
