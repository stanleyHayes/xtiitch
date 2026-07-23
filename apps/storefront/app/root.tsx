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
import { fetchWithTimeout } from "./lib/server-fetch";
import { StorefrontSystemPage } from "./components/system-pages";
import {
  CrashReportEffect,
  FeedbackReporter,
} from "./components/feedback/FeedbackReporter";

const readBrandingEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env[key] : undefined;
const BRANDING_API_BASE =
  readBrandingEnv("XTIITCH_API_URL") ?? "http://localhost:8080";

// Platform branding (logo) is owner-managed in the admin console and served
// publicly, so the storefront renders the current Xtiitch platform mark wherever
// it points back at Xtiitch. Failures fall back to the built-in mark and never
// block the page. Only the PLATFORM logo is swapped here — never a merchant's
// own store logo.
export async function loader() {
  try {
    const response = await fetchWithTimeout(
      `${BRANDING_API_BASE}/v1/branding`,
      {
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok) {
      return {
        brandLogoUrl: "",
        whatsappEnabled: false,
        phoneOtpEnabled: false,
      };
    }
    const data = (await response.json()) as {
      logo_url?: string;
      whatsapp_enabled?: boolean;
      phone_otp_enabled?: boolean;
    };
    return {
      brandLogoUrl: data.logo_url ?? "",
      whatsappEnabled: data.whatsapp_enabled ?? false,
      // A code can reach a phone over SMS OR WhatsApp — the storefront gates its
      // phone sign-in on this, not on WhatsApp alone (SMS is the default channel).
      phoneOtpEnabled: data.phone_otp_enabled ?? false,
    };
  } catch {
    return { brandLogoUrl: "", whatsappEnabled: false, phoneOtpEnabled: false };
  }
}

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
          "@keyframes xtiitchPageFadeIn": {
            from: { opacity: 0, transform: "translateY(6px)" },
            to: { opacity: 1, transform: "translateY(0)" },
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
  const title = is404 ? "Not found" : "Something went wrong";
  const message = is404
    ? "This store, design or order page is not available. The link may be wrong, or the item may have been removed."
    : "We hit an unexpected error. Please try again in a moment.";

  return (
    <StorefrontSystemPage
      beforeContent={<CrashReportEffect error={error ?? routeError} />}
      code={is404 ? "404" : "Error"}
      eyebrow={is404 ? "404 · Not found" : "Storefront error"}
      title={title}
      message={message}
      primaryHref="/"
      primaryLabel="Back to storefront"
      secondaryHref={is404 ? "/discover" : undefined}
      secondaryLabel={is404 ? "Browse studios" : undefined}
    />
  );
}
