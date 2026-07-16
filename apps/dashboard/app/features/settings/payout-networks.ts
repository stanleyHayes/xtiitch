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

// A Ghana MoMo number is 10 local digits (0XXXXXXXXX) or 12 in 233 form. The API
// normalises properly; this only decides when the "Verify number" button lights
// up, so it stays permissive rather than duplicating that rule.
export function looksLikeGhanaNumber(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 12;
}
