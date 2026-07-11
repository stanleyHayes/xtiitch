import {
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import type { Route } from "./+types/admin";
import { adminApi } from "../lib/api";
import { logOut, requireAdminContext } from "../lib/session";
import { tokens } from "../theme";
import { useThemeMode } from "../theme-mode";
import { HelpDrawer } from "../help-center";
import {
  Section,
  AdminActionFeedback,
  AdminNavItem,
  adminRailWidth,
  adminRailCollapsedWidth,
  navItems,
  KNOWN_SECTIONS,
} from "../features/shared/types";
import { buildAdminNotifications } from "../features/shared/notifications";
import type { AdminLoaderData } from "../features/shared/adminLoader";
import { SectionSkeleton } from "../features/shared/SectionSkeleton";
import { AdminRail } from "../features/shell/AdminRail";
import { AdminTopBar } from "../features/shell/AdminTopBar";
import { AdminDashboardBody } from "../features/shell/AdminDashboardBody";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Admin console · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (!formMethod && currentUrl.pathname === nextUrl.pathname) {
    return false;
  }
  return defaultShouldRevalidate;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { loadAdminDashboardData } = await import(
    "../features/shared/adminLoader"
  );
  return loadAdminDashboardData(request);
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "logout") {
    return logOut(request);
  }
  if (intent === "admin-export:download") {
    const { accessToken } = await requireAdminContext(request);
    const { readAdminExportDataset, adminExportFilename } = await import(
      "../features/shared/formReaders"
    );
    const dataset = readAdminExportDataset(form.get("dataset"));
    const csv = await adminApi.exportDataset(accessToken, dataset);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${adminExportFilename(
          dataset,
        )}"`,
      },
    });
  }
  // All other intents are delegated to the original action logic in feature helpers.
  const actionModule = await import("../features/shared/adminActions");
  return actionModule.handleAdminAction({ request, intent, form });
}

