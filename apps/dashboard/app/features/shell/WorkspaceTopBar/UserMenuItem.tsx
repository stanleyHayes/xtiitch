import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

export function UserMenuItem({
  icon,
  label,
  helper,
  color = "primary",
  ...props
}: {
  icon: React.ReactNode;
  label: string;
  helper?: string;
  color?: "primary" | "error";
} & React.ComponentProps<typeof MenuItem>) {
  return (
    <MenuItem
      {...props}
      sx={{
        px: 2,
        py: 1.1,
        gap: 1.25,
        textDecoration: "none",
        color: color === "error" ? "error.main" : "inherit",
        "&:hover": {
          bgcolor: (theme) =>
            alpha(
              color === "error"
                ? theme.palette.error.main
                : theme.palette.primary.main,
              color === "error" ? 0.1 : 0.08,
            ),
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
          color: color === "error" ? "error.main" : "primary.main",
          bgcolor: (theme) =>
            alpha(
              color === "error"
                ? theme.palette.error.main
                : theme.palette.primary.main,
              color === "error" ? 0.12 : 0.1,
            ),
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
        {helper ? (
          <Typography
            variant="caption"
            sx={{ color: "text.secondary" }}
            noWrap
          >
            {helper}
          </Typography>
        ) : null}
      </Box>
    </MenuItem>
  );
}
