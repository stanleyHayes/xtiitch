import { type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  type LinksFunction,
  useLocation,
  useNavigation,
} from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { fontStylesheetHref, tokens } from "./theme";
import { ThemeModeProvider } from "./theme-mode";
import { Header, Footer } from "./components/layout";

export const links: LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "shortcut icon", href: "/favicon.ico" },
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
    href: fontStylesheetHref,
  },
];

const readBrandingEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env[key] : undefined;
const BRANDING_API_BASE =
  readBrandingEnv("XTIITCH_API_URL") ?? "http://localhost:8080";
// Self-serve signup lives in the business dashboard app (a separate origin), so
// marketing CTAs link out to {dashboard}/register.
const SIGNUP_URL = `${(
  readBrandingEnv("XTIITCH_DASHBOARD_URL") ?? "http://localhost:3401"
).replace(/\/+$/, "")}/register`;

// Platform branding (logo) is owner-managed in the admin console and served
// publicly, so the marketing site renders the current Xtiitch logo. Failures
// fall back to the built-in mark and never block the page.
export async function loader() {
  try {
    const response = await fetch(`${BRANDING_API_BASE}/v1/branding`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { brandLogoUrl: "", signupUrl: SIGNUP_URL };
    }
    const data = (await response.json()) as { logo_url?: string };
    return { brandLogoUrl: data.logo_url ?? "", signupUrl: SIGNUP_URL };
  } catch {
    return { brandLogoUrl: "", signupUrl: SIGNUP_URL };
  }
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body suppressHydrationWarning>
        <ThemeModeProvider>
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
        </ThemeModeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigation = useNavigation();
  const location = useLocation();
  return (
    <>
      {navigation.state === "loading" ? <RouteProgressBar /> : null}
      {/* Keyed by pathname only (not search), so the page content replays its
          fade-in on real navigations but in-page ?section tab switches don't
          remount. Disabled under prefers-reduced-motion. */}
      <Box
        key={location.pathname}
        sx={{
          animation: "xtiitch-page-fade-in 280ms ease-out both",
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        <Outlet />
      </Box>
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
  const title = is404 ? "Page not found" : "Something went wrong";
  const code = is404 ? "404" : "Error";
  const heading = is404
    ? "This page took a wrong stitch"
    : "Something came undone";
  const message = is404
    ? "We couldn't find that page — it may have moved, or the link wasn't quite right. Let's get you back in good order."
    : "We hit an unexpected error. Give it a moment and try again.";

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "82vh",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        py: { xs: 8, md: 10 },
        bgcolor: "background.default",
      }}
    >
      {/* The seam — a quiet field of running stitches. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.6,
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(128,0,32,0.10) 0 14px, transparent 14px 34px)",
          backgroundSize: "100% 30px",
          maskImage:
            "radial-gradient(80% 70% at 50% 45%, #000 30%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(80% 70% at 50% 45%, #000 30%, transparent 78%)",
        }}
      />
      <Container sx={{ position: "relative", maxWidth: 680 }}>
        <Box sx={{ position: "relative", textAlign: "center" }}>
          <Box
            aria-hidden
            component="p"
            sx={{
              position: "absolute",
              inset: "auto 0 auto 0",
              top: { xs: -28, md: -48 },
              m: 0,
              fontWeight: 800,
              fontSize: { xs: 180, md: 300 },
              lineHeight: 1,
              color: "rgba(128,0,32,0.06)",
              userSelect: "none",
            }}
          >
            {code}
          </Box>
          <Box sx={{ position: "relative" }}>
            <Box
              aria-hidden
              component="svg"
              viewBox="1.4 3.8 97.2 97.2"
              sx={{
                width: 64,
                height: 64,
                mx: "auto",
                display: "block",
                mb: 3,
              }}
            >
              <line
                x1="37"
                y1="40"
                x2="37"
                y2="74"
                stroke="#800020"
                strokeWidth="15"
                strokeLinecap="round"
              />
              <line
                x1="63"
                y1="40"
                x2="63"
                y2="74"
                stroke="#800020"
                strokeWidth="15"
                strokeLinecap="round"
              />
              <circle cx="37" cy="22" r="8.2" fill="#800020" />
              <circle cx="63" cy="22" r="8.2" fill="#800020" />
              <path
                d="M37 72.5 Q50 91 63 72.5"
                stroke="#800020"
                strokeWidth="4.5"
                fill="none"
                strokeLinecap="round"
              />
            </Box>
            <Typography
              variant="overline"
              sx={{
                color: "primary.main",
                fontWeight: 800,
                letterSpacing: "0.1em",
              }}
            >
              {code} · {title}
            </Typography>
            <Typography
              variant="h2"
              component="h1"
              sx={{ mt: 1.5, fontSize: { xs: 32, md: 44 } }}
            >
              {heading}
            </Typography>
            <Typography
              sx={{ mt: 2, color: "text.secondary", maxWidth: 520, mx: "auto" }}
            >
              {message}
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ mt: 4, justifyContent: "center" }}
            >
              <Button href="/" variant="contained" size="large">
                Back to home
              </Button>
              {is404 ? (
                <Button href="/discover" variant="outlined" size="large">
                  Browse shops
                </Button>
              ) : null}
            </Stack>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
