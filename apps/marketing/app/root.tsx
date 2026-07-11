import { type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type LinksFunction,
  useLocation,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import Box from "@mui/material/Box";
import { fontStylesheetHref, tokens } from "./theme";
import { ThemeModeProvider } from "./theme-mode";
import { Header, Footer } from "./components/layout";
import { RouteProgressBar } from "./components/route-progress-bar";

export { ErrorBoundary } from "./components/error-boundary";

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

// The customer marketplace (store.xtiitch.com). Derived from the same env the
// per-shop links use, so the navbar's "Browse the store" button points at the
// right host in every environment.
const MARKETPLACE_URL = (() => {
  const configured = readBrandingEnv("XTIITCH_STOREFRONT_BASE_URL")?.replace(
    /\/+$/,
    "",
  );
  if (configured?.includes("{handle}")) {
    return configured.replace("{handle}", "store");
  }
  if (configured) return configured;
  return "https://store.xtiitch.com";
})();

// Pre-launch feature flags read from the public branding endpoint. Every flag
// means "this feature is LIVE/shown" — so the fail-safe default is `false`
// (hidden), which must hold on any fetch error so a network blip can never
// reveal a pre-launch feature or crash the page.
export type MarketingFlags = {
  browse_store: boolean;
  discover: boolean;
  create_store: boolean;
  pricing: boolean;
};

const DEFAULT_MARKETING_FLAGS: MarketingFlags = {
  browse_store: false,
  discover: false,
  create_store: false,
  pricing: false,
};

function coerceMarketingFlags(input: unknown): MarketingFlags {
  if (typeof input !== "object" || input === null) {
    return DEFAULT_MARKETING_FLAGS;
  }
  const flags = input as Record<string, unknown>;
  return {
    browse_store: flags.browse_store === true,
    discover: flags.discover === true,
    create_store: flags.create_store === true,
    pricing: flags.pricing === true,
  };
}

export type RootLoaderData = {
  brandLogoUrl: string;
  signupUrl: string;
  marketplaceUrl: string;
  marketingFlags: MarketingFlags;
};

// Platform branding (logo) is owner-managed in the admin console and served
// publicly, so the marketing site renders the current Xtiitch logo. The same
// endpoint carries the pre-launch marketing feature flags. Failures fall back
// to the built-in mark and all-hidden flags, and never block the page.
export async function loader(): Promise<RootLoaderData> {
  const fallback: RootLoaderData = {
    brandLogoUrl: "",
    signupUrl: SIGNUP_URL,
    marketplaceUrl: MARKETPLACE_URL,
    marketingFlags: DEFAULT_MARKETING_FLAGS,
  };
  try {
    const response = await fetch(`${BRANDING_API_BASE}/v1/branding`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return fallback;
    }
    const data = (await response.json()) as {
      logo_url?: string;
      marketing_flags?: unknown;
    };
    return {
      brandLogoUrl: data.logo_url ?? "",
      signupUrl: SIGNUP_URL,
      marketplaceUrl: MARKETPLACE_URL,
      marketingFlags: coerceMarketingFlags(data.marketing_flags),
    };
  } catch {
    return fallback;
  }
}

// Shared accessor for the pre-launch flags. Reads the root loader data from any
// route/component; defaults to all-hidden if the root data is somehow absent so
// the fail-safe holds everywhere.
export function useMarketingFlags(): MarketingFlags {
  const rootData = useRouteLoaderData("root") as RootLoaderData | undefined;
  return rootData?.marketingFlags ?? DEFAULT_MARKETING_FLAGS;
}

// Organization + WebSite structured data (JSON-LD) for search engines and rich
// results. Static brand facts, rendered once in the document head. The `<`
// escape guards the inline <script> against early termination.
const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://xtiitch.com/#organization",
      name: "Xtiitch",
      url: "https://xtiitch.com",
      logo: "https://xtiitch.com/og.png",
      description:
        "Xtiitch is the operating system for fashion businesses in Ghana — a real online store, plus orders, customers, payments and order tracking in one place.",
      slogan: "Fashion, in good order.",
    },
    {
      "@type": "WebSite",
      "@id": "https://xtiitch.com/#website",
      url: "https://xtiitch.com",
      name: "Xtiitch",
      publisher: { "@id": "https://xtiitch.com/#organization" },
    },
  ],
}).replace(/</g, "\\u003c");

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: STRUCTURED_DATA }}
        />
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
