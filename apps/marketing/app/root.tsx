import { type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  type LinksFunction,
} from "react-router";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { theme, tokens } from "./theme";
import { Header, Footer } from "./components/layout";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  {
    rel: "preload",
    href: "/images/atelier-hero.webp",
    as: "image",
    type: "image/webp",
  },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={tokens.burgundy} />
        {/* Anchor for client-inserted Emotion styles; server critical CSS is
            injected just before </head> by entry.server.tsx. */}
        <meta name="emotion-insertion-point" content="" />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              minHeight: "100vh",
            }}
          >
            <Header />
            <Box component="main" sx={{ flexGrow: 1 }}>
              {children}
            </Box>
            <Footer />
          </Box>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const title = is404 ? "Page not found" : "Something went wrong";
  const message = is404
    ? "The page you were looking for is not here. Try the menu, or head back home."
    : "We hit an unexpected error. Please try again in a moment.";

  return (
    <Box
      sx={{ minHeight: "70vh", display: "grid", placeItems: "center", py: 10 }}
    >
      <Container sx={{ textAlign: "center", maxWidth: 560 }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 700 }}
        >
          {is404 ? "404" : "Error"}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ mt: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          {message}
        </Typography>
        <Button href="/" variant="contained" size="large" sx={{ mt: 4 }}>
          Back to home
        </Button>
      </Container>
    </Box>
  );
}
