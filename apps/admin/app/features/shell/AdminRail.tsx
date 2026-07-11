import { Form } from "react-router";
import { useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import ShieldRounded from "@mui/icons-material/ShieldRounded";
import { tokens } from "../../theme";
import { AdminNavGroup, AdminNavItem, Section, adminNavGroups, adminNavItem, adminOverviewNavId, adminRailCollapsedWidth, adminRailWidth } from "../shared/types";



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
  const navBadge = (id: Section): string | null => {
    if (id === "notifications" && notificationCount > 0) {
      return String(notificationCount);
    }
    if (id === "verification" && pendingCount > 0) {
      return String(pendingCount);
    }
    if (id === "support" && urgentTickets > 0) {
      return String(urgentTickets);
    }
    if (id === "risk" && riskCount > 0) {
      return String(riskCount);
    }
    return null;
  };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      adminNavGroups.map((group) => [
        group.id,
        group.id === "command"
          ? group.items.some((item) => item.id === section)
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
  const renderNavItem = (
    item: AdminNavItem,
    compact: boolean,
    onClose?: () => void,
  ) => {
    const selected = item.id === section;
    const badge = navBadge(item.id);
    const button = (
      <ListItemButton
        selected={selected}
        onClick={() => {
          onSelect(item.id);
          onClose?.();
        }}
        sx={{
          borderRadius: 1.25,
          minHeight: compact ? 44 : 48,
          px: compact ? 1 : 1.4,
          justifyContent: compact ? "center" : "flex-start",
          position: "relative",
          overflow: "hidden",
          color: selected ? tokens.white : alpha(tokens.white, 0.88),
          border: "1px solid",
          borderColor: selected ? alpha(tokens.gold, 0.24) : "transparent",
          bgcolor: selected ? alpha(tokens.white, 0.11) : "transparent",
          transition:
            "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 4,
            bgcolor: selected ? tokens.gold : "transparent",
          },
          "&.Mui-selected": {
            bgcolor: "rgba(var(--surface-rgb), 0.11)",
          },
          "&.Mui-selected:hover, &:hover": {
            bgcolor: "rgba(var(--surface-rgb), 0.09)",
            transform: compact ? "translateY(-1px)" : "translateX(2px)",
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: compact ? 0 : 38,
            color: selected ? tokens.gold : alpha(tokens.white, 0.58),
            justifyContent: "center",
          }}
        >
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
        </ListItemIcon>
        {!compact ? (
          <>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                component="span"
                sx={{
                  display: "block",
                  fontWeight: selected ? 900 : 760,
                  fontSize: 14,
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
        ) : null}
      </ListItemButton>
    );

    return compact ? (
      <Tooltip title={item.label} placement="right">
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

  const renderNavGroup = (
    group: AdminNavGroup,
    compact: boolean,
    onClose?: () => void,
    placement: "main" | "bottom" = "main",
  ) => {
    const activeGroup = group.items.some((item) => item.id === section);
    const open = openGroups[group.id] ?? true;
    const groupBadge = group.items.reduce((total, item) => {
      const value = Number(navBadge(item.id) ?? 0);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    const groupTone = placement === "bottom" ? tokens.gold : tokens.warning;

    return (
      <Box key={group.id}>
        {compact ? (
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
              open ? <KeyboardArrowDownRounded /> : <ChevronRightRounded />
            }
            aria-expanded={open}
            fullWidth
            sx={{
              minHeight: 36,
              justifyContent: "flex-start",
              color: activeGroup ? tokens.white : alpha(tokens.white, 0.72),
              borderRadius: 1.25,
              border: "1px solid",
              borderColor: activeGroup ? alpha(groupTone, 0.3) : "transparent",
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
        )}
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List
            sx={{
              p: 0,
              mt: 0.6,
              display: "grid",
              gap: 0.55,
            }}
          >
            {group.items.map((item) => (
              <Box key={item.id}>{renderNavItem(item, compact, onClose)}</Box>
            ))}
          </List>
        </Collapse>
      </Box>
    );
  };

  const renderRailContent = ({
    compact,
    onClose,
  }: {
    compact: boolean;
    onClose?: () => void;
  }) => (
    <Stack
      spacing={2}
      sx={{
        minHeight: "100%",
        p: compact ? 1 : { xs: 1.25, sm: 1.5 },
        pb: compact ? 1 : "calc(12px + env(safe-area-inset-bottom))",
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
                overflow: "hidden",
                backgroundImage: brandLogoUrl
                  ? `linear-gradient(155deg, ${alpha(tokens.white, 0.06)}, ${alpha(tokens.charcoal, 0.18)})`
                  : `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
                border: `1px solid ${alpha(tokens.gold, 0.5)}`,
                boxShadow: `0 14px 30px ${alpha(tokens.burgundy, 0.5)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
              }}
            >
              {brandLogoUrl ? (
                <Box
                  component="img"
                  src={brandLogoUrl}
                  alt=""
                  aria-hidden
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    p: 0.75,
                  }}
                />
              ) : (
                <>
                  <Box
                    component="img"
                    src="/favicon.svg"
                    alt=""
                    aria-hidden
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      p: 0.85,
                    }}
                  />
                  <ShieldRounded
                    sx={{
                      position: "absolute",
                      right: -6,
                      bottom: -6,
                      fontSize: 16,
                      p: "2px",
                      borderRadius: "50%",
                      color: tokens.charcoal,
                      bgcolor: tokens.gold,
                      boxShadow: `0 4px 10px ${alpha(tokens.ink, 0.5)}`,
                    }}
                  />
                </>
              )}
            </Box>
            {!compact ? (
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: '"Fraunces", serif',
                    fontSize: 18,
                    lineHeight: 1.15,
                    color: tokens.white,
                  }}
                  noWrap
                >
                  Xtiitch
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0,
                    textTransform: "uppercase",
                    color: tokens.gold,
                  }}
                >
                  Admin console
                </Typography>
              </Box>
            ) : null}
          </Stack>
          {onClose ? (
            <IconButton
              aria-label="Close navigation"
              onClick={onClose}
              sx={{
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.14),
                bgcolor: "rgba(var(--surface-rgb), 0.06)",
              }}
            >
              <CloseRounded />
            </IconButton>
          ) : null}
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <List
          sx={{
            p: 0,
            mt: compact ? 0 : 0.85,
            display: "grid",
            gap: compact ? 0.65 : 0.85,
          }}
        >
          {/* Overview stands alone at the top — not inside the Command group. */}
          {renderNavItem(adminNavItem(adminOverviewNavId), compact, onClose)}
          <Box
            sx={{
              height: "1px",
              my: 0.4,
              bgcolor: alpha(tokens.white, 0.08),
            }}
          />
          {/* All groups flow in order; Command is simply the last group now. */}
          {adminNavGroups.map((group) =>
            renderNavGroup(group, compact, onClose),
          )}
        </List>
      </Box>

      <Box>
        <Form method="post">
          <input type="hidden" name="intent" value="logout" />
          {compact ? (
            <Tooltip title="Sign out" placement="right">
              <IconButton
                type="submit"
                aria-label="Sign out"
                sx={{
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
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.16),
                bgcolor: "rgba(var(--surface-rgb), 0.06)",
                "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
              }}
            >
              Sign out
            </Button>
          )}
        </Form>
      </Box>
    </Stack>
  );

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
        {renderRailContent({ compact: collapsed })}
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
        {renderRailContent({ compact: false, onClose: onCloseMobile })}
      </Drawer>
    </>
  );
}
