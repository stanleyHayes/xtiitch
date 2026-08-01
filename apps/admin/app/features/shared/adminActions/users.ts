import { adminApi } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import { readAdminRole, readAdminPermissions } from "../formReaders";
import { adminUserActionError, adminRoleActionError } from "../actionErrors";
import type { AdminActionFeedback } from "../types";

// Sends an operator invite. Extracted from the dispatcher because it is a
// self-contained flow, and because inlining it pushed handleUsersAction past
// its complexity budget.
async function inviteOperator(
  accessToken: string,
  form: FormData,
): Promise<AdminActionFeedback> {
  const phone = String(form.get("phone") ?? "").trim();
  const invited = await adminApi.inviteUser(accessToken, {
    displayName: String(form.get("display_name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone,
    role: readAdminRole(form.get("role")),
  });
  return {
    section: "users",
    severity: "success",
    message: `Invite emailed${phone ? " and texted" : ""} to ${invited.email}. The link works once and expires in 48 hours.`,
  };
}

export async function handleUsersAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (
    intent === "admin-user:create" ||
    intent === "admin-user:update" ||
    intent === "admin-user:invite"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-user:invite") {
        return inviteOperator(accessToken, form);
      }

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
