// A Paystack verification request may be HTTP-successful while truthfully
// reporting an abandoned, failed, or pending transaction. Only the explicit
// active subscription state is a completed billing activation.
export async function billingVerificationIsActive(
  response: Response,
): Promise<boolean> {
  if (!response.ok) {
    return false;
  }
  const body = (await response.json().catch(() => null)) as {
    status?: string;
  } | null;
  return body?.status === "active";
}
