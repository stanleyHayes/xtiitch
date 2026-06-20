import { type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  type LinksFunction,
  useNavigation,
} from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { fontStylesheetHref, tokens } from "./theme";
import { ThemeModeProvider } from "./theme-mode";

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
    href: fontStylesheetHref,
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
        <ThemeModeProvider>{children}</ThemeModeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  return (
    <>
      <Outlet />
      {navigation.state !== "idle" ? <RoutePendingSkeleton /> : null}
    </>
  );
}

function RoutePendingSkeleton() {
  return (
    <Box
      aria-live="polite"
      aria-busy="true"
      sx={{
        position: "fixed",
        inset: { xs: 12, sm: 20 },
        zIndex: 2400,
        pointerEvents: "none",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: "min(760px, 100%)",
          p: { xs: 2, sm: 2.5 },
          borderRadius: 3,
          bgcolor: "rgba(var(--surface-rgb), 0.94)",
          border: "1px solid rgba(128,0,32,0.14)",
          boxShadow: "0 24px 80px rgba(21,17,26,0.18)",
          backdropFilter: "blur(18px)",
        }}
      >
        <Stack spacing={1.4}>
          <Skeleton variant="rounded" width="38%" height={18} />
          <Skeleton variant="rounded" width="100%" height={42} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 1.2,
            }}
          >
            <Skeleton variant="rounded" height={74} />
            <Skeleton variant="rounded" height={74} />
            <Skeleton variant="rounded" height={74} />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const title = is404 ? "Admin page not found" : "Admin console unavailable";
  const message = is404
    ? "That operator route does not exist in this console."
    : "The admin surface hit an unexpected error. Try again after a moment.";

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
          sx={{ color: "primary.main", fontWeight: 800 }}
        >
          {is404 ? "404" : "Admin"}
        </Typography>
        <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ mt: 2, color: "text.secondary" }}>
          {message}
        </Typography>
        <Button href="/admin" variant="contained" size="large" sx={{ mt: 4 }}>
          Open console
        </Button>
      </Container>
    </Box>
  );
}
