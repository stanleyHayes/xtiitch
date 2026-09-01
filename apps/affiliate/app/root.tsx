import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
  type LinksFunction
} from "react-router";
import stylesheet from "./styles.css?url";

export const links: LinksFunction = () => [
  // Same mark the dashboard, admin, marketing and storefront apps ship, so the
  // portal is recognisably the same product in a tab strip.
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "shortcut icon", href: "/favicon.ico" },
  { rel: "apple-touch-icon", href: "/favicon.svg" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous"
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap"
  },
  { rel: "stylesheet", href: stylesheet }
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6f1734" />
        <meta name="robots" content="noindex, nofollow" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

// One message for every failure told the affiliate nothing: a missing page, an
// API outage and a genuine bug all read "We could not load this page", and all
// offered the same "return to sign in" — useless when you are already signed in
// and the service is simply down. Each case now says what happened and offers
// the action that can actually help.
type Recovery = {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  retry: boolean;
};

function recoveryFor(status: number | undefined): Recovery {
  if (status === 404) {
    return {
      title: "That page does not exist.",
      body: "The link may be out of date, or the page may have moved.",
      actionLabel: "Go to your portal",
      actionHref: "/portal",
      retry: false
    };
  }
  if (status === 401 || status === 403) {
    return {
      title: "Your session has ended.",
      body: "Sign in again to get back to your portal. Your earnings and links are unaffected.",
      actionLabel: "Sign in",
      actionHref: "/login",
      retry: false
    };
  }
  if (status === 503 || status === 502) {
    return {
      title: "We can't reach the service right now.",
      body: "This is on our side, not yours — nothing you did caused it and nothing has been lost. Try again in a moment.",
      actionLabel: "Try again",
      actionHref: "/portal",
      retry: true
    };
  }
  if (status === 429) {
    return {
      title: "Too many requests.",
      body: "Wait a moment before trying again.",
      actionLabel: "Back to your portal",
      actionHref: "/portal",
      retry: true
    };
  }
  return {
    title: "Something went wrong.",
    body: "We hit an unexpected error. Trying again often clears it; if it keeps happening, contact Xtiitch support.",
    actionLabel: "Back to your portal",
    actionHref: "/portal",
    retry: true
  };
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const view = recoveryFor(status);

  return (
    <main className="system-page">
      <p className="eyebrow">Xtiitch Partner portal</p>
      <h1>{view.title}</h1>
      <p className="lede">{view.body}</p>
      <div className="system-actions">
        <a className="button" href={view.actionHref}>
          {view.actionLabel}
        </a>
        {view.retry ? (
          <a className="ghost-button" href="/login">
            Sign in again
          </a>
        ) : null}
      </div>
    </main>
  );
}
