import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { readAdminRole, readAdminPermissions } from "../formReaders";
import { adminUserActionError, adminRoleActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

export async function handleUsersAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-user:create" || intent === "admin-user:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-user:create") {
        await adminApi.createUser(accessToken, {
          displayName: String(form.get("display_name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          role: readAdminRole(form.get("role")),
        });
        return {
          section: "users",
          severity: "success",
          message: "Operator access created.",
        };
      }

      await adminApi.updateUser(
        accessToken,
        String(form.get("admin_user_id") ?? ""),
        {
          displayName: String(form.get("display_name") ?? ""),
          role: readAdminRole(form.get("role")),
          isActive: String(form.get("is_active") ?? "") === "true",
        },
      );
      return {
        section: "users",
        severity: "success",
        message: "Operator access updated.",
      };
    } catch (error) {
      return {
        section: "users",
        severity: "error",
        message: adminUserActionError(error),
      };
    }
  }

  if (intent === "admin-role-permissions:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.updateRolePermissions(
        accessToken,
        readAdminRole(form.get("role")),
        readAdminPermissions(form),
      );
      return {
        section: "roles",
        severity: "success",
        message: "Role permissions updated.",
      };
    } catch (error) {
      return {
        section: "roles",
        severity: "error",
        message: adminRoleActionError(error),
      };
    }
  }

  return null;
}
