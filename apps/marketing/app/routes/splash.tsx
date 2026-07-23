import type { MetaDescriptor } from "react-router";
import { pageMeta } from "../components/seo";
import { SplashPage } from "../components/system-pages";

export function meta(): MetaDescriptor[] {
  return [
    ...pageMeta({
      title: "Loading",
      description: "Xtiitch is preparing your next screen.",
      path: "/splash",
    }),
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function SplashRoute() {
  return <SplashPage />;
}
