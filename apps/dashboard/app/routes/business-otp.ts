import type { ActionFunctionArgs } from "react-router";
import { fetchApi } from "../lib/api-base";

// Resource route backing the WhatsApp one-time-code "Send code" buttons on the
// sign-in and sign-up forms. The Go API base is configured server-side and is
// not reachable from the browser, so the button posts to this same-origin route
// and we forward to the public OTP-request endpoint server-side (mirrors the
// handle-check proxy pattern).
//
// The request endpoints are opaque by design — the API always answers 202 so
// the UI never reveals whether an account/number exists. We mirror that: any
// reachable response resolves to { ok: true } so the form always advances to
// the code-entry step. Only a network fault reaching the API returns an error,
// so the button can offer a retry. There is no loader/component export, so this
// module is a pure resource route.

type OtpRequestBody = {
  intent?: unknown;
  business_handle?: unknown;
  whatsapp_number?: unknown;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let payload: OtpRequestBody;
  try {
    payload = (await request.json()) as OtpRequestBody;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const intent = typeof payload.intent === "string" ? payload.intent : "login";
  const whatsappNumber =
    typeof payload.whatsapp_number === "string"
      ? payload.whatsapp_number.trim()
      : "";
  const businessHandle =
    typeof payload.business_handle === "string"
      ? payload.business_handle.trim()
      : "";

  if (!whatsappNumber) {
    return Response.json({ error: "missing_number" }, { status: 400 });
  }

  // register: sign-up verification (number only). login: sign-in code, which the
  // API scopes by the store handle + number pair.
  const path =
    intent === "register"
      ? "/auth/business/register/otp/request"
      : "/auth/business/otp/request";
  const body =
    intent === "register"
      ? { whatsapp_number: whatsappNumber }
      : { business_handle: businessHandle, whatsapp_number: whatsappNumber };

  try {
    await fetchApi(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: "api_unavailable" }, { status: 502 });
  }

  // 202 always; treat any reachable response as success so the flow advances.
  return Response.json({ ok: true });
}
