import type { MetaDescriptor } from "react-router";
import { SplashPage } from "../components/system-pages";

export function meta(): MetaDescriptor[] {
  return [
    { title: "Loading · Xtiitch" },
    { name: "description", content: "Xtiitch storefront is loading." },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function SplashRoute() {
  return <SplashPage />;
}
