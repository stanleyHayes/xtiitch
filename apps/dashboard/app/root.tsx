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
  useRouteError,
} from "react-router";
import Box from "@mui/material/Box";
import { fontStylesheetHref, tokens } from "./theme";
import { ThemeModeProvider } from "./theme-mode";
import { WorkspaceSystemPage } from "./components/system-pages";
import {
  CrashReportEffect,
  FeedbackReporter,
} from "./components/feedback/FeedbackReporter";

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
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={tokens.burgundy} />
        {/* Business dashboard — never index. */}
        <meta name="robots" content="noindex, nofollow" />
        {/* Keep social preview metadata in the document shell: React Router route
            metadata replaces parent descriptors, while these tags must survive
            on login, registration, activation and authenticated routes alike. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Xtiitch Business" />
        <meta
          property="og:title"
          content="Xtiitch Business · Run your fashion business"
        />
        <meta
          property="og:description"
          content="Manage orders, customers, designs, fittings, payments and growth from your Xtiitch business workspace."
        />
        <meta property="og:url" content="https://business.xtiitch.com/" />
        <meta
          property="og:image"
          content="https://business.xtiitch.com/og.png"
        />
        <meta
          property="og:image:secure_url"
          content="https://business.xtiitch.com/og.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="Xtiitch business owner dashboard"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Xtiitch Business · Run your fashion business"
        />
        <meta
          name="twitter:description"
          content="Manage orders, customers, designs, fittings, payments and growth from your Xtiitch business workspace."
        />
        <meta
          name="twitter:image"
          content="https://business.xtiitch.com/og.png"
        />
        <meta
          name="twitter:image:alt"
          content="Xtiitch business owner dashboard"
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
      <FeedbackReporter />
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

function errorStatus(error: unknown): number | undefined {
  if (isRouteErrorResponse(error)) {
    return error.status;
  }
  if (error instanceof Response) {
    return error.status;
  }
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown; statusCode?: unknown }).status;
    const statusCode = (error as { status?: unknown; statusCode?: unknown })
      .statusCode;
    if (typeof status === "number") return status;
    if (typeof statusCode === "number") return statusCode;
  }
  return undefined;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const routeError = useRouteError();
  const status = errorStatus(error ?? routeError);
  const is404 = status === 404;
  const isAPIUnavailable = status !== undefined && [502, 503].includes(status);
  const title = is404
    ? "Dashboard page not found"
    : isAPIUnavailable
      ? "Dashboard API unavailable"
      : "Something came loose";
  const message = is404
    ? "That dashboard route is not available. It may have moved, or the link may be stale."
    : isAPIUnavailable
      ? "The dashboard app is running, but the API did not respond with the business session data it needs. Start the API, then refresh."
      : "We hit an unexpected error. Please try again in a moment.";

  const code = is404 ? "404" : isAPIUnavailable ? "503" : "Error";
  return (
    <WorkspaceSystemPage
      beforeContent={<CrashReportEffect error={error ?? routeError} />}
      code={code}
      eyebrow={is404 ? "404 · Not found" : "Workspace alert"}
      title={title}
      message={message}
      actionHref="/dashboard"
      actionLabel={isAPIUnavailable ? "Refresh dashboard" : "Return to dashboard"}
      reload={isAPIUnavailable}
    />
  );
}
