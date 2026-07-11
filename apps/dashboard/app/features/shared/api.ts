import { apiFetch, logOut } from "../../lib/auth";
import type {
  CurrentUser,
  DashboardActionData,
  DashboardJSONResult,
} from "./types";
import { canUseDashboardIntent, rolePermissionMessage } from "./utils";

export function dashboardUpstreamStatus(status: number): number {
  return status >= 500 || status === 0 ? 503 : status;
}

export function isRedirectResponse(error: unknown): error is Response {
  return error instanceof Response && error.status >= 300 && error.status < 400;
}

export async function readDashboardJSON<T>(
  request: Request,
  path: string,
  failureMessage: string,
): Promise<T> {
  const response = await apiFetch(request, path);

  if (!response.ok) {
    throw new Response(failureMessage, {
      status: dashboardUpstreamStatus(response.status),
    });
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Response(failureMessage, { status: 502 });
  }
}

export async function loadDashboardJSON<T>(
  request: Request,
  path: string,
  fallback: T,
  warning: string,
): Promise<DashboardJSONResult<T>> {
  try {
    return {
      data: await readDashboardJSON<T>(request, path, warning),
      warning: null,
    };
  } catch (error) {
    if (isRedirectResponse(error)) {
      throw error;
    }
    return { data: fallback, warning };
  }
}

export async function loadCurrentUser(request: Request): Promise<CurrentUser> {
  return readDashboardJSON<CurrentUser>(
    request,
    "/auth/business/me",
    "The signed-in business user could not be loaded. Start the API and refresh this dashboard.",
  );
}

export function safeDashboardReturn(value: string): string {
  const allowed = new Set([
    "/dashboard",
    "/dashboard/orders",
    "/dashboard/orders?orders=all",
    "/dashboard/orders?orders=standard",
    "/dashboard/orders?orders=custom",
    "/dashboard/orders?orders=draft",
    "/dashboard/orders?orders=confirmed",
    "/dashboard/orders?orders=fulfilled",
    "/dashboard/visits",
    "/dashboard/handovers",
  ]);
  return allowed.has(value) ? value : "/dashboard/orders";
}

export async function guardDashboardIntent(
  request: Request,
  intent: string,
  allowedIntents: Set<string>,
): Promise<DashboardActionData | null> {
  if (!allowedIntents.has(intent)) {
    return null;
  }
  const currentUser = await loadCurrentUser(request);
  if (!canUseDashboardIntent(currentUser.role, intent)) {
    return { permissionError: rolePermissionMessage(currentUser.role) };
  }
  return null;
}

export { logOut };
