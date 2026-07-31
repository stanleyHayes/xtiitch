// The form field names for the marketing launch flags, in one place.
//
// They were previously written out twice: once as individual toggles in
// MarketingLaunchFlagsForm, and again as a hardcoded array behind "Enable all
// public links". Adding the affiliate flag updated the first list and not the
// second, so "enable all" quietly switched the new flag off — the failure mode
// a duplicated list always eventually produces.
//
// These strings are the wire format the admin action reads (readBoolean) and
// must match the API's JSON keys.
export const MARKETING_FLAG_FIELDS = [
  "browse_store",
  "discover",
  "create_store",
  "pricing",
  "affiliate_signup",
] as const;

export type MarketingFlagField = (typeof MARKETING_FLAG_FIELDS)[number];
