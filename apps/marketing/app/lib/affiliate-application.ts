import { z } from "zod";

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const codePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{1,30}[A-Za-z0-9]$/;
const channels = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "whatsapp",
  "blog",
  "email",
  "other",
] as const;

const affiliateApplicationSchema = z.object({
  company_url: z.string().max(0, "Something went wrong. Please try again."),
  applicant_type: z.enum(["person", "business", "agency"]),
  display_name: z.string().trim().min(2).max(120),
  contact_name: z.string().trim().min(2).max(120),
  email: z.string().trim().regex(emailPattern, "Enter a valid email address"),
  phone: z.string().trim().max(40),
  website_url: z
    .string()
    .trim()
    .max(512)
    .refine(
      (value) =>
        !value ||
        (() => {
          try {
            const parsed = new URL(value);
            return parsed.protocol === "https:" || parsed.protocol === "http:";
          } catch {
            return false;
          }
        })(),
      "Use a full website or social link, including https://",
    ),
  requested_code: z
    .string()
    .trim()
    .regex(codePattern, "Use 3–32 letters, numbers, hyphens, or underscores"),
  audience_summary: z.string().trim().min(20).max(1000),
  promotion_channels: z
    .array(z.enum(channels))
    .min(1, "Choose at least one promotion channel"),
  consent: z.literal("on", {
    error: "Confirm that you accept the programme terms.",
  }),
});

type AffiliateApplicationInput = z.infer<typeof affiliateApplicationSchema>;
export type AffiliateApplicationField =
  | keyof AffiliateApplicationInput
  | "form";
export type AffiliateApplicationResult =
  | { ok: true; requestedCode: string }
  | {
      ok: false;
      errors: Partial<Record<AffiliateApplicationField, string>>;
    };

export function parseAffiliateApplication(
  formData: FormData,
):
  | { ok: true; values: AffiliateApplicationInput }
  | { ok: false; result: AffiliateApplicationResult } {
  const source = Object.fromEntries(formData);
  const parsed = affiliateApplicationSchema.safeParse({
    ...source,
    company_url: formData.get("company_url") ?? "",
    promotion_channels: formData.getAll("promotion_channels"),
  });
  if (parsed.success) {
    return { ok: true, values: parsed.data };
  }

  const errors: Partial<Record<AffiliateApplicationField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as AffiliateApplicationField] = issue.message;
    }
  }
  return { ok: false, result: { ok: false, errors } };
}

const API_BASE =
  (typeof process !== "undefined" ? process.env.XTIITCH_API_URL : undefined) ??
  "http://localhost:8080";

export async function submitAffiliateApplication(
  values: AffiliateApplicationInput,
  request: Request,
): Promise<AffiliateApplicationResult> {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": request.headers.get("user-agent") ?? "Xtiitch Marketing",
  });
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    headers.set("X-Forwarded-For", forwardedFor);
  }

  try {
    const response = await fetch(
      `${API_BASE.replace(/\/+$/, "")}/v1/public/affiliate-applications`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          applicant_type: values.applicant_type,
          display_name: values.display_name,
          contact_name: values.contact_name,
          email: values.email,
          phone: values.phone,
          website_url: values.website_url,
          requested_code: values.requested_code,
          audience_summary: values.audience_summary,
          promotion_channels: values.promotion_channels,
          consent: true,
        }),
      },
    );
    if (response.status === 409) {
      return {
        ok: false,
        errors: {
          requested_code: "That affiliate code is already in use. Try another.",
        },
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        errors: { form: "We couldn’t create your account. Try again." },
      };
    }
    return {
      ok: true,
      requestedCode: values.requested_code.trim().toUpperCase(),
    };
  } catch {
    return {
      ok: false,
      errors: { form: "We couldn’t create your account. Try again." },
    };
  }
}
