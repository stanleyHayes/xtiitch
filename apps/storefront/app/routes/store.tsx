import { Form } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import SearchRounded from "@mui/icons-material/SearchRounded";
import type { Route } from "./+types/store";
import { api } from "../lib/api";
import { DesignGrid, StoreHeader } from "../components/storefront";

export async function loader({ params, request }: Route.LoaderArgs) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

  if (query) {
    const result = await api.search(params.handle, query);
    if (!result) {
      throw new Response("Store not found", { status: 404 });
    }
    return { store: result.store, designs: result.designs, query };
  }

  const page = await api.store(params.handle);
  if (!page) {
    throw new Response("Store not found", { status: 404 });
  }
  return { store: page.store, designs: page.designs, query: "" };
}

export function meta({ data }: Route.MetaArgs) {
  const name = data?.store.name ?? "Store";
  return [
    { title: `${name} · Xtiitch` },
    { name: "description", content: `Browse and order from ${name} on Xtiitch.` },
  ];
}

export default function Store({ loaderData }: Route.ComponentProps) {
  const { store, designs, query } = loaderData;

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
