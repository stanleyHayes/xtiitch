import { useEffect, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import { type NavGroup, NAV_WATERMARK_COLORS } from "./nav-data";

export function MegaItem({
  item,
  index,
  active = false,
  onNavigate,
}: {
  item: import("./nav-data").NavItem;
  index: number;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Box
      component={RouterLink}
      to={item.href}
      onClick={onNavigate}
      sx={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        gap: 1.5,
        alignItems: "flex-start",
        p: 1.5,
        borderRadius: 1.5,
        textDecoration: "none",
        color: active ? "primary.main" : "text.primary",
        border: "1px solid",
        borderColor: active ? "rgba(128,0,32,0.16)" : "transparent",
        bgcolor: active ? "rgba(128,0,32,0.06)" : "transparent",
        transition:
          "transform 180ms ease, background-color 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          bgcolor: "rgba(128,0,32,0.04)",
          borderColor: "rgba(128,0,32,0.12)",
          "& .mega-ico": { transform: "rotate(-4deg) scale(1.06)" },
          "& .mega-go": { opacity: 1, transform: "translateX(0)" },
          "& .mega-watermark": {
            opacity: 0.24,
            transform: "translate(4px, 4px) rotate(-8deg) scale(1.1)",
          },
        },
      }}
    >
      <Box
        className="mega-watermark"
        aria-hidden
        sx={{
          position: "absolute",
          right: -22,
          bottom: -28,
          color: active
            ? "primary.main"
            : NAV_WATERMARK_COLORS[index % NAV_WATERMARK_COLORS.length],
          opacity: active ? 0.22 : 0.18,
          pointerEvents: "none",
          transform: "rotate(-10deg)",
          transformOrigin: "center",
          transition: "opacity 220ms ease, transform 260ms ease",
          "& svg": {
            fontSize: { xs: 96, md: 112 },
            display: "block",
          },
        }}
      >
        {item.icon}
      </Box>
      <Box
        className="mega-ico"
        aria-hidden
        sx={{
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          color: "primary.main",
          background:
            "linear-gradient(135deg, rgba(128,0,32,0.10), rgba(197,139,44,0.16))",
          border: "1px solid rgba(128,0,32,0.12)",
          transition: "transform 220ms ease",
          "& svg": { fontSize: 22 },
        }}
      >
        {item.icon}
      </Box>
      <Box sx={{ position: "relative", zIndex: 1, minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>
            {item.label}
          </Typography>
          <ArrowForwardRoundedIcon
            className="mega-go"
            sx={{
              fontSize: 15,
              color: "primary.main",
              opacity: 0,
              transform: "translateX(-4px)",
              transition: "opacity 180ms ease, transform 180ms ease",
            }}
          />
        </Box>
        <Typography
          variant="body2"
          sx={{ mt: 0.25, color: "text.secondary", fontSize: 12.5, lineHeight: 1.45 }}
        >
          {item.description}
        </Typography>
      </Box>
    </Box>
  );
}

export function MegaMenu({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  active,
  groups,
}: {
  active: string;
  groups: NavGroup[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => setOpen(null), 140);
  };

  // Close whenever the route changes.
  useEffect(() => {
    setOpen(null);
  }, [active]);
  useEffect(() => () => cancelClose(), []);

  // Close on outside click or Escape so a panel can never get stuck — and so
  // click-to-open works reliably on touch and trackpads where hover is flaky.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-mega-group]")) {
        setOpen(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {groups.map((group) => {
        const isOpen = open === group.label;
        const hasActive = group.items.some((i) => i.href === active);
        return (
          <Box
            key={group.label}
            data-mega-group=""
            onMouseEnter={() => {
              cancelClose();
              setOpen(group.label);
            }}
            onMouseLeave={scheduleClose}
            sx={{ position: "relative" }}
          >
            <Box
              component="button"
              type="button"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() =>
                setOpen((current) =>
                  current === group.label ? null : group.label,
                )
              }
              sx={{
                appearance: "none",
                cursor: "pointer",
                font: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                minHeight: 40,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                fontWeight: 700,
                whiteSpace: "nowrap",
                color: isOpen || hasActive ? "primary.main" : "text.primary",
                bgcolor:
                  isOpen || hasActive ? "rgba(128,0,32,0.08)" : "transparent",
                border: "1px solid",
                borderColor:
                  isOpen || hasActive ? "rgba(128,0,32,0.14)" : "transparent",
                transition:
                  "color 180ms ease, background-color 180ms ease, border-color 180ms ease",
                "&:hover": {
                  color: "primary.main",
                  bgcolor: "rgba(128,0,32,0.06)",
                },
              }}
            >
              {group.label}
              <ExpandMoreRoundedIcon
                aria-hidden
                sx={{
                  fontSize: 18,
                  transition: "transform 200ms ease",
                  transform: isOpen ? "rotate(180deg)" : "none",
                }}
              />
            </Box>

            <Box
              role="menu"
              sx={{
                position: "absolute",
                top: "100%",
                left: 0,
                pt: 1.25,
                zIndex: (t) => t.zIndex.appBar + 2,
                opacity: isOpen ? 1 : 0,
                visibility: isOpen ? "visible" : "hidden",
                transform: isOpen ? "translateY(0)" : "translateY(-8px)",
                transition:
                  "opacity 190ms ease, transform 190ms ease, visibility 190ms",
                pointerEvents: isOpen ? "auto" : "none",
              }}
            >
              <Box
                sx={{
                  width: 392,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(var(--surface-rgb), 0.98)",
                  backdropFilter: "saturate(180%) blur(14px)",
                  border: "1px solid",
                  borderColor: "divider",
                  boxShadow: "0 30px 70px -38px rgba(21,17,26,0.6)",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    px: 1.5,
                    pt: 0.5,
                    pb: 1,
                    color: "text.secondary",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {group.blurb}
                </Typography>
                <Stack spacing={0.5}>
                  {group.items.map((item, i) => (
                    <MegaItem
                      key={item.href}
                      item={item}
                      index={i}
                      active={item.href === active}
                    />
                  ))}
                </Stack>
              </Box>
            </Box>
          </Box>
        );
      })}
    </>
  );
}
