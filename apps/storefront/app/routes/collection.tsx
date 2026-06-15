import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import type { Route } from "./+types/collection";
import { api } from "../lib/api";
import { DesignGrid } from "../components/storefront";

export async function loader({ params }: Route.LoaderArgs) {
  const page = await api.collection(params.handle);
  if (!page) {
    throw new Response("Collection not found", { status: 404 });
  }
  return { collection: page.collection, designs: page.designs };
}

export function meta({ data }: Route.MetaArgs) {
  const name = data?.collection.name ?? "Collection";
  return [
    { title: `${name} · Xtiitch` },
    { name: "description", content: data?.collection.theme || `Browse the ${name} collection on Xtiitch.` },
  ];
}

export default function CollectionPage({ loaderData }: Route.ComponentProps) {
  const { collection, designs } = loaderData;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box sx={{ bgcolor: "secondary.main", color: "common.white" }}>
        <Container sx={{ py: { xs: 4, md: 6 } }}>
          <Typography variant="overline" sx={{ opacity: 0.7 }}>
            Collection
          </Typography>
          <Typography variant="h3" component="h1">
            {collection.name}
          </Typography>
          {collection.theme ? (
            <Typography sx={{ mt: 1, opacity: 0.85, maxWidth: 560 }}>{collection.theme}</Typography>
          ) : null}
        </Container>
      </Box>

      <Container sx={{ py: { xs: 4, md: 6 } }}>
        <DesignGrid designs={designs} />
      </Container>
    </Box>
  );
}
