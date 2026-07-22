import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { tokens } from "../../theme";
import { Panel } from "./Panel";

export function AdminRecordPage({
  eyebrow,
  title,
  helper,
  status,
  statusColor = tokens.info,
  onBack,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
  status?: string;
  statusColor?: string;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack spacing={2.5}>
      <Button
        variant="text"
        startIcon={<ArrowBackRounded />}
        onClick={onBack}
        sx={{ alignSelf: "flex-start", px: 0.5 }}
      >
        Back to list
      </Button>
      <Panel
        sx={{
          overflow: "hidden",
          borderColor: alpha(statusColor, 0.24),
          backgroundImage: `radial-gradient(circle at 100% 0%, ${alpha(statusColor, 0.13)}, transparent 34%)`,
        }}
      >
        <Box sx={{ p: { xs: 2.25, md: 3.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ justifyContent: "space-between", alignItems: { md: "flex-start" } }}
          >
            <Box sx={{ maxWidth: 860, minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: statusColor, fontWeight: 900, letterSpacing: "0.08em" }}
              >
                {eyebrow}
              </Typography>
              <Stack direction="row" spacing={1.25} sx={{ mt: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 30, md: 42 } }}>
                  {title}
                </Typography>
                {status ? (
                  <Chip
                    label={status}
                    sx={{ bgcolor: alpha(statusColor, 0.12), color: statusColor, textTransform: "capitalize" }}
                  />
                ) : null}
              </Stack>
              {helper ? (
                <Typography sx={{ mt: 1.25, color: "text.secondary", fontSize: { md: 17 } }}>
                  {helper}
                </Typography>
              ) : null}
            </Box>
            {actions ? (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", "& .MuiButton-root": { whiteSpace: "nowrap" } }}>
                {actions}
              </Stack>
            ) : null}
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ p: { xs: 2.25, md: 3.5 } }}>{children}</Box>
      </Panel>
    </Stack>
  );
}
