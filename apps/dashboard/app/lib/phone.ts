// §15.1 "Call / WhatsApp the customer from their profile". Ghanaian numbers
// are stored either in local form (024XXXXXXX) or international (+233…);
// wa.me deep links require international digits WITHOUT the '+', and tel:
// links work best in international form too.

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

// "0244 123 456" → "23324123456"; "+233 24 412 3456" → "233244123456".
// Returns "" when nothing usable remains (the caller hides the button).
export function internationalPhoneDigits(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) {
    return "";
  }
  if (digits.startsWith("233")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return `233${digits.slice(1)}`;
  }
  return digits;
}

export function telHref(value: string): string {
  const digits = internationalPhoneDigits(value);
  return digits ? `tel:+${digits}` : "";
}

export function whatsAppHref(value: string): string {
  const digits = internationalPhoneDigits(value);
  return digits ? `https://wa.me/${digits}` : "";
}
