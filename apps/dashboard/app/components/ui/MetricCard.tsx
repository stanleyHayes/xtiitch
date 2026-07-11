import { Link as RouterLink } from "react-router";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { Panel } from "./Panel";

type MetricCardContentProps = {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: string;
};

function MetricCardContent({
  icon,
  label,
  value,
  helper,
  tone = tokens.burgundy,
}: MetricCardContentProps) {
  return (
    <Panel
      sx={{
        p: 2.25,
        minHeight: 142,
        position: "relative",
        overflow: "hidden",
        backgroundImage: `linear-gradient(135deg, ${alpha(tone, 0.12)}, transparent 46%), linear-gradient(180deg, rgba(var(--surface-rgb), 0.9), rgba(var(--surface-rgb), 0.58))`,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "0 auto auto 0",
          width: "100%",
          height: 3,
          bgcolor: tone,
        },
        "&::after": {
          content: '""',
          position: "absolute",
          right: -34,
          bottom: -42,
          width: 110,
          height: 110,
          borderRadius: "50%",
          border: `1px solid ${alpha(tone, 0.18)}`,
          bgcolor: alpha(tone, 0.035),
        },
        "&:hover": {
          borderColor: alpha(tone, 0.25),
          transform: "translateY(-2px)",
          boxShadow: `0 22px 64px ${alpha(tokens.ink, 0.09)}`,
        },
        cursor: "default",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
    >
      <Stack
        spacing={2}
        sx={{
          height: "100%",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            minWidth: 0,
          }}
        >
          <Typography
            variant="body2"
            title={label}
            noWrap
            sx={{
              color: "text.secondary",
              fontWeight: 800,
              minWidth: 0,
            }}
          >
            {label}
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(tone, 0.1),
              color: tone,
              border: "1px solid",
              borderColor: alpha(tone, 0.16),
              boxShadow: `0 12px 28px ${alpha(tone, 0.08)}`,
              flex: "0 0 auto",
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Box sx={{ minWidth: 0 }}>
          {/* Large figures truncate with an ellipsis (full value on hover via
              title) and shrink the type, so the card never breaks its layout. */}
          <Typography
            variant="h4"
            noWrap
            title={value}
            sx={{
              lineHeight: 1.05,
              maxWidth: "100%",
              letterSpacing: 0,
              fontSize:
                value.length > 15
                  ? "1.1rem"
                  : value.length > 9
                    ? "1.4rem"
                    : undefined,
            }}
          >
            {value}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.75,
              color: "text.secondary",
              overflowWrap: "anywhere",
            }}
          >
            {helper}
          </Typography>
        </Box>
      </Stack>
    </Panel>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = tokens.burgundy,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: string;
  href?: string;
}) {
  const card = (
    <MetricCardContent
      icon={icon}
      label={label}
      value={value}
      helper={helper}
      tone={tone}
    />
  );
  if (!href) {
    return card;
  }
  return (
    <Box
      component={RouterLink}
      to={href}
      aria-label={`${label}: ${value}. Open details.`}
      sx={{
        display: "block",
        minWidth: 0,
        color: "inherit",
        textDecoration: "none",
        cursor: "pointer",
      }}
    >
      {card}
    </Box>
  );
}
