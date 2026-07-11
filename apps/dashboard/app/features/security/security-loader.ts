import { redirect } from "react-router";
import type { Route } from "../../routes/+types/security";
import { fetchApi } from "../../lib/api-base";
import { getSession } from "../../lib/session";

export type MFAStatus = {
  enabled: boolean;
  enrolled: boolean;
  backup_codes_left: number;
};

export async function requireAccess(request: Request): Promise<string> {
  const session = await getSession(request.headers.get("Cookie"));
  const access = session.get("access");
  if (!access) {
    throw redirect("/login");
  }
  return access;
}

export async function loader({ request }: Route.LoaderArgs) {
  const access = await requireAccess(request);
  let status: MFAStatus = {
    enabled: false,
    enrolled: false,
    backup_codes_left: 0,
  };
  try {
    const response = await fetchApi("/auth/business/mfa", {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (response.status === 401) {
      throw redirect("/login");
    }
    if (response.ok) {
      status = (await response.json()) as MFAStatus;
    }
  } catch (error) {
    if (error instanceof Response) throw error;
    // Network blip: fall back to the safe default (not enrolled).
  }
  return { status };
}
