import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";
import type { Profile, CurrentUser, WorkspaceNavGroup, DashboardSection } from "../../shared/types";
import { Panel } from "../../../components/ui/Panel";
import { dashboardRailCollapsedWidth, dashboardRailWidth } from "../../shared/constants";
import { NavItems } from "./NavItems";
import { RailHeader } from "./RailHeader";
import { RailFooter } from "./RailFooter";

export function WorkspaceRail({
  profile,
  workspaceGroups,
  section,
  storefrontURL,
  badges,
  collapsed,
  mobileOpen,
  onCloseMobile,
  pendingActivation,
}: {
  profile: Profile;
  currentUser: CurrentUser;
  verified: boolean;
  workspaceGroups: WorkspaceNavGroup[];
  section: DashboardSection;
  storefrontURL: string;
  badges: Partial<Record<DashboardSection, string | undefined>>;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  pendingActivation: boolean;
}) {
  const railSurfaceSx = {
    bgcolor: tokens.charcoal,
    color: tokens.white,
    backgroundImage: `
      linear-gradient(180deg, ${alpha(tokens.white, 0.06)} 0%, transparent 22%),
      linear-gradient(155deg, ${alpha(tokens.burgundy, 0.62)} 0%, ${tokens.charcoal} 50%, ${alpha(tokens.ink, 0.98)} 100%)
    `,
    boxShadow: `inset -1px 0 0 ${alpha(tokens.white, 0.08)}`,
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  };

  const renderRailContent = ({ inDrawer = false }: { inDrawer?: boolean }) => {
    const compact = collapsed && !inDrawer;

    return (
      <Stack
        spacing={{ xs: 1.2, lg: 1.6 }}
        sx={{
          minHeight: inDrawer ? "100dvh" : "100%",
          width: "100%",
          p: compact ? 1 : { xs: 1.25, sm: 1.5 },
          pb: inDrawer
            ? "calc(16px + env(safe-area-inset-bottom))"
            : compact
              ? 1
              : { xs: 1.25, sm: 1.5 },
        }}
      >
        <RailHeader
          profile={profile}
          compact={compact}
          inDrawer={inDrawer}
          onCloseMobile={onCloseMobile}
        />

        <Box
          sx={{
            flex: inDrawer ? "0 0 auto" : 1,
            minHeight: inDrawer ? "auto" : 0,
          }}
        >
          <NavItems
            workspaceGroups={workspaceGroups}
            section={section}
            badges={badges}
            compact={compact}
            inDrawer={inDrawer}
            onCloseMobile={onCloseMobile}
          />
        </Box>

        <RailFooter
          profile={profile}
          storefrontURL={storefrontURL}
          compact={compact}
          pendingActivation={pendingActivation}
        />
      </Stack>
    );
  };

  return (
    <>
      <Panel
        id="dashboard-rail"
        sx={{
          ...railSurfaceSx,
          display: { xs: "none", md: "block" },
          p: 0,
          position: "fixed",
          top: { md: 16, lg: 24 },
          bottom: { md: 16, lg: 24 },
          left: { md: 16, lg: 24 },
          width: collapsed ? dashboardRailCollapsedWidth : dashboardRailWidth,
          zIndex: 18,
          overflowX: "hidden",
          overflowY: "auto",
          backdropFilter: "blur(14px)",
          borderColor: alpha(tokens.white, 0.12),
          boxShadow: `18px 0 60px ${alpha(tokens.ink, 0.18)}`,
          transition: "width 220ms ease",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "dashboardRailSlide 520ms cubic-bezier(.2,.8,.2,1) both",
          },
        }}
      >
        {renderRailContent({})}
      </Panel>
      <Drawer
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              ...railSurfaceSx,
              width: { xs: "min(90vw, 332px)", sm: 340 },
              maxWidth: "calc(100vw - 20px)",
              height: "100dvh",
              maxHeight: "100dvh",
              display: "block",
              borderRight: "1px solid",
              borderColor: alpha(tokens.white, 0.12),
              overflowX: "hidden",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehaviorY: "contain",
              scrollbarWidth: "thin",
              scrollbarColor: `${alpha(tokens.white, 0.34)} transparent`,
              "&::-webkit-scrollbar": {
                display: "block",
                width: 8,
              },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: 999,
                bgcolor: "rgba(var(--surface-rgb), 0.28)",
              },
            },
          },
        }}
      >
        {renderRailContent({ inDrawer: true })}
      </Drawer>
    </>
  );
}
