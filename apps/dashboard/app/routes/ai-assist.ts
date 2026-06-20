import type { ActionFunctionArgs } from "react-router";
import { apiFetch } from "../lib/auth";

// Resource route backing the ✨ AI writing assistant. The dashboard's API tokens
// live in an httpOnly cookie and never reach the browser, so the ✨ button posts
// here (same-origin, cookie sent automatically) and this action forwards the
// request to POST /v1/ai/assist with the session's access token attached.
//
// It mirrors the API contract: { result } on success, or a 402 with
// { code: "addon_inactive" } when the AI Assistant add-on is inactive, so the UI
// can show the enable-add-on prompt. There is no loader/component export, so this
// module is a pure resource route.

const MAX_TEXT_LEN = 4000;

type AssistApiResponse = {
  result?: string;
  error?: string;
  code?: string;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let payload: { text?: unknown; instruction?: unknown; field?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const instruction =
    typeof payload.instruction === "string" ? payload.instruction : "improve";
  const field = typeof payload.field === "string" ? payload.field : "";

  if (!text) {
    return Response.json({ error: "empty_text", code: "empty_text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LEN) {
    return Response.json({ error: "text_too_long", code: "text_too_long" }, { status: 400 });
  }

  // apiFetch throws a redirect to /login when there is no/expired session; that
  // surfaces to the fetcher as a navigation, which is the desired behaviour.
  const response = await apiFetch(request, "/ai/assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, instruction, field }),
  });

  const body = (await response.json().catch(() => null)) as AssistApiResponse | null;

  if (response.status === 402) {
    return Response.json(
      { error: "addon_inactive", code: "addon_inactive" },
      { status: 402 },
    );
  }
  if (!response.ok || !body || typeof body.result !== "string") {
    return Response.json({ error: body?.error ?? "assist_failed" }, { status: 502 });
  }

  return Response.json({ result: body.result });
}
