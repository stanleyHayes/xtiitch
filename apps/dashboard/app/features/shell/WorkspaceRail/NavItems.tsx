import { Link as RouterLink } from "react-router";
import { useState } from "react";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowRightRounded from "@mui/icons-material/KeyboardArrowRightRounded";
import { tokens } from "../../../theme";
import type { DashboardSection, WorkspaceNavGroup } from "../../shared/types";

export function NavItems({
  workspaceGroups,
  section,
  badges,
  compact,
  inDrawer,
  onCloseMobile,
}: {
  workspaceGroups: WorkspaceNavGroup[];
  section: DashboardSection;
  badges: Partial<Record<DashboardSection, string | undefined>>;
  compact: boolean;
  inDrawer: boolean;
  onCloseMobile: () => void;
}) {
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

  return (
    <Stack spacing={0.85} sx={{ display: "grid" }}>
      {/* Overview renders solo at the top (no group header); the rest of
          the groups flow in order with Command last, no longer pinned. */}
      {workspaceGroups.map((group) => (
        <WorkspaceGroup
          key={group.id}
          group={group}
          section={section}
          badges={badges}
          compact={compact}
          inDrawer={inDrawer}
          open={openGroups[group.id] ?? true}
          onToggle={() => toggleGroup(group.id)}
          onCloseMobile={onCloseMobile}
        />
      ))}
    </Stack>
  );
}

// Group markup includes both collapsed and expanded rail presentations.
// eslint-disable-next-line max-lines-per-function
function WorkspaceGroup({
  group,
  section,
  badges,
  compact,
  inDrawer,
  open,
  onToggle,
  onCloseMobile,
}: {
  group: WorkspaceNavGroup;
  section: DashboardSection;
  badges: Partial<Record<DashboardSection, string | undefined>>;
  compact: boolean;
  inDrawer: boolean;
  open: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
}) {
  const activeGroup = group.items.some((item) => item.section === section);
  const groupBadge = group.items.reduce((total, item) => {
    const value = Number(badges[item.section] ?? 0);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
  const groupTone = tokens.warning;

  return (
    <Box>
      {compact ? (
        <Tooltip title={group.label} placement="right">
          <IconButton
            aria-label={`${group.label} navigation group`}
            aria-expanded={open}
            onClick={onToggle}
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
          onClick={onToggle}
          startIcon={group.icon}
          endIcon={
            open ? <KeyboardArrowDownRounded /> : <KeyboardArrowRightRounded />
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
        <Stack
          spacing={0.55}
          sx={{
            mt: 0.25,
            display: "grid",
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
            <NavItem
              key={item.href}
              item={item}
              section={section}
              badge={badges[item.section]}
              compact={compact}
              inDrawer={inDrawer}
              onCloseMobile={onCloseMobile}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

// The item adapts its link, badge, connector, and compact state in one component.
// eslint-disable-next-line complexity
function NavItem({
  item,
  section,
  badge,
  compact,
  inDrawer,
  onCloseMobile,
}: {
  item: WorkspaceNavGroup["items"][number];
  section: DashboardSection;
  badge: string | undefined;
  compact: boolean;
  inDrawer: boolean;
  onCloseMobile: () => void;
}) {
  const active = item.section === section;
  const button = (
    <Button
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
        borderColor: active ? alpha(tokens.gold, 0.24) : "transparent",
        borderRadius: 1.25,
        "& .MuiButton-startIcon": {
          color: active ? tokens.gold : alpha(tokens.white, 0.58),
        },
        "&:hover": {
          bgcolor: "rgba(var(--surface-rgb), 0.09)",
          borderColor: alpha(tokens.white, 0.12),
          color: tokens.white,
          transform: compact ? "translateY(-1px)" : "translateX(1px)",
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
    <Box
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
                bgcolor: active ? tokens.gold : alpha(tokens.gold, 0.42),
              },
            }
      }
    >
      {compact ? (
        <Tooltip title={item.label} placement="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </Box>
  );
}
