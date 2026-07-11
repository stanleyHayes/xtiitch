import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import { HelpDrawer } from "../../help-center";
import { ProductTour } from "../../product-tour";
import { tokens } from "../../theme";
import { canManageDashboard } from "../shared/utils";
import {
  managementWorkspaceGroups,
  staffWorkspaceGroups,
  dashboardPageMeta,
} from "./data";
import { useOverviewData } from "../overview/useOverviewData";
import type { DashboardActionData } from "../shared/types";
import type { DashboardLoaderData } from "../shared/loader";
import { WorkspaceRail } from "./WorkspaceRail";
import { WorkspaceTopBar } from "./WorkspaceTopBar";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { ActivationBanner } from "../billing/ActivationBanner";
import { DashboardSections } from "./DashboardSections";
import { DashboardDialogs } from "./DashboardDialogs";
import { DashboardSnackbar } from "./DashboardSnackbar";
import { DashboardAlerts } from "./DashboardAlerts";
import { filterOrders } from "../orders/utils";
import { usePagedItems } from "../shared/hooks";
import {
  dashboardRailWidth,
  dashboardRailCollapsedWidth,
} from "../shared/constants";
export function DashboardWorkspace({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  loaderData,
  actionData,
  darkChrome,
  toggleMode,
}: {
  loaderData: DashboardLoaderData;
  actionData: DashboardActionData;
  darkChrome: boolean;
  toggleMode: () => void;
}) {
  const {
    profile,
    currentUser,
    activation,
    designs,
    orders,
    stages,
    measurementFields,
    moneySummary,
    manualTakings,
    bookings,
    handovers,
    notifications,
    availabilityWindows,
    blackoutDates,
    businessUsers,
    storeSettings,
    collections,
    sizeBands,
    promotions,
    waitlistEntries,
    deliveryZones,
    section,
    orderFilter,
    dataWarnings,
  } = loaderData;
  const action = actionData;
  const settingsFeedback = action.settingsSuccess
    ? { message: action.settingsSuccess, severity: "success" as const }
    : action.settingsError
      ? { message: action.settingsError, severity: "error" as const }
      : action.availabilitySuccess
        ? { message: action.availabilitySuccess, severity: "success" as const }
        : action.availabilityError
          ? { message: action.availabilityError, severity: "error" as const }
          : null;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [settingsFeedbackOpen, setSettingsFeedbackOpen] = useState(
    Boolean(settingsFeedback),
  );
  const [catalogueView, setCatalogueView] = useState<"all" | "add">("all");
  const [catalogueToolsOpen, setCatalogueToolsOpen] = useState<
    "collections" | "sizeBands" | null
  >(null);
  const [addCustomisation, setAddCustomisation] = useState(false);
  const [designLimitDialogOpen, setDesignLimitDialogOpen] = useState(false);
  const [openDesignId, setOpenDesignId] = useState<string | null>(null);
  const [designCollectionFilter, setDesignCollectionFilter] =
    useState<string>("all");
  const [designTypeFilter, setDesignTypeFilter] = useState<
    "all" | "made_to_wear" | "bespoke"
  >("all");
  const openCatalogueDesign =
    openDesignId === null
      ? null
      : (designs.find((design) => design.design_id === openDesignId) ?? null);
  const filteredCatalogueDesigns = designs.filter((design) => {
    const collectionOk =
      designCollectionFilter === "all" ||
      (designCollectionFilter === "none"
        ? !design.collection_id
        : design.collection_id === designCollectionFilter);
    const typeOk =
      designTypeFilter === "all" ||
      (designTypeFilter === "bespoke"
        ? design.customisation_allowed
        : !design.customisation_allowed);
    return collectionOk && typeOk;
  });
  const {
    page: cataloguePage,
    pageCount: cataloguePageCount,
    pagedItems: pagedCatalogueDesigns,
    setPage: setCataloguePage,
  } = usePagedItems(
    filteredCatalogueDesigns,
    8,
    `${catalogueView}:${designCollectionFilter}:${designTypeFilter}:${filteredCatalogueDesigns.length}`,
  );
  const {
    page: measurementFieldPage,
    pageCount: measurementFieldPageCount,
    pagedItems: pagedMeasurementFields,
    setPage: setMeasurementFieldPage,
  } = usePagedItems(measurementFields, 8, measurementFields.length);
  const canManage = canManageDashboard(currentUser.role);
  const storefrontURL = `https://${profile.handle}.xtiitch.com`;
  const isFreePlan = profile.plan === "free";
  const imageLimit = isFreePlan ? 2 : 5;
  const designLimit = isFreePlan ? 10 : null;
  const atDesignLimit = designLimit !== null && designs.length >= designLimit;
  const workspaceGroups = canManage
    ? managementWorkspaceGroups
    : staffWorkspaceGroups;
  const filteredOrders = filterOrders(orders, orderFilter);
  const returnTo = `/dashboard/orders?orders=${orderFilter}`;
  const nextFieldSequence =
    measurementFields.length === 0
      ? 1
      : Math.max(...measurementFields.map((field) => field.sequence)) + 1;
  const pageMeta = dashboardPageMeta(section);
  const overview = useOverviewData({
    profile,
    orders,
    bookings,
    handovers,
    notifications,
    manualTakings,
    moneySummary,
    measurementFields,
    availabilityWindows,
    businessUsers,
    storeSettings,
    collections,
    sizeBands,
    promotions,
    designs,
    canManage,
  });
  useEffect(() => {
    try {
      if (
        window.localStorage.getItem(`xtiitch:tour-seen:${profile.handle}`) !==
        "1"
      ) {
        setTourOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, [profile.handle]);
  useEffect(() => {
    if (settingsFeedback) {
      setSettingsFeedbackOpen(true);
    }
  }, [actionData, settingsFeedback?.message, settingsFeedback?.severity]);
  const railBadges = overview.railBadges as Partial<
    Record<string, string | undefined>
  >;
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: darkChrome ? alpha(tokens.ink, 0.96) : "background.default",
        backgroundImage: darkChrome
          ? `
            radial-gradient(circle at 100% 0%, ${alpha(tokens.burgundy, 0.2)}, transparent 30%),
            radial-gradient(circle at 58% 12%, ${alpha(tokens.info, 0.16)}, transparent 28%),
            linear-gradient(180deg, ${tokens.ink}, ${tokens.charcoal})
          `
          : `linear-gradient(${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.045)} 1px, transparent 1px)`,
        backgroundSize: darkChrome ? "auto" : "36px 36px",
        overflowX: "hidden",
        "@keyframes dashboardRailSlide": {
          from: { opacity: 0, transform: "translateX(-16px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        "@keyframes dashboardRailDrop": {
          from: { opacity: 0, transform: "translateY(-10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "@keyframes dashboardSurfaceIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
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
      <DashboardSnackbar
        open={settingsFeedbackOpen}
        onClose={() => setSettingsFeedbackOpen(false)}
        message={settingsFeedback?.message}
        severity={settingsFeedback?.severity}
      />
      <HelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        section={section}
      />
      <DashboardDialogs
        designLimit={designLimit}
        designLimitDialogOpen={designLimitDialogOpen}
        setDesignLimitDialogOpen={setDesignLimitDialogOpen}
        catalogueToolsOpen={catalogueToolsOpen}
        setCatalogueToolsOpen={setCatalogueToolsOpen}
        collections={collections}
        sizeBands={sizeBands}
        storeHandle={profile.handle}
        collectionError={action.collectionError}
        sizeBandError={action.sizeBandError}
      />
      <ProductTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          try {
            window.localStorage.setItem(
              `xtiitch:tour-seen:${profile.handle}`,
              "1",
            );
          } catch {
            /* ignore */
          }
        }}
      />
      <Box
        sx={{
          maxWidth: 1500,
          width: "100%",
          boxSizing: "border-box",
          mx: "auto",
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          pl: {
            xs: 1.5,
            sm: 2.5,
            md: `calc(${railCollapsed ? dashboardRailCollapsedWidth : dashboardRailWidth}px + 40px)`,
            lg: `calc(${railCollapsed ? dashboardRailCollapsedWidth : dashboardRailWidth}px + 56px)`,
          },
          py: { xs: 1.5, lg: 3 },
          display: "grid",
          gap: { xs: 2, lg: 3 },
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "minmax(0, 1fr)",
          },
        }}
      >
        <WorkspaceRail
          profile={profile}
          currentUser={currentUser}
          verified={profile.verification_status === "verified"}
          workspaceGroups={workspaceGroups}
          section={section}
          storefrontURL={storefrontURL}
          badges={railBadges}
          collapsed={railCollapsed}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          pendingActivation={!activation.activated}
        />
        <Box
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "hidden",
            "@media (prefers-reduced-motion: no-preference)": {
              animation: "dashboardSurfaceIn 500ms ease both",
            },
          }}
        >
          <WorkspaceTopBar
            profile={profile}
            currentUser={currentUser}
            meta={pageMeta}
            verified={profile.verification_status === "verified"}
            collapsed={railCollapsed}
            darkChrome={darkChrome}
            notificationCount={overview.pendingMessages}
            storefrontURL={storefrontURL}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onToggleCollapsed={() => setRailCollapsed((value) => !value)}
            onToggleDarkChrome={toggleMode}
            onOpenHelp={() => setHelpOpen(true)}
            onStartTour={() => setTourOpen(true)}
          />
          <Box
            sx={{
              pt: { xs: 2, md: 2.5 },
              minWidth: 0,
              maxWidth: "100%",
              overflowX: "hidden",
            }}
          >
            <ActivationBanner activation={activation} />
            <WorkspaceHeader
              meta={pageMeta}
              canManage={canManage}
              moneySummary={moneySummary}
              liveOrders={overview.liveOrders}
              activeBookings={overview.activeBookings}
              availabilityWindows={availabilityWindows}
              pendingPayments={overview.pendingPayments}
              needsMeasurements={overview.needsMeasurements}
              openHandovers={overview.openHandovers}
              pendingMessages={overview.pendingMessages}
            />
            <DashboardAlerts
              permissionError={action.permissionError}
              dataWarnings={dataWarnings}
            />
            <DashboardSections
              section={section}
              canManage={canManage}
              orders={orders}
              stages={stages}
              measurementFields={measurementFields}
              moneySummary={moneySummary}
              manualTakings={manualTakings}
              bookings={bookings}
              handovers={handovers}
              notifications={notifications}
              availabilityWindows={availabilityWindows}
              blackoutDates={blackoutDates}
              businessUsers={businessUsers}
              storeSettings={storeSettings}
              collections={collections}
              sizeBands={sizeBands}
              promotions={promotions}
              waitlistEntries={waitlistEntries}
              deliveryZones={deliveryZones}
              designs={designs}
              currentUser={currentUser}
              orderFilter={orderFilter}
              action={action}
              overview={overview}
              filteredOrders={filteredOrders}
              returnTo={returnTo}
              catalogueView={catalogueView}
              setCatalogueView={setCatalogueView}
              openDesignId={openDesignId}
              setOpenDesignId={setOpenDesignId}
              openCatalogueDesign={openCatalogueDesign}
              filteredCatalogueDesigns={filteredCatalogueDesigns}
              pagedCatalogueDesigns={pagedCatalogueDesigns}
              cataloguePage={cataloguePage}
              cataloguePageCount={cataloguePageCount}
              setCataloguePage={setCataloguePage}
              designCollectionFilter={designCollectionFilter}
              setDesignCollectionFilter={setDesignCollectionFilter}
              designTypeFilter={designTypeFilter}
              setDesignTypeFilter={setDesignTypeFilter}
              addCustomisation={addCustomisation}
              setAddCustomisation={setAddCustomisation}
              setDesignLimitDialogOpen={setDesignLimitDialogOpen}
              setCatalogueToolsOpen={setCatalogueToolsOpen}
              pagedMeasurementFields={pagedMeasurementFields}
              measurementFieldPage={measurementFieldPage}
              measurementFieldPageCount={measurementFieldPageCount}
              setMeasurementFieldPage={setMeasurementFieldPage}
              nextFieldSequence={nextFieldSequence}
              imageLimit={imageLimit}
              designLimit={designLimit}
              atDesignLimit={atDesignLimit}
              profile={profile}
              pendingActivation={!activation.activated}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
