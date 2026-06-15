import type { MetaDescriptor } from "react-router";

export function meta(): MetaDescriptor[] {
  return [{ title: "Not found · Xtiitch" }, { name: "robots", content: "noindex" }];
}

export function loader(): never {
  throw new Response("Not found", { status: 404 });
}

export default function NotFound(): null {
  return null;
}
