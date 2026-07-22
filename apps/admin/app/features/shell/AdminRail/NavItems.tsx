import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import { tokens } from "../../../theme";
import {
  AdminNavGroup,
  AdminNavItem,
  Section,
  adminNavGroups,
  adminNavItem,
  adminOverviewNavId,
} from "../../shared/types";

// The complete navigation tree stays together so group state and badges share one source of truth.
// eslint-disable-next-line max-lines-per-function
export function NavItems({
  section,
  collapsed,
  notificationCount,
  pendingCount,
  riskCount,
  urgentTickets,
  onClose,
  onSelect,
}: {
  section: Section;
  collapsed: boolean;
  notificationCount: number;
  pendingCount: number;
  riskCount: number;
  urgentTickets: number;
  onClose?: () => void;
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
    close?: () => void,
  ) => {
    const selected = item.id === section;
    const badge = navBadge(item.id);
    const button = (
      <ListItemButton
        selected={selected}
        onClick={() => {
          onSelect(item.id);
          close?.();
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
          "&.Mui-selected": {
            bgcolor: "rgba(var(--surface-rgb), 0.11)",
          },
          "&.Mui-selected:hover, &:hover": {
            bgcolor: "rgba(var(--surface-rgb), 0.09)",
            transform: compact ? "translateY(-1px)" : "translateX(1px)",
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

  // Group markup includes both collapsed and expanded rail presentations.
  /* eslint-disable max-lines-per-function */
  const renderNavGroup = (
    group: AdminNavGroup,
    compact: boolean,
    close?: () => void,
    placement: "main" | "bottom" = "main",
  ) => {
    const activeGroup = group.items.some((item) => item.id === section);
    const open = openGroups[group.id] ?? true;
    const groupBadge = group.items.reduce((total, item) => {
      const value = Number(navBadge(item.id) ?? 0);
      return Number.isFinite(value) ? total + value : total;
    }, 0);
    const groupTone = placement === "bottom" ? tokens.gold : tokens.gold;

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
              minHeight: 40,
              justifyContent: "flex-start",
              px: 0.65,
              color: activeGroup ? groupTone : alpha(tokens.white, 0.72),
              borderRadius: 0.75,
              border: 0,
              bgcolor: "transparent",
              position: "relative",
              "& .MuiButton-startIcon": {
                mr: 1.25,
                color: activeGroup ? groupTone : alpha(groupTone, 0.82),
              },
              "& .MuiButton-endIcon": {
                ml: "auto",
                color: alpha(tokens.white, 0.56),
              },
              "&:hover": {
                bgcolor: alpha(tokens.white, 0.055),
                color: groupTone,
              },
            }}
          >
            <Box
              component="span"
              sx={{
                minWidth: 0,
                flex: 1,
                textAlign: "left",
                fontSize: 11.5,
                fontWeight: 850,
                letterSpacing: "0.16em",
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
              mt: 0.25,
              display: "grid",
              gap: 0.2,
              position: "relative",
              ...(compact
                ? {}
                : {
                    ml: 1.45,
                    pl: 2.45,
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 24,
                      width: 2,
                      borderRadius: 999,
                      bgcolor: activeGroup
                        ? alpha(groupTone, 0.58)
                        : alpha(groupTone, 0.34),
                    },
                  }),
            }}
          >
            {group.items.map((item) => (
              <Box
                key={item.id}
                sx={
                  compact
                    ? undefined
                    : {
                        position: "relative",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          zIndex: 1,
                          left: -19.5,
                          top: 23,
                          width: 19.5,
                          height: 2,
                          borderRadius: 999,
                          bgcolor:
                            item.id === section
                              ? groupTone
                              : alpha(groupTone, 0.42),
                        },
                      }
                }
              >
                {renderNavItem(item, compact, close)}
              </Box>
            ))}
          </List>
        </Collapse>
      </Box>
    );
  };
  /* eslint-enable max-lines-per-function */

  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <List
        sx={{
          p: 0,
          mt: collapsed ? 0 : 0.85,
          display: "grid",
          gap: collapsed ? 0.65 : 1.15,
        }}
      >
        {renderNavGroup(
          {
            id: "dashboard",
            label: "Dashboard",
            icon: adminNavItem(adminOverviewNavId).icon,
            items: [adminNavItem(adminOverviewNavId)],
          },
          collapsed,
          onClose,
        )}
        {adminNavGroups.map((group) =>
          renderNavGroup(group, collapsed, onClose),
        )}
      </List>
    </Box>
  );
}
