// The mobile money networks Paystack settles a subaccount to. The codes are
// Paystack's settlement_bank values and travel to the API verbatim; the labels
// are what a Ghanaian store owner actually calls them.
export const NETWORKS = [
  { code: "MTN", label: "MTN MoMo" },
  { code: "VOD", label: "Telecel (Vodafone) Cash" },
  { code: "ATL", label: "AT (AirtelTigo) Money" },
] as const;

// Falls back to the raw code rather than an empty string: a store set up before
// the network was recorded locally has no code, and showing nothing would read
// as "no network" instead of "not known".
export function networkLabel(code: string): string {
  return NETWORKS.find((network) => network.code === code)?.label ?? code;
}

// §2.1: a payout MoMo number is EXACTLY 10 local digits (0XXXXXXXXX). The API
// rejects anything else with invalid_payout_number; this predicate gates the
// "Verify number" button and the pre-submit check so the owner finds out
// before the SMS goes out.
export function looksLikeGhanaNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 && digits.startsWith("0");
}
