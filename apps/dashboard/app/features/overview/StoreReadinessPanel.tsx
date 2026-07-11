import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiLink from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import { tokens } from "../../theme";
import { SetupStep } from "../shared/types";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";

export function StoreReadinessPanel({
  steps,
  storefrontURL,
}: {
  steps: SetupStep[];
  storefrontURL: string;
}) {
  const completed = steps.filter((step) => step.done).length;
  const progress = steps.length === 0 ? 0 : (completed / steps.length) * 100;

  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        backgroundImage: `linear-gradient(135deg, ${alpha(tokens.info, 0.075)}, transparent 48%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.94), rgba(var(--surface-rgb), 0.74))`,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          alignItems: { xs: "stretch", sm: "flex-start" },
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <VerifiedUserRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Store readiness</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              The essentials that make the storefront workable for customers and
              staff.
            </Typography>
          </Box>
        </Stack>
        <ToneChip
          label={`${completed}/${steps.length} ready`}
          tone={completed === steps.length ? tokens.success : tokens.warning}
        />
      </Stack>

      <Box
        aria-hidden
        sx={{
          mt: 2,
          height: 9,
          borderRadius: 999,
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha(tokens.white, 0.14)
              : alpha(tokens.ink, 0.08),
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 999,
            bgcolor: completed === steps.length ? tokens.success : tokens.gold,
            transition: "width 180ms ease",
          }}
        />
      </Box>

      <Stack spacing={1} sx={{ mt: 1.75 }}>
        {steps.map((step) => (
          <MuiLink
            key={step.label}
            component={RouterLink}
            to={step.href}
            underline="none"
            sx={{
              p: 1.25,
              display: "grid",
              gap: 1,
              gridTemplateColumns: "32px minmax(0, 1fr) auto",
              alignItems: "center",
              border: "1px solid",
              borderColor: step.done
                ? alpha(tokens.success, 0.22)
                : alpha(tokens.warning, 0.22),
              borderRadius: 2,
              color: "text.primary",
              bgcolor: step.done
                ? alpha(tokens.success, 0.045)
                : "rgba(var(--surface-rgb), 0.72)",
              "&:hover": {
                bgcolor: step.done
                  ? alpha(tokens.success, 0.075)
                  : alpha(tokens.warning, 0.075),
              },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: "grid",
                placeItems: "center",
                color: step.done ? tokens.success : tokens.warning,
                bgcolor: step.done
                  ? alpha(tokens.success, 0.1)
                  : alpha(tokens.warning, 0.12),
              }}
            >
              {step.done ? <CheckCircleRounded /> : step.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900 }} noWrap>
                {step.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {step.helper}
              </Typography>
            </Box>
            <ArrowForwardRounded fontSize="small" />
          </MuiLink>
        ))}
      </Stack>

      <Button
        href={storefrontURL}
        target="_blank"
        rel="noreferrer"
        fullWidth
        variant="outlined"
        startIcon={<StorefrontRounded />}
        sx={{ mt: 1.5 }}
      >
        Open storefront
      </Button>
    </Panel>
  );
}