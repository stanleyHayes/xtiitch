import { useRouteError } from "react-router";
import { ErrorBoundary as RootErrorBoundary } from "../root";

export function loader() {
  throw new Response("Not found", { status: 404 });
}

export default function NotFound() {
  return null;
}

export function ErrorBoundary() {
  return <RootErrorBoundary error={useRouteError()} />;
}
