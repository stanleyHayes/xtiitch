import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function MiniStat({
  icon,
  label,
  value,
  helper,
  tone = tokens.burgundy,
  action,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper?: string;
  tone?: string;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: alpha(tone, 0.18),
        borderRadius: 2,
        bgcolor: "rgba(var(--surface-rgb), 0.78)",
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.075)}, transparent 48%)`,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&::after": {
          content: '""',
          position: "absolute",
          right: -26,
          bottom: -32,
          width: 78,
          height: 78,
          borderRadius: "50%",
          bgcolor: alpha(tone, 0.05),
          border: `1px solid ${alpha(tone, 0.12)}`,
        },
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: alpha(tone, 0.3),
          boxShadow: `0 18px 42px ${alpha(tokens.ink, 0.065)}`,
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          minWidth: 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            color: tone,
            display: "grid",
            width: 28,
            height: 28,
            borderRadius: 1,
            placeItems: "center",
            bgcolor: alpha(tone, 0.1),
            flex: "0 0 auto",
          }}
        >
          {icon}
        </Box>
        <Typography
          variant="caption"
          noWrap
          title={label}
          sx={{ color: "text.secondary", fontWeight: 900, minWidth: 0 }}
        >
          {label}
        </Typography>
      </Stack>
      <Typography
        noWrap
        title={value}
        sx={{
          mt: 0.75,
          fontWeight: 900,
          maxWidth: "100%",
          letterSpacing: 0,
          fontSize:
            value.length > 15
              ? "0.82rem"
              : value.length > 10
                ? "0.95rem"
                : undefined,
          position: "relative",
          zIndex: 1,
        }}
      >
        {value}
      </Typography>
      {helper ? (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            overflowWrap: "anywhere",
            position: "relative",
            zIndex: 1,
          }}
        >
          {helper}
        </Typography>
      ) : null}
      {action ? (
        <Box
          sx={{
            mt: 1.25,
            maxWidth: "100%",
            minWidth: 0,
            position: "relative",
            zIndex: 1,
            "& .MuiButton-root": { maxWidth: "100%" },
          }}
        >
          {action}
        </Box>
      ) : null}
    </Box>
  );
}