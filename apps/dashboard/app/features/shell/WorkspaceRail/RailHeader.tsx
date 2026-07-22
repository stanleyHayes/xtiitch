import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { tokens } from "../../../theme";
import type { Profile } from "../../shared/types";

export function RailHeader({
  profile,
  compact,
  inDrawer,
  onCloseMobile,
}: {
  profile: Profile;
  compact: boolean;
  inDrawer: boolean;
  onCloseMobile: () => void;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "visible",
        p: compact ? 0.5 : 0.65,
        border: 0,
        borderRadius: 1.5,
        color: tokens.white,
        backgroundColor: "transparent",
      }}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{
          alignItems: "center",
          justifyContent: compact ? "center" : "space-between",
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <Box
            sx={{
              position: "relative",
              width: compact ? 44 : 48,
              height: compact ? 44 : 48,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              color: tokens.white,
              backgroundImage: `linear-gradient(155deg, ${tokens.burgundy} 0%, ${tokens.charcoal} 100%)`,
              border: `1px solid ${alpha(tokens.gold, 0.5)}`,
              boxShadow: `0 10px 24px ${alpha(tokens.burgundy, 0.4)}, inset 0 1px 0 ${alpha(tokens.white, 0.22)}`,
            }}
          >
            <Typography
              component="span"
              sx={{
                fontFamily: '"Fraunces", serif',
                fontWeight: 900,
                fontSize: 23,
                lineHeight: 1,
              }}
            >
              {(profile.name?.trim()?.charAt(0) ?? "X").toUpperCase()}
            </Typography>
          </Box>
          {!compact ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: 20,
                  fontWeight: 850,
                  lineHeight: 1.15,
                  color: tokens.white,
                }}
                noWrap
              >
                {profile.name}
              </Typography>
              <Typography
                component="span"
                sx={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: tokens.gold,
                }}
              >
                {profile.plan
                  ? `${profile.plan.charAt(0).toUpperCase()}${profile.plan.slice(1)} plan`
                  : "Business"}
              </Typography>
            </Box>
          ) : null}
        </Stack>
        {inDrawer ? (
          <IconButton
            aria-label="Close navigation"
            onClick={onCloseMobile}
            sx={{
              color: tokens.white,
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.14),
              bgcolor: "rgba(var(--surface-rgb), 0.06)",
              flexShrink: 0,
            }}
          >
            <CloseRounded />
          </IconButton>
        ) : null}
      </Stack>
    </Box>
  );
}
