import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import { tokens } from "../../../theme";
import type { Profile, DashboardPageMeta } from "../../shared/types";

export function Search({
  profile,
  meta,
  collapsed,
  darkChrome,
  onOpenMobileNav,
  onToggleCollapsed,
}: {
  profile: Profile;
  meta: DashboardPageMeta;
  collapsed: boolean;
  darkChrome: boolean;
  onOpenMobileNav: () => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={{ xs: 0.75, sm: 1 }}
      sx={{ alignItems: "center", minWidth: 0, flex: "1 1 auto" }}
    >
      <Tooltip title="Open navigation">
        <IconButton
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
          sx={{
            display: { xs: "inline-flex", md: "none" },
            width: { xs: 40, sm: 44 },
            height: { xs: 40, sm: 44 },
            color: "inherit",
            border: "1px solid",
            borderColor: darkChrome
              ? alpha(tokens.white, 0.16)
              : alpha(tokens.ink, 0.1),
          }}
        >
          <MenuRounded />
        </IconButton>
      </Tooltip>
      <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        <IconButton
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
          sx={{
            display: { xs: "none", md: "inline-flex" },
            color: "inherit",
            border: "1px solid",
            borderColor: darkChrome
              ? alpha(tokens.white, 0.16)
              : alpha(tokens.ink, 0.1),
          }}
        >
          {collapsed ? <ChevronRightRounded /> : <ChevronLeftRounded />}
        </IconButton>
      </Tooltip>
      <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
        <Typography
          variant="overline"
          sx={{
            color: darkChrome ? alpha(tokens.white, 0.68) : "primary.main",
            fontWeight: 900,
            display: { xs: "none", sm: "block" },
          }}
        >
          {profile.handle}.xtiitch.com
        </Typography>
        {/*
          A <p>, not an <h1>. The page header below is the h1 and carries the
          same words; two h1s on one page is a heading structure that lies to a
          screen reader about what the page is about.

          Hidden on phones. Measured on a 390px screen, the menu button and the
          four trailing controls leave this 96px — while "Studio command center"
          needs 164px on one line, so it wrapped to three and got clipped to
          "Studio command…". No font size rescues 96px; a title in that space is
          not a title, and it was showing a worse copy of something the page
          header renders in full, at 2rem, immediately underneath.
        */}
        <Typography
          variant="h5"
          component="p"
          sx={{
            display: { xs: "none", sm: "block" },
            lineHeight: 1.05,
            fontSize: { sm: "1.55rem" },
          }}
          noWrap
        >
          {meta.title}
        </Typography>
      </Box>
    </Stack>
  );
}
