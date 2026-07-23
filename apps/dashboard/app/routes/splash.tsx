import type { MetaDescriptor } from "react-router";
import { SplashPage } from "../components/system-pages";

export function meta(): MetaDescriptor[] {
  return [
    { title: "Loading · Xtiitch Business" },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

export default function SplashRoute() {
  return <SplashPage />;
}
