// §4.6 gross-up rule: Paystack's 1.95% is charged on the FULL amount the payer
// actually pays, not on the base price. So when the transaction fee is passed
// down at checkout, the charge is grossed up so the protected amounts survive
// Paystack's cut exactly:
//   C = (every amount that must arrive intact) / (1 - 0.0195)
// and the displayed "Transaction fee" line = C - (package + Tax fee).
// §4.7 rounding: Paystack works in two decimal places, so every computed fee
// is rounded half-up to the pesewa (1.255 -> 1.26 — a trailing 5 rounds UP).
// The dashboard displays with exactly this maths so the checkout summary
// matches what the API bills; the API remains the source of truth.

// Paystack's percentage on every charge (§4.1: "Paystack fee 1.95%").
export const PAYSTACK_FEE_RATE = 0.0195;

// Half-up to the nearest pesewa for the (always positive) amounts here.
// Math.round is almost this, but floor(x + 0.5) states the §4.7 rule plainly.
export function roundHalfUpMinor(value: number): number {
  return Math.floor(value + 0.5);
}

// Tax fee on a package figure, in minor units. Package purchases always add tax
// on top of the listed plan/package fee; vatInclusive is kept in the signature
// only so older API payloads cannot make the UI back tax out of the package.
export function vatMinor(
  packageMinor: number,
  vatRateBps: number,
  vatInclusive: boolean,
): number {
  void vatInclusive;
  if (packageMinor <= 0 || vatRateBps <= 0) {
    return 0;
  }
  return roundHalfUpMinor((packageMinor * vatRateBps) / 10000);
}

export type SubscriptionCharge = {
  packageMinor: number;
  // The "Tax fee" line — always its own labelled line (§4.5).
  vatMinor: number;
  // The "Transaction fee" line — the grossed-up Paystack fee, branded exactly
  // "Transaction fee", never "Paystack fee" (§4.5).
  transactionFeeMinor: number;
  // What the payer actually pays: package + Tax fee + Transaction fee.
  totalMinor: number;
};

// The full checkout breakdown for a subscription charge (§4.1): package price
// + Tax fee + the grossed-up Transaction fee. Package purchases always display
// and charge the listed package price first, then add the Tax fee on top.
export function subscriptionCharge(
  packageMinor: number,
  vatRateBps: number,
  vatInclusive: boolean,
): SubscriptionCharge {
  const tax = vatMinor(packageMinor, vatRateBps, vatInclusive);
  const grossBeforeFee = packageMinor + tax;
  const total = roundHalfUpMinor(grossBeforeFee / (1 - PAYSTACK_FEE_RATE));
  return {
    packageMinor,
    vatMinor: tax,
    transactionFeeMinor: total - grossBeforeFee,
    totalMinor: total,
  };
}
