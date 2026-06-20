import { type ReactNode, useEffect } from "react";
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
import { alpha } from "@mui/material/styles";
import { fontStylesheetHref, tokens } from "./theme";
import { ThemeModeProvider } from "./theme-mode";

// First-paint splash: server-rendered so it shows instantly, then fades out once
// React hydrates (App sets data-hydrated on <html>). Kept in the React tree and
// hidden via CSS — never removed imperatively — so hydration stays clean.
const splashStyles = `
#xtiitch-splash {
  position: fixed; inset: 0; z-index: 4000;
  display: grid; place-items: center;
  background:
    radial-gradient(circle at 50% 32%, rgba(128,0,32,0.38), transparent 58%),
    linear-gradient(160deg, #15111a 0%, #241f2b 100%);
  opacity: 1; visibility: visible;
}
html[data-hydrated] #xtiitch-splash {
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity 480ms ease, visibility 0s linear 480ms;
}
#xtiitch-splash .xs-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 18px;
}
#xtiitch-splash .xs-mark {
  width: 64px; height: 64px; border-radius: 18px; display: block;
  box-shadow: 0 18px 50px rgba(0,0,0,0.45);
}
#xtiitch-splash .xs-word {
  font-family: "Fraunces", Georgia, serif; color: #faf6f2;
  font-size: 24px; font-weight: 600; letter-spacing: 0.4px;
}
#xtiitch-splash .xs-bar {
  position: relative; width: 124px; height: 3px; border-radius: 999px;
  background: rgba(250,246,242,0.14); overflow: hidden;
}
#xtiitch-splash .xs-bar::after {
  content: ""; position: absolute; top: 0; left: 0; height: 100%; width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #800020, transparent);
}
#xtiitch-splash .xs-motto {
  color: rgba(250,246,242,0.5); font-size: 11px; letter-spacing: 2px;
  text-transform: uppercase;
}
@media (prefers-reduced-motion: no-preference) {
  #xtiitch-splash .xs-mark { animation: xsPulse 1.6s ease-in-out infinite; }
  #xtiitch-splash .xs-bar::after { animation: xsSlide 1.15s ease-in-out infinite; }
}
@keyframes xsPulse { 0%,100% { transform: scale(1); opacity: 0.92; } 50% { transform: scale(1.06); opacity: 1; } }
@keyframes xsSlide { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
`;

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

const readBrandingEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env[key] : undefined;
const BRANDING_API_BASE =
  readBrandingEnv("XTIITCH_API_URL") ?? "http://localhost:8080";

// Platform branding (logo) is owner-managed in the admin console and served
// publicly, so the dashboard renders the current Xtiitch platform logo on the
// sign-in screen. Failures fall back to the built-in mark and never block the
// page. This is the PLATFORM mark only — merchant business branding is separate.
export async function loader() {
  try {
    const response = await fetch(`${BRANDING_API_BASE}/v1/branding`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { brandLogoUrl: "" };
    }
    const data = (await response.json()) as { logo_url?: string };
    return { brandLogoUrl: data.logo_url ?? "" };
  } catch {
    return { brandLogoUrl: "" };
  }
}

export function Layout({ children }: { children: ReactNode }) {
  // Fade the first-paint splash once hydrated. Lives here (not in the default
  // App component) so it also fires on error/404 routes, where React Router
  // renders ErrorBoundary instead of App.
  useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "true");
  }, []);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={tokens.burgundy} />
        {/* Business dashboard — never index. */}
        <meta name="robots" content="noindex, nofollow" />
        <meta name="emotion-insertion-point" content="" />
        <Meta />
        <Links />
      </head>
      <body suppressHydrationWarning>
        {/* Splash CSS lives in the body, not the head: React 19 reorders head
            <style> tags and the client emotion cache inserts its styles at the
            emotion-insertion-point meta — both collide with a head <style> and
            break hydration. A body <style> (no `precedence`) stays in place,
            the same pattern theme-mode.tsx already uses safely. */}
        <style dangerouslySetInnerHTML={{ __html: splashStyles }} />
        <div id="xtiitch-splash" aria-hidden="true">
          <div className="xs-wrap">
            <img
              className="xs-mark"
              src="/favicon.svg"
              alt=""
              width={64}
              height={64}
            />
            <div className="xs-word">Xtiitch</div>
            <div className="xs-bar" />
            <div className="xs-motto">Fashion, in good order.</div>
          </div>
        </div>
        <ThemeModeProvider>{children}</ThemeModeProvider>
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
      {navigation.state !== "idle" ? <RouteProgressBar /> : null}
      {/* Keyed by pathname only (not search), so the page content replays its
          fade-in on real navigations but in-page ?section tab switches don't
          remount. Disabled under prefers-reduced-motion. */}
      <Box
        key={location.pathname}
        sx={{
          // Opacity-only fade — deliberately NO transform. With fill-mode `both`,
          // animating `transform` leaves a retained identity matrix
          // (matrix(1,0,0,1,0,0)) on this wrapper even when the `to` keyframe omits
          // it, and ANY transform other than `none` turns this wrapper into a
          // containing block — which made the dashboard's `position: fixed` rail
          // resolve against this ~2600px box (top/bottom inset off it) and scroll
          // with the page. Dropping the translate keeps the fade and guarantees
          // fixed descendants pin to the viewport. (147dcbc tried to end at no
          // transform but the identity matrix still leaked; this removes it.)
          "@keyframes xtiitchPageFadeIn": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
          animation: "xtiitchPageFadeIn 280ms ease-out both",
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
  const isAPIUnavailable =
    isRouteErrorResponse(error) && [502, 503].includes(error.status);
  const title = is404
    ? "We lost the thread"
    : isAPIUnavailable
      ? "Dashboard API unavailable"
      : "Something came loose";
  const message = is404
    ? "This store or design is not available. The link may be wrong, or the item may have been removed."
    : isAPIUnavailable
      ? "The dashboard app is running, but the API did not respond with the business session data it needs. Start the API, then refresh."
      : "We hit an unexpected error. Please try again in a moment.";

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
      {/* Faint grid, masked to a soft vignette. */}
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
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: "center", mt: 4, flexWrap: "wrap" }}
        >
          <Button
            href="/dashboard"
            variant="contained"
            size="large"
            sx={{ bgcolor: tokens.burgundy }}
          >
            Return to dashboard
          </Button>
        </Stack>
        <Typography
          sx={{
            mt: 5,
            color: alpha(tokens.white, 0.42),
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Fashion, in good order.
        </Typography>
      </Container>
    </Box>
  );
}
