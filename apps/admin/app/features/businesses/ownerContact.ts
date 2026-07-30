/** Owner contact helpers for admin business directory / detail. */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatOwnerPhone(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) {
    return "Not set";
  }
  if (digits.startsWith("233") && digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return value.trim() || "Not set";
}

export function phoneHref(value: string): string | undefined {
  const digits = digitsOnly(value);
  return digits ? `tel:+${digits}` : undefined;
}

export function whatsAppHref(value: string): string | undefined {
  const digits = digitsOnly(value);
  return digits ? `https://wa.me/${digits}` : undefined;
}

export function ownerContactSummary(input: {
  ownerEmail: string;
  ownerPhone: string;
  ownerWhatsApp: string;
}): string {
  const parts = [input.ownerEmail.trim()].filter(Boolean);
  const phone = formatOwnerPhone(input.ownerPhone);
  const whatsapp = formatOwnerPhone(input.ownerWhatsApp);
  if (phone !== "Not set") {
    parts.push(`Phone ${phone}`);
  }
  if (whatsapp !== "Not set") {
    parts.push(`WhatsApp ${whatsapp}`);
  }
  return parts.join(" · ") || "Owner contact pending";
}
