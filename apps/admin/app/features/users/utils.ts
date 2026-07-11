import { tokens } from "../../theme";
import {
  AdminPermissionDefinition,
  AdminRoleDefinition,
  AdminRole,
} from "../shared/types";

const permissionLabels: Record<string, string> = {
  manage_admin_users: "Manage admin users",
  manage_roles: "Manage roles",
  manage_settings: "Platform settings",
  review_businesses: "Business review",
  manage_money_rails: "Money rails",
  manage_subscriptions: "Subscriptions",
  manage_plans: "Plan packages",
  manage_promotions: "Promotions",
  manage_ads: "Sponsored placements",
  manage_growth: "Growth programmes",
  manage_risk: "Risk review",
  manage_support: "Support queue",
  view_audit: "Audit trail",
};

const permissionDescriptions: Record<string, string> = {
  manage_admin_users: "Create operators, change roles, and deactivate access.",
  manage_roles: "Edit what each platform role can do.",
  manage_settings: "Change platform-wide configuration and policy settings.",
  review_businesses: "Approve, reject, suspend, and inspect tenant accounts.",
  manage_money_rails:
    "Review Paystack events, payout holds, and commission rails.",
  manage_subscriptions:
    "Manage package lifecycle state, billing modes, and cancellation flow.",
  manage_plans:
    "Create, update, archive, and audit the package definitions businesses use.",
  manage_promotions:
    "Create, pause, archive, and audit platform or business-funded promotions.",
  manage_ads:
    "Review, approve, pause, and audit sponsored marketing placements.",
  manage_growth: "Manage admin-run affiliate and referral programme controls.",
  manage_risk: "Close or reopen platform trust and safety reviews.",
  manage_support: "Assign and resolve customer or business support issues.",
  view_audit: "Read the operator action trail and sensitive change history.",
};

const requiredOwnerPermissionValues = ["manage_admin_users", "manage_roles"];

export function defaultPermissionCatalog(): AdminPermissionDefinition[] {
  return Object.entries(permissionLabels).map(([permission, label]) => ({
    permission,
    label,
  }));
}

export function permissionLabel(value: string): string {
  return permissionLabels[value] ?? value.replaceAll("_", " ");
}

export function permissionDescription(value: string): string {
  return permissionDescriptions[value] ?? "Platform permission.";
}

export function roleHasPermission(
  role: AdminRoleDefinition,
  permission: string,
): boolean {
  return role.permissions.includes(permission);
}

export function isProtectedOwnerPermission(
  role: AdminRole,
  permission: string,
): boolean {
  return role === "owner" && requiredOwnerPermissionValues.includes(permission);
}

export function roleTone(role: AdminRole): string {
  switch (role) {
    case "owner":
      return tokens.burgundy;
    case "operator":
      return tokens.info;
    default:
      return tokens.success;
  }
}
