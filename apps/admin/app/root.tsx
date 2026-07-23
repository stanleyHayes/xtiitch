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
  useRouteError,
} from "react-router";
import Box from "@mui/material/Box";
import { fontStylesheetHref, tokens } from "./theme";
import { ThemeModeProvider } from "./theme-mode";
import { AdminSystemPage } from "./components/system-pages";

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
    <AdminSystemPage
      code={code}
      eyebrow={is404 ? "404 · Not found" : "Operations alert"}
      title={title}
      message={message}
      actionHref="/admin"
      actionLabel={isAPIUnavailable ? "Reload console" : "Open console"}
      reload={!is404}
    />
  );
}
