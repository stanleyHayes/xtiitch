import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Stack from "@mui/material/Stack";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../../theme";
import { Section } from "../../shared/types";
import { adminRailCollapsedWidth, adminRailWidth } from "../../shared/types";
import { NavItems } from "./NavItems";
import { RailHeader } from "./RailHeader";
import { RailFooter } from "./RailFooter";

export function AdminRail({
  section,
  collapsed,
  mobileOpen,
  notificationCount,
  pendingCount,
  riskCount,
  urgentTickets,
  brandLogoUrl,
  onCloseMobile,
  onSelect,
}: {
  section: Section;
  collapsed: boolean;
  mobileOpen: boolean;
  notificationCount: number;
  pendingCount: number;
  riskCount: number;
  urgentTickets: number;
  brandLogoUrl: string;
  onCloseMobile: () => void;
  onSelect: (section: Section) => void;
}) {
  const railSx = {
    bgcolor: tokens.charcoal,
    color: tokens.white,
    overflowX: "hidden",
    overflowY: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
    backgroundImage: `
      linear-gradient(180deg, ${alpha(tokens.white, 0.06)} 0%, transparent 22%),
      linear-gradient(155deg, ${alpha(tokens.burgundy, 0.66)} 0%, ${tokens.charcoal} 48%, ${alpha(tokens.ink, 0.98)} 100%)
    `,
    boxShadow: `inset -1px 0 0 ${alpha(tokens.white, 0.08)}`,
  };

  return (
    <>
      <Box
        component="aside"
        sx={{
          ...railSx,
          display: { xs: "none", lg: "block" },
          borderRight: "1px solid",
          borderColor: alpha(tokens.white, 0.12),
          position: "fixed",
          inset: "0 auto 0 0",
          width: collapsed ? adminRailCollapsedWidth : adminRailWidth,
          height: "100dvh",
          zIndex: 10,
          boxShadow: `18px 0 55px ${alpha(tokens.ink, 0.22)}`,
          transition: "width 220ms ease",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "adminRailSlide 520ms cubic-bezier(.2,.8,.2,1) both",
          },
        }}
      >
        <Stack
          spacing={2}
          sx={{
            minHeight: "100%",
            p: collapsed ? 1 : { xs: 1.25, sm: 1.5 },
            pb: collapsed ? 1 : "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          <RailHeader
            collapsed={collapsed}
            brandLogoUrl={brandLogoUrl}
          />
          <NavItems
            section={section}
            collapsed={collapsed}
            notificationCount={notificationCount}
            pendingCount={pendingCount}
            riskCount={riskCount}
            urgentTickets={urgentTickets}
            onSelect={onSelect}
          />
          <RailFooter collapsed={collapsed} />
        </Stack>
      </Box>
      <Drawer
        open={mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: {
            sx: {
              ...railSx,
              width: { xs: "min(90vw, 320px)", sm: 328 },
              maxWidth: "calc(100vw - 20px)",
              height: "100dvh",
              maxHeight: "100dvh",
              display: "block",
              borderRight: "1px solid",
              borderColor: alpha(tokens.white, 0.12),
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
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
        <Stack
          spacing={2}
          sx={{
            minHeight: "100%",
            p: { xs: 1.25, sm: 1.5 },
            pb: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          <RailHeader
            collapsed={false}
            brandLogoUrl={brandLogoUrl}
            onClose={onCloseMobile}
          />
          <NavItems
            section={section}
            collapsed={false}
            notificationCount={notificationCount}
            pendingCount={pendingCount}
            riskCount={riskCount}
            urgentTickets={urgentTickets}
            onClose={onCloseMobile}
            onSelect={onSelect}
          />
          <RailFooter collapsed={false} />
        </Stack>
      </Drawer>
    </>
  );
}
