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
        <Typography
          variant="h5"
          component="h1"
          sx={{
            lineHeight: 1.05,
            fontSize: { xs: "1.3rem", sm: "1.55rem" },
          }}
          noWrap
        >
          {meta.title}
        </Typography>
      </Box>
    </Stack>
  );
}
