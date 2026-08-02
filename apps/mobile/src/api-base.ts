import { resolveApiBaseUrl } from "./surfaces.mjs";

export function apiBaseUrl(): string {
  // Direct public-env access allows babel-preset-expo to inline the native
  // build value. The shared resolver normalises paths and supplies localhost.
  return resolveApiBaseUrl({
    EXPO_PUBLIC_XTIITCH_API_URL: process.env.EXPO_PUBLIC_XTIITCH_API_URL,
    XTIITCH_API_URL: process.env.XTIITCH_API_URL,
  });
}
