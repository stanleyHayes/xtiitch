import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import type { Route } from "./+types/design";
import { api, type Design } from "../lib/api";
import { formatGHS, priceLabel } from "../lib/format";

export async function loader({ params }: Route.LoaderArgs) {
  const design = await api.design(params.handle);
  if (!design) {
    throw new Response("Design not found", { status: 404 });
  }
  return { design };
}

export function meta({ data }: Route.MetaArgs) {
  const title = data?.design.title ?? "Design";
  return [
    { title: `${title} · Xtiitch` },
    { name: "description", content: data?.design.description || `View ${title} on Xtiitch.` },
  ];
}

function Gallery({ design }: { design: Design }) {
  const cover = design.images[0];
  return (
    <Box>
      {cover ? (
        <Box
          component="img"
          src={cover}
          alt={design.title}
          sx={{ width: "100%", borderRadius: 3, aspectRatio: "4 / 5", objectFit: "cover" }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            width: "100%",
            aspectRatio: "4 / 5",
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(128,0,32,0.08)",
            color: "primary.main",
            fontWeight: 800,
            fontSize: 72,
          }}
        >
          {design.title.slice(0, 1).toUpperCase()}
        </Box>
      )}
      {design.images.length > 1 ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {design.images.slice(1, 5).map((src) => (
            <Box
              key={src}
              component="img"
              src={src}
              alt=""
              sx={{ width: 72, height: 90, objectFit: "cover", borderRadius: 1.5 }}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

export default function DesignPage({ loaderData }: Route.ComponentProps) {
  const { design } = loaderData;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <Link
          component={RouterLink}
          to=".."
          relative="path"
          underline="hover"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 3, color: "text.secondary" }}
        >
          <ArrowBackRounded fontSize="small" /> Back to the store
        </Link>

        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "start",
          }}
        >
          <Gallery design={design} />

          <Box>
            <Typography variant="h4" component="h1">
              {design.title}
            </Typography>
            <Typography variant="h5" sx={{ mt: 1.5, color: "primary.main", fontWeight: 700 }}>
              {priceLabel(design.prices)}
            </Typography>

            {design.customisation_allowed ? (
              <Chip variant="outlined" label="Customisable" sx={{ mt: 2 }} />
            ) : null}

            {design.description ? (
              <Typography sx={{ mt: 3, color: "text.secondary", whiteSpace: "pre-line" }}>
                {design.description}
              </Typography>
            ) : null}

            {design.prices.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Sizes &amp; prices
                </Typography>
                <Stack divider={<Divider />} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  {design.prices.map((price) => (
                    <Stack
                      key={price.size_band_id}
                      direction="row"
                      sx={{ justifyContent: "space-between", px: 2, py: 1.25 }}
                    >
                      <Typography>{price.label}</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{formatGHS(price.price_minor)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : null}

            <Button variant="contained" size="large" sx={{ mt: 4 }} disabled>
              Place an order
            </Button>
            <Alert severity="info" sx={{ mt: 2 }}>
              Online ordering and the “where is my cloth?” tracking view are coming to this store.
            </Alert>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
