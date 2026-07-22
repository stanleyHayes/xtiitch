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
import { alpha } from "@mui/material/styles";
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
        {/* Operator console — never index. */}
        <meta name="robots" content="noindex, nofollow" />
        {/* Route metadata replaces parent descriptors, so social tags live in
            the shell and remain present on every private admin route. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Xtiitch Admin" />
        <meta
          property="og:title"
          content="Xtiitch Admin · Secure platform operations"
        />
        <meta
          property="og:description"
          content="Secure access to Xtiitch platform operations, verification, subscriptions, payments and service health."
        />
        <meta property="og:url" content="https://admin.xtiitch.com/" />
        <meta property="og:image" content="https://admin.xtiitch.com/og.png" />
        <meta
          property="og:image:secure_url"
          content="https://admin.xtiitch.com/og.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="Xtiitch secure administration console"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Xtiitch Admin · Secure platform operations"
        />
        <meta
          name="twitter:description"
          content="Secure access to Xtiitch platform operations, verification, subscriptions, payments and service health."
        />
        <meta name="twitter:image" content="https://admin.xtiitch.com/og.png" />
        <meta
          name="twitter:image:alt"
          content="Xtiitch secure administration console"
        />
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
      {navigation.state === "loading" ? <RouteProgressBar /> : null}
      <Outlet />
    </>
  );
}

// A thin top progress bar shown only while a page route is loading — replaces the
// old full-page skeleton card that flashed over the UI on every form submit.
function RouteProgressBar() {
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 2400,
        overflow: "hidden",
        pointerEvents: "none",
        bgcolor: "rgba(128, 0, 32, 0.12)",
        "@keyframes routeProgressSlide": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, transparent, ${tokens.burgundy}, transparent)`,
          animation: "routeProgressSlide 1.1s ease-in-out infinite",
        },
      }}
    />
  );
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;
  const isAPIUnavailable =
    isRouteErrorResponse(error) && [502, 503].includes(error.status);
  const title = is404
    ? "Admin page not found"
    : isAPIUnavailable
      ? "Admin API unavailable"
      : "Admin console unavailable";
  const message = is404
    ? "That operator route does not exist in this console. The link may be wrong, or the section may have moved."
    : isAPIUnavailable
      ? "The console is running, but the API did not respond. Start the API, then reopen the console."
      : "The admin surface hit an unexpected error. Try again in a moment.";
  const code = is404 ? "404" : isAPIUnavailable ? "503" : "Error";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        px: 3,
        color: tokens.white,
        background: `radial-gradient(circle at 50% 16%, ${alpha(tokens.burgundy, 0.42)}, transparent 56%), linear-gradient(160deg, ${tokens.ink} 0%, ${tokens.charcoal} 100%)`,
      }}
    >
      {/* Faint operator grid, masked to a soft vignette. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${alpha(tokens.white, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.white, 0.045)} 1px, transparent 1px)`,
          backgroundSize: "42px 42px",
          maskImage:
            "radial-gradient(circle at 50% 40%, #000 0%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 40%, #000 0%, transparent 72%)",
        }}
      />
      <Container
        sx={{ position: "relative", textAlign: "center", maxWidth: 560 }}
      >
        <Box
          component="img"
          src="/favicon.svg"
          alt="Xtiitch"
          sx={{
            width: 54,
            height: 54,
            borderRadius: "15px",
            mb: 3,
            boxShadow: `0 18px 50px ${alpha(tokens.ink, 0.6)}`,
          }}
        />
        <Typography
          aria-hidden
          sx={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 600,
            fontSize: { xs: 78, md: 110 },
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            color: tokens.white,
          }}
        >
          {code}
        </Typography>
        <Box
          aria-hidden
          sx={{
            width: 132,
            mx: "auto",
            my: 2.5,
            borderBottom: `2px dashed ${alpha(tokens.white, 0.32)}`,
          }}
        />
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontFamily: '"Fraunces", Georgia, serif',
            fontWeight: 600,
            color: tokens.white,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            mt: 1.5,
            color: alpha(tokens.white, 0.7),
            maxWidth: 440,
            mx: "auto",
            lineHeight: 1.6,
          }}
        >
          {message}
        </Typography>
        <Button
          href="/admin"
          variant="contained"
          size="large"
          sx={{ mt: 4, bgcolor: tokens.burgundy }}
        >
          Open console
        </Button>
        <Typography
          sx={{
            mt: 5,
            color: alpha(tokens.white, 0.42),
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Xtiitch operations
        </Typography>
      </Container>
    </Box>
  );
}
