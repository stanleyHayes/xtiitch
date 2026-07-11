import { Link as RouterLink } from "react-router";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import { tokens } from "../../theme";

export function PlanGatedControl({
  locked,
  title,
  description,
  children,
}: {
  locked: boolean;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        height: "100%",
        minWidth: 0,
        p: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: (theme) =>
          locked
            ? theme.palette.divider
            : alpha(theme.palette.primary.main, 0.2),
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(tokens.white, locked ? 0.032 : 0.05)
            : "rgba(var(--surface-rgb), 0.66)",
        backgroundImage: (theme) =>
          locked
            ? "none"
            : `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.12 : 0.05,
              )}, transparent 58%)`,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.9 }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{title}</Typography>
        {locked ? (
          <Chip
            size="small"
            component={RouterLink}
            to="/onboarding/billing"
            clickable
            icon={<LockRounded sx={{ fontSize: 14 }} />}
            label="Upgrade"
            sx={{
              height: 22,
              flexShrink: 0,
              cursor: "pointer",
              "& .MuiChip-label": { px: 0.75, fontSize: 11 },
            }}
          />
        ) : null}
      </Stack>
      {locked ? (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: "block",
            lineHeight: 1.65,
          }}
        >
          {description} Upgrade required.
        </Typography>
      ) : (
        <>
          {children}
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
          >
            {description}
          </Typography>
        </>
      )}
    </Box>
  );
}