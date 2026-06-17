import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";
import type { Route } from "./+types/home";
import { api } from "../lib/api";
import { storeHandleFromHost } from "../lib/tenant";
import { StoreView } from "../components/storefront";

// The storefront root. On a business subdomain (<handle>.xtiitch.com) it
// resolves and renders that store; on the apex/www it shows the generic landing.
export async function loader({ request }: Route.LoaderArgs) {
  const handle = storeHandleFromHost(request.headers.get("host"));
  if (!handle) {
    return { mode: "landing" as const };
  }

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query) {
    const page = await api.search(handle, query);
    if (!page) {
      throw new Response("Store not found", { status: 404 });
    }
    return {
      mode: "store" as const,
      store: page.store,
      designs: page.designs,
      collections: [],
      query,
    };
  }

  const page = await api.store(handle);
  if (!page) {
    throw new Response("Store not found", { status: 404 });
  }
  return {
    mode: "store" as const,
    store: page.store,
    designs: page.designs,
    collections: page.collections,
    query: "",
  };
}

export function meta({ data }: Route.MetaArgs) {
  if (data?.mode === "store") {
    return [
      { title: `${data.store.name} · Xtiitch` },
      {
        name: "description",
        content: `Browse and order from ${data.store.name} on Xtiitch.`,
      },
    ];
  }
  return [
    { title: "Xtiitch Storefronts" },
    {
      name: "description",
      content: "Open a fashion business's Xtiitch store to browse and order.",
    },
    { name: "robots", content: "noindex" },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.mode === "store") {
    return (
      <StoreView
        store={loaderData.store}
        designs={loaderData.designs}
        collections={loaderData.collections}
        query={loaderData.query}
      />
    );
  }
  return <Landing />;
}

function Landing() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Container sx={{ textAlign: "center", maxWidth: 560, py: 8 }}>
        <Box
          aria-hidden
          sx={{
            width: 64,
            height: 64,
            mx: "auto",
            mb: 3,
            borderRadius: 2,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "grid",
            placeItems: "center",
          }}
        >
          <StorefrontOutlined fontSize="large" />
        </Box>
        <Typography variant="h4" component="h1">
          This is where Xtiitch stores live
        </Typography>
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          Open the store link a fashion business shared with you to browse their
          designs, see prices, and place an order — no account needed to look.
        </Typography>
        <Button
          href="https://xtiitch.com"
          variant="contained"
          size="large"
          sx={{ mt: 4 }}
        >
          Learn about Xtiitch
        </Button>
      </Container>
    </Box>
  );
}