export default function AdminDashboard({ // eslint-disable-line complexity, max-lines-per-function -- route action/loader with many conditional branches; refactor in follow-up
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const data = loaderData as AdminLoaderData;
  const {
    admin,
    profileSettingsError,
    platformSettings,
    platformSettingsError,
    verificationCases,
    backendNotifications,
    platformMetrics,
    moneyRails,
    subscriptions,
    promotions,
    adCampaigns,
    affiliates,
    referralProgrammes,
    riskReviews,
    supportTickets,
    auditEvents,
  } = data;
  const actionFeedback = actionData as AdminActionFeedback | undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSectionState] = useState<Section>(
    () =>
      sectionFromParam(searchParams.get("section")) ??
      sectionFromParam(actionFeedback?.section ?? null) ??
      "overview",
  );
  const setSection = useCallback(
    (next: Section) => {
      setSectionState(next);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === "overview") {
            params.delete("section");
          } else {
            params.set("section", next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const settingsFeedback =
    actionFeedback?.section === "settings" && actionFeedback.message
      ? actionFeedback
      : null;
  const [settingsFeedbackOpen, setSettingsFeedbackOpen] = useState(
    Boolean(settingsFeedback),
  );
  const { isDark: darkChrome, toggleMode } = useThemeMode();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";
  const isNavLoading =
    navigation.state === "loading" && !navigation.formMethod;

  const pendingCount = verificationCases.filter(
    (item) => item.status === "pending" || item.status === "unverified",
  ).length;
  const urgentTickets = supportTickets.filter(
    (ticket) => ticket.priority === "urgent" && ticket.status === "open",
  ).length;
  const openRiskCount = riskReviews.filter(
    (review) => review.status === "open",
  ).length;
  const adminNotifications =
    backendNotifications.length > 0
      ? backendNotifications
      : buildAdminNotifications({
          verificationCases,
          moneyRails,
          platformMetrics,
          platformSettings,
          subscriptions,
          promotions,
          adCampaigns,
          affiliates,
          referralProgrammes,
          riskReviews,
          supportTickets,
          auditEvents,
        });
  const notificationCount = adminNotifications.filter(
    (notification) => notification.id !== "all-clear",
  ).length;
  const currentSection = (
    navItems.find((item) => item.id === section) ?? navItems[0]
  ) as AdminNavItem;

  useEffect(() => {
    if (settingsFeedback) {
      setSettingsFeedbackOpen(true);
    }
  }, [settingsFeedback]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        overflowX: "hidden",
        bgcolor: darkChrome ? alpha(tokens.ink, 0.96) : "background.default",
        backgroundImage: darkChrome
          ? `
            radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.2)}, transparent 30%),
            radial-gradient(circle at 58% 12%, ${alpha(tokens.info, 0.16)}, transparent 28%),
            linear-gradient(180deg, ${tokens.ink}, ${tokens.charcoal})
          `
          : `
            radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.08)}, transparent 30%),
            radial-gradient(circle at 64% 18%, ${alpha(tokens.info, 0.06)}, transparent 28%),
            linear-gradient(180deg, ${tokens.cream}, ${alpha(tokens.panel, 0.78)})
          `,
        "@keyframes adminRailSlide": {
          from: { opacity: 0, transform: "translateX(-18px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "@keyframes adminRailDrop": {
          from: { opacity: 0, transform: "translateY(-10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes adminSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes adminSectionIn": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@media (prefers-reduced-motion: reduce)": {
          "*, *::before, *::after": {
            animationDuration: "1ms !important",
            transitionDuration: "1ms !important",
          },
        },
      }}
    >
      {isBusy ? (
        <LinearProgress
          aria-label="Loading"
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: (theme) => theme.zIndex.appBar + 2,
          }}
        />
      ) : null}
      <Snackbar
        open={settingsFeedbackOpen}
        autoHideDuration={5200}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") {
            setSettingsFeedbackOpen(false);
          }
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={settingsFeedback?.severity ?? "success"}
          variant="filled"
          onClose={() => setSettingsFeedbackOpen(false)}
          sx={{ borderRadius: 2, boxShadow: 4, fontWeight: 800 }}
        >
          {settingsFeedback?.message}
        </Alert>
      </Snackbar>
      <AdminRail
        section={section}
        collapsed={railCollapsed}
        mobileOpen={mobileNavOpen}
        notificationCount={notificationCount}
        pendingCount={pendingCount}
        riskCount={openRiskCount}
        urgentTickets={urgentTickets}
        brandLogoUrl={platformSettings.brandLogoUrl}
        onCloseMobile={() => setMobileNavOpen(false)}
        onSelect={setSection}
      />
      <Box
        component="main"
        sx={{
          minWidth: 0,
          width: {
            xs: "100%",
            lg: `calc(100% - ${railCollapsed ? adminRailCollapsedWidth : adminRailWidth}px)`,
          },
          maxWidth: "100%",
          overflowX: "hidden",
          ml: {
            lg: `${railCollapsed ? adminRailCollapsedWidth : adminRailWidth}px`,
          },
          transition: "margin-left 220ms ease",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "adminSurfaceIn 520ms ease both",
          },
        }}
      >
        <AdminTopBar
          admin={admin}
          currentSection={currentSection}
          collapsed={railCollapsed}
          darkChrome={darkChrome}
          notificationCount={notificationCount}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onToggleCollapsed={() => setRailCollapsed((value) => !value)}
          onToggleDarkChrome={toggleMode}
          onSelect={setSection}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <HelpDrawer
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          section={currentSection.id}
        />

        <Box
          sx={{
            px: { xs: 1.25, sm: 2, md: 4 },
            py: { xs: 2, md: 4 },
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "hidden",
            "& form": { minWidth: 0 },
          }}
        >
          {profileSettingsError || platformSettingsError ? (
            <Stack spacing={1.25} sx={{ mb: 2.5 }}>
              {profileSettingsError ? (
                <Alert severity="warning">{profileSettingsError}</Alert>
              ) : null}
              {platformSettingsError ? (
                <Alert severity="warning">{platformSettingsError}</Alert>
              ) : null}
            </Stack>
          ) : null}

          {isNavLoading ? (
            <SectionSkeleton />
          ) : (
            <Box
              key={section}
              sx={{
                "@media (prefers-reduced-motion: no-preference)": {
                  animation: "adminSectionIn 280ms ease both",
                },
              }}
            >
              <AdminDashboardBody
                section={section}
                isNavLoading={isNavLoading}
                setSection={setSection}
                adminNotifications={adminNotifications}
                pendingCount={pendingCount}
                loaderData={loaderData}
                actionData={actionFeedback}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function sectionFromParam(value: string | null): Section | null {
  return value && (KNOWN_SECTIONS as readonly string[]).includes(value)
    ? (value as Section)
    : null;
}
