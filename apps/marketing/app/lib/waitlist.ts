import { z } from "zod";

// Lead-capture schema. Validation runs server-side in the /contact action; the
// same messages surface on the form. Email regex avoids version-specific zod
// string-format helpers so this stays stable across zod releases.
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const waitlistSchema = z.object({
  website: z
    .string()
    .max(0, "Something went wrong. Please try again.")
    .optional(),
  name: z.string().trim().min(2, "Please enter your name"),
  business: z.string().trim().min(2, "Please enter your business name"),
  phone: z.string().trim().min(7, "Please enter a reachable phone number"),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || emailPattern.test(value), {
      message: "Please enter a valid email address",
    }),
  city: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  consent: z.custom<"on">((value) => value === "on", {
    message: "Please confirm that Xtiitch can contact you about onboarding.",
  }),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type WaitlistFieldErrors = Partial<
  Record<keyof WaitlistInput | "form", string>
>;
export type WaitlistResult =
  | { ok: true }
  | { ok: false; errors: WaitlistFieldErrors };
type ParsedWaitlist =
  | { ok: true; values: WaitlistInput }
  | { ok: false; errors: WaitlistFieldErrors };

export function parseWaitlist(formData: FormData): ParsedWaitlist {
  const parsed = waitlistSchema.safeParse(Object.fromEntries(formData));

  if (parsed.success) {
    return { ok: true, values: parsed.data };
  }

  const errors: WaitlistFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key as keyof WaitlistInput] = issue.message;
    }
  }

  return { ok: false, errors };
}

export type WaitlistDelivery = { ok: true } | { ok: false; message: string };

export async function submitWaitlistLead(
  values: WaitlistInput,
  request: Request,
): Promise<WaitlistDelivery> {
  if (process.env.MARKETING_WAITLIST_WEBHOOK_URL) {
    return sendWebhookLead(values, request);
  }

  if (
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM_EMAIL &&
    process.env.MARKETING_WAITLIST_EMAIL_TO
  ) {
    return sendResendLead(values, request);
  }

  return {
    ok: false,
    message:
      "Waitlist delivery is not connected yet. Add a webhook or Resend email target before public launch.",
  };
}

async function sendWebhookLead(
  values: WaitlistInput,
  request: Request,
): Promise<WaitlistDelivery> {
  const url = process.env.MARKETING_WAITLIST_WEBHOOK_URL;
  if (!url) {
    return { ok: false, message: "Waitlist webhook is not configured." };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.MARKETING_WAITLIST_WEBHOOK_SECRET) {
    headers.Authorization = `Bearer ${process.env.MARKETING_WAITLIST_WEBHOOK_SECRET}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(newLeadPayload(values, request)),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: "We could not send your request. Please try again.",
    };
  }

  return { ok: true };
}

async function sendResendLead(
  values: WaitlistInput,
  request: Request,
): Promise<WaitlistDelivery> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.MARKETING_WAITLIST_EMAIL_TO],
      subject: `New Xtiitch waitlist lead: ${values.business}`,
      text: formatLeadEmail(values, request),
    }),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: "We could not send your request. Please try again.",
    };
  }

  return { ok: true };
}

function newLeadPayload(values: WaitlistInput, request: Request) {
  return {
    name: values.name,
    business: values.business,
    phone: values.phone,
    email: values.email,
    city: values.city,
    message: values.message,
    source: "xtiitch-marketing",
    submittedAt: new Date().toISOString(),
    userAgent: request.headers.get("user-agent") ?? "",
  };
}

function formatLeadEmail(values: WaitlistInput, request: Request): string {
  const lines = [
    "New Xtiitch waitlist lead",
    "",
    `Name: ${values.name}`,
    `Business: ${values.business}`,
    `Phone: ${values.phone}`,
    `Email: ${values.email || "Not provided"}`,
    `Town or city: ${values.city || "Not provided"}`,
    `Message: ${values.message || "Not provided"}`,
    "",
    `User agent: ${request.headers.get("user-agent") ?? "Not provided"}`,
    `Submitted: ${new Date().toISOString()}`,
  ];

  return lines.join("\n");
}
