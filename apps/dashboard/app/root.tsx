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

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap",
  },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={tokens.burgundy} />
        <meta name="emotion-insertion-point" content="" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
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
  const isAPIUnavailable =
    isRouteErrorResponse(error) && [502, 503].includes(error.status);
  const title = is404
    ? "Not found"
    : isAPIUnavailable
      ? "Dashboard API unavailable"
      : "Something went wrong";
  const message = is404
    ? "This store or design is not available. The link may be wrong, or the item may have been removed."
    : isAPIUnavailable
      ? "The dashboard app is running, but the API did not respond with the business session data it needs. Start the API, then refresh."
      : "We hit an unexpected error. Please try again in a moment.";

  return (
    <Box
      sx={{
        minHeight: "80vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Container sx={{ textAlign: "center", maxWidth: 520 }}>
        <Typography
          variant="overline"
          sx={{ color: "primary.main", fontWeight: 700 }}
        >
          {is404 ? "404" : isAPIUnavailable ? "503" : "Error"}
        </Typography>
        <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          {message}
        </Typography>
        <Button
          href="/dashboard"
          variant="contained"
          size="large"
          sx={{ mt: 4 }}
        >
          Return to dashboard
        </Button>
      </Container>
    </Box>
  );
}
