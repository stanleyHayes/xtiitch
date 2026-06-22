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
  // Required so we always know where a lead is coming from. Missing/non-string
  // values coerce to "" first so the friendly min-length message always wins
  // over zod's generic "expected string" message.
  city: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().min(2, "Please enter your town or city").max(120),
  ),
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

const WAITLIST_API_BASE =
  (typeof process !== "undefined" ? process.env.XTIITCH_API_URL : undefined) ??
  "http://localhost:8080";

// The Go API now owns DB storage + email for waitlist leads. We POST the lead to
// the public marketing endpoint; a 202 means accepted. Any non-2xx or network
// error returns a friendly, generic message (never the old "not connected"
// copy, and never a raw API error).
export async function submitWaitlistLead(
  values: WaitlistInput,
  source: string,
): Promise<WaitlistDelivery> {
  const friendlyError: WaitlistDelivery = {
    ok: false,
    message:
      "We couldn’t add you to the waitlist just now. Please try again in a moment.",
  };

  try {
    const response = await fetch(
      `${WAITLIST_API_BASE.replace(/\/+$/, "")}/v1/marketing/waitlist`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          business: values.business,
          phone: values.phone,
          email: values.email || undefined,
          city: values.city,
          message: values.message || undefined,
          source,
        }),
      },
    );

    if (!response.ok) {
      return friendlyError;
    }

    return { ok: true };
  } catch {
    return friendlyError;
  }
}
