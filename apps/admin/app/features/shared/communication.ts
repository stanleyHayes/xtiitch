import { ghanaPhoneDigits } from "./validation";



export function whatsappHref(value: string): string | undefined {
  const digits = ghanaPhoneDigits(value);
  return digits ? `https://wa.me/${digits}` : undefined;
}



export function smsHref(value: string): string | undefined {
  const digits = ghanaPhoneDigits(value);
  return digits ? `sms:${digits}` : undefined;
}
