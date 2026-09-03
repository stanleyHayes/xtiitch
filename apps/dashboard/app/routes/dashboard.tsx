import type { Route } from "./+types/dashboard";
import { logOut } from "../lib/auth";
import { useThemeMode } from "../theme-mode";
import {
  canUseDashboardIntent,
  rolePermissionMessage,
} from "../features/shared/utils";
import { dashboardActionIntents } from "../features/shared/constants";
import { loadCurrentUser } from "../features/shared/api";
import { loadDashboardData } from "../features/shared/loader";
import type { DashboardActionData } from "../features/shared/types";
import { DashboardWorkspace } from "../features/shell/DashboardWorkspace";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Dashboard · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader(args: Route.LoaderArgs) {
  return loadDashboardData(args);
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "logout") {
    return logOut(request);
  }

  if (dashboardActionIntents.has(intent)) {
    const currentUser = await loadCurrentUser(request);
    if (!canUseDashboardIntent(currentUser.role, intent)) {
      return { permissionError: rolePermissionMessage(currentUser.role) };
    }
  }

  const { handleOrdersActions } = await import(
    "../features/orders/handleActions"
  );
  const { handleMoneyActions } = await import(
    "../features/money/handleActions"
  );
  const { handleAvailabilityActions } = await import(
    "../features/availability/handleActions"
  );
  const { handleMeasurementsActions } = await import(
    "../features/measurements/handleActions"
  );
  const { handleSettingsActions } = await import(
    "../features/settings/handleActions"
  );
  const { handleTeamActions } = await import("../features/team/handleActions");
  const { handleCatalogueActions } = await import(
    "../features/catalogue/handleActions"
  );
  const { handleStudioActions } = await import(
    "../features/studio/handleActions"
  );
  const { handleAnalyticsActions } = await import(
    "../features/analytics/handleActions"
  );
  const { handleCrmActions } = await import("../features/crm/handleActions");

  return (
    (await handleOrdersActions(request, form, intent)) ??
    (await handleMoneyActions(request, form, intent)) ??
    (await handleAvailabilityActions(request, form, intent)) ??
    (await handleMeasurementsActions(request, form, intent)) ??
    (await handleSettingsActions(request, form, intent)) ??
    (await handleTeamActions(request, form, intent)) ??
    (await handleCatalogueActions(request, form, intent)) ??
    (await handleStudioActions(request, form, intent)) ??
    (await handleAnalyticsActions(request, form, intent)) ??
    (await handleCrmActions(request, form, intent)) ??
    null
  );
}

export default function Dashboard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { isDark: darkChrome, toggleMode } = useThemeMode();
  return (
    <DashboardWorkspace
      loaderData={loaderData}
      actionData={(actionData ?? {}) as DashboardActionData}
      darkChrome={darkChrome}
      toggleMode={toggleMode}
    />
  );
}
