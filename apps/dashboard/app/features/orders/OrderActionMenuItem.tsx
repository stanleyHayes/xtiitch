import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

export function OrderActionMenuItem({
  icon,
  label,
  helper,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <MenuItem
      onClick={onClick}
      sx={{
        px: 2,
        py: 1.1,
        gap: 1.25,
        alignItems: "center",
        "&:hover": {
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          flexShrink: 0,
          borderRadius: 1.25,
          display: "grid",
          placeItems: "center",
          color: "primary.main",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}
          noWrap
        >
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
          {helper}
        </Typography>
      </Box>
    </MenuItem>
  );
}