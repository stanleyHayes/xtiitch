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

// Failures that are usually transient (dropped connection, API restarting)
// get exactly one automatic reload. The sessionStorage flag makes it one
// attempt per visit — a persistent problem lands on the recovery page with a
// manual button instead of a reload loop. A successfully rendered page
// clears the flag (see App), so the next genuine failure can retry again.
const AUTO_RETRY_KEY = "xtiitch:error-auto-retry";

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // A failed fetch rejects as TypeError — Safari says "Load failed", Chrome
  // "Failed to fetch". React Router's data request rejects this way when the
  // connection drops mid-navigation.
  return (
    error instanceof TypeError ||
    /load failed|failed to fetch|networkerror/i.test(error.message)
  );
}

export default function App() {
  const navigation = useNavigation();
  const location = useLocation();
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(AUTO_RETRY_KEY);
    } catch {
      // Storage unavailable (private mode) — the auto-retry simply never arms.
    }
  }, [location.pathname]);
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

// Claims the one automatic retry for this visit: true only on the first
// call. When storage is unavailable (private mode) it refuses — retrying
// blind could reload-loop every 3 seconds on a persistent error.
function claimAutoRetry(): boolean {
  try {
    if (window.sessionStorage.getItem(AUTO_RETRY_KEY)) return false;
    window.sessionStorage.setItem(AUTO_RETRY_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

// Transient-looking failures (dropped connection, API restarting) retry once
// on their own; everything else waits for the owner to choose — the report is
// already on its way either way.
function useAutoRetryOnce(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined" || !claimAutoRetry()) return;
    const timer = window.setTimeout(() => window.location.reload(), 3000);
    return () => window.clearTimeout(timer);
  }, [active]);
}

type RecoveryView = {
  title: string;
  message: string;
  code: string;
  actionLabel: string;
  reload: boolean;
  canAutoRetry: boolean;
};

function recoveryView(
  error: unknown,
  status: number | undefined,
): RecoveryView {
  if (status === 404) {
    return {
      title: "Dashboard page not found",
      message:
        "That dashboard route is not available. It may have moved, or the link may be stale.",
      code: "404",
      actionLabel: "Return to dashboard",
      reload: false,
      canAutoRetry: false,
    };
  }
  if (status !== undefined && [502, 503].includes(status)) {
    return {
      title: "Dashboard API unavailable",
      message:
        "The dashboard app is running, but the API did not respond with the business session data it needs. We're retrying automatically in a few seconds.",
      code: "503",
      actionLabel: "Refresh dashboard",
      reload: true,
      canAutoRetry: true,
    };
  }
  if (isNetworkError(error)) {
    return {
      title: "Connection problem",
      message:
        "The dashboard couldn't reach the server — your connection may have dropped. We're retrying automatically in a few seconds.",
      code: "Error",
      actionLabel: "Try again now",
      reload: true,
      canAutoRetry: true,
    };
  }
  return {
    title: "Something came loose",
    message: "We hit an unexpected error. Please try again in a moment.",
    code: "Error",
    actionLabel: "Return to dashboard",
    reload: false,
    canAutoRetry: false,
  };
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const routeError = useRouteError();
  const resolvedError = error ?? routeError;
  const view = recoveryView(resolvedError, errorStatus(resolvedError));
  useAutoRetryOnce(view.canAutoRetry);
  return (
    <WorkspaceSystemPage
      beforeContent={<CrashReportEffect error={resolvedError} />}
      code={view.code}
      eyebrow={view.code === "404" ? "404 · Not found" : "Workspace alert"}
      title={view.title}
      message={view.message}
      actionHref="/dashboard"
      actionLabel={view.actionLabel}
      reload={view.reload}
    />
  );
}
