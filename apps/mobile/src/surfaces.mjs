export const mobileSurfaces = Object.freeze([
  {
    id: "customer",
    title: "Xtiitch Customer",
    authRealm: "customer",
    defaultRoute: "/customer/home",
    routePrefixes: ["/customer", "/store", "/design", "/track", "/requests"],
  },
  {
    id: "business",
    title: "Xtiitch Business",
    authRealm: "business",
    defaultRoute: "/business",
    routePrefixes: ["/business", "/dashboard", "/orders", "/catalogue", "/team"],
  },
]);

const surfaceById = new Map(
  mobileSurfaces.map((surface) => [surface.id, surface]),
);

export function resolveMobileSurface(input) {
  const requested = String(input ?? "").trim().toLowerCase();
  if (!requested) {
    return surfaceById.get("customer");
  }

  const surface = surfaceById.get(requested);
  if (!surface) {
    throw new Error(`Unsupported mobile surface: ${requested}`);
  }

  return surface;
}

export function resolveLaunchRoute(input = {}) {
  const requestedPath = normalisePath(input.path);
  const explicitSurface = input.surface
    ? resolveMobileSurface(input.surface)
    : undefined;

  if (explicitSurface) {
    return {
      surface: explicitSurface.id,
      route: requestedPath ?? explicitSurface.defaultRoute,
    };
  }

  if (requestedPath) {
    const matched = mobileSurfaces.find((surface) =>
      surface.routePrefixes.some((prefix) => requestedPath.startsWith(prefix)),
    );

    if (matched) {
      return {
        surface: matched.id,
        route: requestedPath,
      };
    }
  }

  const fallback = resolveMobileSurface("customer");
  return {
    surface: fallback.id,
    route: fallback.defaultRoute,
  };
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveApiBaseUrl(env = process.env) {
  // The API mounts every route under /v1 (apps/api .../http/router.go), so the
  // fallback must include it too — without it a fresh checkout 404s every call.
  // Note .env.example sets XTIITCH_API_URL WITHOUT /v1 (correct for the SSR
  // apps, which append it themselves); for mobile it must carry the prefix.
  const raw =
    env.EXPO_PUBLIC_XTIITCH_API_URL ??
    env.XTIITCH_API_URL ??
    "http://localhost:8080/v1";
  const parsed = new URL(raw);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function normalisePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = new URL(raw, "https://mobile.xtiitch.local");
    return parsed.pathname.startsWith("/")
      ? parsed.pathname
      : `/${parsed.pathname}`;
  } catch {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
}
