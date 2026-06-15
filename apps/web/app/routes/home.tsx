import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";

export function meta(): MetaDescriptor[] {
  return [
    { title: "Xtiitch Storefronts" },
    { name: "description", content: "Open a fashion business's Xtiitch store to browse and order." },
    { name: "robots", content: "noindex" },
  ];
}

export default function Home() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default" }}>
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
          Open the store link a fashion business shared with you to browse their designs, see prices,
          and place an order — no account needed to look.
        </Typography>
        <Button href="https://xtiitch.com" variant="contained" size="large" sx={{ mt: 4 }}>
          Learn about Xtiitch
        </Button>
      </Container>
    </Box>
  );
}
