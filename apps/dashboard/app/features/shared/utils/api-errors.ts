// Reads the API's machine-readable error code from a failed response.
//
// Every error body is `{ "error": "<code>" }`, and several distinct failures now
// share an HTTP status — a duplicate email and the plan's seat cap are both 409,
// a wrong OTP and an expired one are both 401. Branching on status alone gives
// the user the wrong remedy, so the code is what messages must key on.
//
// Returns "" when the body is missing or not that shape, letting callers fall
// back to a generic message rather than throwing inside an error path.
export async function apiErrorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "";
  } catch {
    return "";
  }
}
