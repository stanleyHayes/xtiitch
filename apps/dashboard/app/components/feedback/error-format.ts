// Crash-report error formatting. Rejection reasons and boundary errors are
// not always Error instances — failed API calls often reject with plain
// objects, and older Safari surfaces non-Error values. These helpers turn
// anything thrown into a readable message and stack for the support queue.

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Prefix with the error type so "Load failed" reads as "TypeError: Load
    // failed" in the support queue — the type is half the diagnosis.
    return error.name && error.name !== "Error"
      ? `${error.name}: ${error.message}`
      : error.message;
  }
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
  }
  return serializeReason(error) || "Unknown client error";
}

export function errorStack(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return serializeReason(error);
}

// String() on a non-Error reason yields "[object Object]", so serialize
// instead; objects with no enumerable properties (DOMExceptions, browser
// Events, class instances) JSON-stringify to "{}", so those get their type
// and any message/name/code/status fields spelled out.
function serializeReason(error: unknown): string {
  if (error === null || error === undefined) return "";
  if (typeof error === "string") return error;
  if (typeof error !== "object") return String(error);
  try {
    const json = JSON.stringify(error);
    if (json && json !== "{}") return json;
  } catch {
    // Fall through to the named summary below.
  }
  const record = error as Record<string, unknown>;
  const ctorName = (error as { constructor?: { name?: unknown } }).constructor
    ?.name;
  const type =
    typeof ctorName === "string" && ctorName !== "Object"
      ? ctorName
      : Object.prototype.toString.call(error).slice(8, -1);
  const details = ["message", "name", "code", "status"]
    .map((key) => {
      const value = record[key];
      return typeof value === "string" || typeof value === "number"
        ? `${key}=${value}`
        : "";
    })
    .filter(Boolean)
    .join(" ");
  return details ? `${type} (${details})` : type;
}
