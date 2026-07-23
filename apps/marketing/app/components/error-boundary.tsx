import { isRouteErrorResponse, useRouteError } from "react-router";
import { MarketingSystemPage } from "./system-pages";

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
  const actualError = error ?? routeError;
  const is404 = errorStatus(actualError) === 404;
  const title = is404 ? "Page not found" : "Something went wrong";
  const code = is404 ? "404" : "Error";
  const heading = is404 ? "We could not find that page" : "Something came undone";
  const message = is404
    ? "The link may have moved, expired, or never existed. You can return home or browse the live Xtiitch directory."
    : "We hit an unexpected error. Give it a moment and try again.";

  return (
    <MarketingSystemPage
      code={code}
      eyebrow={`${code} · ${title}`}
      title={heading}
      message={message}
      primaryHref="/"
      primaryLabel="Back home"
      secondaryHref={is404 ? "/discover" : undefined}
      secondaryLabel={is404 ? "Browse shops" : undefined}
    />
  );
}
