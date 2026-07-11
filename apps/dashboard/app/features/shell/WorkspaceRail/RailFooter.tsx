import { Form } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../../theme";
import type { Profile } from "../../shared/types";

export function RailFooter({
  profile,
  storefrontURL,
  compact,
}: {
  profile: Profile;
  storefrontURL: string;
  compact: boolean;
}) {
  return (
    <Box sx={{ mt: "auto" }}>
      {compact ? (
        <Tooltip title="View storefront" placement="right">
          <IconButton
            component="a"
            href={storefrontURL}
            target="_blank"
            rel="noreferrer"
            aria-label="View storefront"
            sx={{
              width: "100%",
              height: 48,
              color: tokens.white,
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.16),
              bgcolor: alpha(tokens.burgundy, 0.72),
              borderRadius: 1.5,
              "&:hover": { bgcolor: alpha(tokens.burgundy, 0.82) },
            }}
          >
            <VisibilityRounded />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          component="a"
          href={storefrontURL}
          target="_blank"
          rel="noreferrer"
          variant="contained"
          startIcon={<VisibilityRounded />}
          fullWidth
          sx={{
            bgcolor: tokens.burgundy,
            color: tokens.white,
            "&:hover": { bgcolor: alpha(tokens.burgundy, 0.82) },
          }}
        >
          View storefront
        </Button>
      )}
      {profile.plan !== "growth" && profile.plan !== "studio" ? (
        compact ? (
          <Tooltip title="Upgrade plan" placement="right">
            <IconButton
              component={RouterLink}
              to="/onboarding/billing"
              aria-label="Upgrade plan"
              sx={{
                mt: 1,
                width: "100%",
                height: 48,
                color: tokens.charcoal,
                border: "1px solid",
                borderColor: alpha(tokens.gold, 0.6),
                bgcolor: tokens.gold,
                borderRadius: 1.5,
                "&:hover": { bgcolor: alpha(tokens.gold, 0.85) },
              }}
            >
              <TrendingUpRounded />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            component={RouterLink}
            to="/onboarding/billing"
            startIcon={<TrendingUpRounded />}
            fullWidth
            sx={{
              mt: 1,
              color: tokens.charcoal,
              fontWeight: 800,
              bgcolor: tokens.gold,
              "&:hover": { bgcolor: alpha(tokens.gold, 0.85) },
            }}
          >
            Upgrade plan
          </Button>
        )
      ) : null}
      <Form method="post">
        <input type="hidden" name="intent" value="logout" />
        {compact ? (
          <Tooltip title="Log out" placement="right">
            <IconButton
              type="submit"
              aria-label="Log out"
              sx={{
                mt: 1,
                width: "100%",
                height: 48,
                color: tokens.white,
                border: "1px solid",
                borderColor: alpha(tokens.white, 0.16),
                bgcolor: "rgba(var(--surface-rgb), 0.06)",
                borderRadius: 1.5,
                "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
              }}
            >
              <LogoutRounded />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            type="submit"
            color="inherit"
            startIcon={<LogoutRounded />}
            fullWidth
            sx={{
              mt: 1,
              color: tokens.white,
              border: "1px solid",
              borderColor: alpha(tokens.white, 0.16),
              bgcolor: "rgba(var(--surface-rgb), 0.06)",
              "&:hover": { bgcolor: "rgba(var(--surface-rgb), 0.12)" },
            }}
          >
            Log out
          </Button>
        )}
      </Form>
    </Box>
  );
}
