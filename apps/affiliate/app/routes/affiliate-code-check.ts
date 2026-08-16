import type { LoaderFunctionArgs } from "react-router";
import { affiliateAPI } from "../lib/api.server";

type CodeAvailability = {
  code: string;
  available: boolean;
  reason: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return Response.json({ code: "", available: false, reason: "invalid" });
  }
  try {
    const result = await affiliateAPI<CodeAvailability>(
      `/public/affiliate-code-availability?code=${encodeURIComponent(code)}`,
      { method: "GET" },
    );
    return Response.json(result);
  } catch {
    return Response.json({ code, available: false, reason: "error" });
  }
}
