import type { MetaDescriptor } from "react-router";
import { pageMeta } from "../components/seo";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Page not found",
    description: "The page you were looking for is not here.",
    path: "/404",
  });
}

// Any unmatched URL returns a real 404. Throwing the response bubbles up to the
// root ErrorBoundary, which renders the friendly not-found page with chrome.
export function loader(): never {
  throw new Response("Not found", { status: 404 });
}

export default function NotFound(): null {
  return null;
}
