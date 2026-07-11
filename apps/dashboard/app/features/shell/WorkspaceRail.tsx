import { Form } from "react-router";
import { Link as RouterLink } from "react-router";
import { useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRounded from "@mui/icons-material/KeyboardArrowRightRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../theme";
import { Profile, CurrentUser, WorkspaceNavGroup, DashboardSection } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { dashboardRailCollapsedWidth, dashboardRailWidth } from "../shared/constants";

export function WorkspaceRail({
  profile,
  workspaceGroups,
  section,
  storefrontURL,
  badges,
  collapsed,
  mobileOpen,
  onCloseMobile,
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      workspaceGroups.map((group) => [
        group.id,
        group.id === "command"
          ? group.items.some((item) => item.section === section)
          : true,
      ]),
    ),
  );
  const toggleGroup = (groupId: string) => {
    setOpenGroups((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }));
  };

  const renderWorkspaceGroup = (
    group: WorkspaceNavGroup,
    inDrawer: boolean,
    compact: boolean,
    placement: "main" | "bottom" = "main",
    solo = false,
  ) => {
    const activeGroup = group.items.some((item) => item.section === section);
    const open = openGroups[group.id] ?? true;
    const groupBadge = group.items.reduce((total, item) => {
      const value = Number(badges[item.section] ?? 0);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    const groupTone = placement === "bottom" ? tokens.gold : tokens.warning;

    return (
      <Box key={group.id}>
        {!solo &&
          (compact ? (
            <Tooltip title={group.label} placement="right">
              <IconButton
                aria-label={`${group.label} navigation group`}
                aria-expanded={open}
                onClick={() => toggleGroup(group.id)}
                sx={{
                  width: "100%",
                  height: 40,
                  color: activeGroup ? groupTone : alpha(tokens.white, 0.78),
                  border: "1px solid",
                  borderColor: activeGroup
                    ? alpha(groupTone, 0.34)
                    : alpha(tokens.white, 0.1),
                  bgcolor: activeGroup
                    ? alpha(groupTone, 0.12)
                    : alpha(tokens.white, 0.035),
                  borderRadius: 1.25,
                  "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.1)" },
                }}
              >
                <Badge
                  color="error"
                  badgeContent={groupBadge}
                  invisible={groupBadge === 0}
                  max={99}
                  sx={{
                    "& .MuiBadge-badge": {
                      bgcolor: tokens.burgundy,
                      color: tokens.white,
                      border: `1px solid ${alpha(tokens.white, 0.28)}`,
                    },
                  }}
                >
                  {group.icon}
                </Badge>
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              type="button"
              onClick={() => toggleGroup(group.id)}
              startIcon={group.icon}
              endIcon={
                open ? (
                  <KeyboardArrowDownRounded />
                ) : (
                  <KeyboardArrowRightRounded />
                )
              }
              aria-expanded={open}
              fullWidth
              sx={{
                minHeight: 36,
                justifyContent: "flex-start",
                color: activeGroup ? tokens.white : alpha(tokens.white, 0.72),
                borderRadius: 1.25,
                border: "1px solid",
                borderColor: activeGroup
                  ? alpha(groupTone, 0.3)
                  : "transparent",
                bgcolor: activeGroup ? alpha(groupTone, 0.11) : "transparent",
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 9,
                  bottom: 9,
                  width: 2,
                  borderRadius: 4,
                  bgcolor: activeGroup ? groupTone : "transparent",
                },
                "& .MuiButton-startIcon": {
                  color: activeGroup ? groupTone : alpha(tokens.white, 0.62),
                },
                "& .MuiButton-endIcon": {
                  ml: "auto",
                  color: alpha(tokens.white, 0.56),
                },
                "&:hover": {
                  bgcolor: "rgba(var(--surface-rgb), 0.08)",
                  borderColor: alpha(tokens.white, 0.1),
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  minWidth: 0,
                  flex: 1,
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 950,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                }}
              >
                {group.label}
              </Box>
              {groupBadge > 0 ? (
                <Chip
                  size="small"
                  label={groupBadge}
                  sx={{
                    height: 20,
                    mr: 0.5,
                    color: tokens.white,
                    bgcolor: alpha(tokens.burgundy, 0.72),
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.14),
                  }}
                />
              ) : null}
            </Button>
          ))}
        <Collapse in={solo || open} timeout="auto" unmountOnExit>
          <Stack
            spacing={0.55}
            sx={{
              mt: 0.6,
              display: "grid",
              // Indent + a connecting rail so grouped items read as nested under
              // their header (solo Overview has no header, so no indent).
              ...(solo
                ? {}
                : {
                    ml: 1.25,
                    pl: 1.5,
                    borderLeft: "1px solid",
                    borderColor: alpha(tokens.white, 0.14),
                  }),
            }}
          >
            {group.items.map((item) => {
              const active = item.section === section;
              const badge = badges[item.section];
              const itemButton = (
                <Button
                  key={item.href}
                  component={RouterLink}
                  to={item.href}
                  fullWidth
                  startIcon={compact ? undefined : item.icon}
                  aria-current={active ? "page" : undefined}
                  onClick={inDrawer ? onCloseMobile : undefined}
                  sx={{
                    minHeight: compact ? 44 : 48,
                    minWidth: 0,
                    px: compact ? 1 : 1.4,
                    justifyContent: compact ? "center" : "flex-start",
                    position: "relative",
                    overflow: "hidden",
                    color: active ? tokens.white : alpha(tokens.white, 0.88),
                    bgcolor: active ? alpha(tokens.white, 0.11) : "transparent",
                    border: "1px solid",
                    borderColor: active
                      ? alpha(tokens.gold, 0.24)
                      : "transparent",
                    borderRadius: 1.25,
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 7,
                      bottom: 7,
                      width: 3,
                      borderRadius: 4,
                      bgcolor: active ? tokens.gold : "transparent",
                    },
                    "& .MuiButton-startIcon": {
                      color: active ? tokens.gold : alpha(tokens.white, 0.58),
                    },
                    "&:hover": {
                      bgcolor: "rgba(var(--surface-rgb), 0.09)",
                      borderColor: alpha(tokens.white, 0.12),
                      color: tokens.white,
                      transform: compact
                        ? "translateY(-1px)"
                        : "translateX(2px)",
                      "& .MuiButton-startIcon": {
                        color: active ? tokens.gold : tokens.white,
                      },
                    },
                    transition:
                      "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
                  }}
                >
                  {compact ? (
                    <Badge
                      color="error"
                      badgeContent={badge ? Number(badge) : 0}
                      invisible={!badge}
                      max={99}
                      sx={{
                        "& .MuiBadge-badge": {
                          bgcolor: tokens.burgundy,
                          color: tokens.white,
                          border: `1px solid ${alpha(tokens.white, 0.28)}`,
                        },
                      }}
                    >
                      {item.icon}
                    </Badge>
                  ) : (
                    <>
                      <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                        <Typography
                          component="span"
                          sx={{
                            display: "block",
                            fontWeight: active ? 900 : 780,
                            fontSize: 14,
                            lineHeight: 1.15,
                          }}
                          noWrap
                        >
                          {item.label}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            display: "block",
                            color: alpha(tokens.white, 0.56),
                            lineHeight: 1.1,
                          }}
                          noWrap
                        >
                          {item.helper}
                        </Typography>
                      </Box>
                      {badge ? (
                        <Chip
                          size="small"
                          label={badge}
                          sx={{
                            height: 22,
                            color: tokens.white,
                            bgcolor: alpha(tokens.burgundy, 0.72),
                            border: "1px solid",
                            borderColor: alpha(tokens.white, 0.14),
                          }}
                        />
                      ) : null}
                    </>
                  )}
                </Button>
              );

              return (
                <Box key={item.href}>
                  {compact ? (
                    <Tooltip title={item.label} placement="right">
                      {itemButton}
                    </Tooltip>
                  ) : (
                    itemButton
                  )}
                </Box>
              );
            })}
          </Stack>
        </Collapse>
      </Box>
    );
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
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            p: compact ? 0.75 : 1.25,
            border: "1px solid",
            borderColor: alpha(tokens.gold, 0.22),
            borderRadius: 2.5,
            color: tokens.white,
            backgroundColor: alpha(tokens.white, 0.05),
            backgroundImage: `radial-gradient(120% 140% at 0% 0%, ${alpha(tokens.gold, 0.16)} 0%, transparent 44%), linear-gradient(150deg, ${alpha(tokens.burgundy, 0.5)} 0%, ${alpha(tokens.ink, 0)} 62%)`,
            backdropFilter: "blur(14px)",
            boxShadow: `0 18px 44px ${alpha(tokens.ink, 0.42)}, inset 0 1px 0 ${alpha(tokens.white, 0.12)}`,
            "&::before": {
              content: '""',
              position: "absolute",
              insetInline: 14,
              top: 0,
              height: "1px",
              background: `linear-gradient(90deg, transparent, ${alpha(tokens.gold, 0.7)}, transparent)`,
            },
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              alignItems: "center",
              justifyContent: compact ? "center" : "space-between",
            }}
          >
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", minWidth: 0 }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: compact ? 44 : 48,
                  height: compact ? 44 : 48,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  color: tokens.white,
                  backgroundImage: `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
                  border: `1px solid ${alpha(tokens.gold, 0.5)}`,
                  boxShadow: `0 14px 30px ${alpha(tokens.burgundy, 0.5)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontFamily: '"Fraunces", serif',
                    fontWeight: 900,
                    fontSize: 23,
                    lineHeight: 1,
                  }}
                >
                  {(profile.name?.trim()?.charAt(0) ?? "X").toUpperCase()}
                </Typography>
              </Box>
              {!compact ? (
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: '"Fraunces", serif',
                      fontSize: 19,
                      lineHeight: 1.15,
                      color: tokens.white,
                    }}
                    noWrap
                  >
                    {profile.name}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: 0,
                      textTransform: "uppercase",
                      color: tokens.gold,
                    }}
                  >
                    {profile.plan
                      ? `${profile.plan.charAt(0).toUpperCase()}${profile.plan.slice(1)} plan`
                      : "Business"}
                  </Typography>
                </Box>
              ) : null}
            </Stack>
            {inDrawer ? (
              <IconButton
                aria-label="Close navigation"
                onClick={onCloseMobile}
                sx={{
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.14),
                  bgcolor: "rgba(var(--surface-rgb), 0.06)",
                  flexShrink: 0,
                }}
              >
                <CloseRounded />
              </IconButton>
            ) : null}
          </Stack>
        </Box>

        <Box
          sx={{
            flex: inDrawer ? "0 0 auto" : 1,
            minHeight: inDrawer ? "auto" : 0,
          }}
        >
          <Stack spacing={0.85} sx={{ display: "grid" }}>
            {/* Overview renders solo at the top (no group header); the rest of
                the groups flow in order with Command last, no longer pinned. */}
            {workspaceGroups.map((group) =>
              renderWorkspaceGroup(
                group,
                inDrawer,
                compact,
                "main",
                group.id === "overview",
              ),
            )}
          </Stack>
        </Box>

        <Box sx={{ mt: "auto" }}>
          {compact ? (
            <Tooltip title="View storefront" placement="right">
              <IconButton
                component={MuiLink}
                href={storefrontURL}
                target="_blank"
                rel="noreferrer"
                aria-label="View storefront"
                sx={{
                  width: "100%",
                  height: 48,
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.16),
                  bgcolor: alpha(tokens.burgundy, 0.72),
                  borderRadius: 1.5,
                  "&:hover": { bgcolor: alpha(tokens.burgundy, 0.82) },
                }}
              >
                <VisibilityRounded />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              component={MuiLink}
              href={storefrontURL}
              target="_blank"
              rel="noreferrer"
              variant="contained"
              startIcon={<VisibilityRounded />}
              fullWidth
              sx={{
                bgcolor: tokens.burgundy,
                color: tokens.white,
                "&:hover": { bgcolor: alpha(tokens.burgundy, 0.82) },
              }}
            >
              View storefront
            </Button>
          )}
          {profile.plan !== "growth" && profile.plan !== "studio" ? (
            compact ? (
              <Tooltip title="Upgrade plan" placement="right">
                <IconButton
                  component={RouterLink}
                  to="/onboarding/billing"
                  aria-label="Upgrade plan"
                  sx={{
                    mt: 1,
                    width: "100%",
                    height: 48,
                    color: tokens.charcoal,
                    border: "1px solid",
                    borderColor: alpha(tokens.gold, 0.6),
                    bgcolor: tokens.gold,
                    borderRadius: 1.5,
                    "&:hover": { bgcolor: alpha(tokens.gold, 0.85) },
                  }}
                >
                  <TrendingUpRounded />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                component={RouterLink}
                to="/onboarding/billing"
                startIcon={<TrendingUpRounded />}
                fullWidth
                sx={{
                  mt: 1,
                  color: tokens.charcoal,
                  fontWeight: 800,
                  bgcolor: tokens.gold,
                  "&:hover": { bgcolor: alpha(tokens.gold, 0.85) },
                }}
              >
                Upgrade plan
              </Button>
            )
          ) : null}
          <Form method="post">
            <input type="hidden" name="intent" value="logout" />
            {compact ? (
              <Tooltip title="Log out" placement="right">
                <IconButton
                  type="submit"
                  aria-label="Log out"
                  sx={{
                    mt: 1,
                    width: "100%",
                    height: 48,
                    color: tokens.white,
                    border: "1px solid",
                    borderColor: alpha(tokens.white, 0.16),
                    bgcolor: "rgba(var(--surface-rgb), 0.06)",
                    borderRadius: 1.5,
                    "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
                  }}
                >
                  <LogoutRounded />
                </IconButton>
              </Tooltip>
            ) : (
              <Button
                type="submit"
                color="inherit"
                startIcon={<LogoutRounded />}
                fullWidth
                sx={{
                  mt: 1,
                  color: tokens.white,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.16),
                  bgcolor: "rgba(var(--surface-rgb), 0.06)",
                  "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
                }}
              >
                Log out
              </Button>
            )}
          </Form>
        </Box>
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