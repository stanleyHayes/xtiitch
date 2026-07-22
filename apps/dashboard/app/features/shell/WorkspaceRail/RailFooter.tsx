import { Form } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import BoltRounded from "@mui/icons-material/BoltRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../../theme";
import { ACTIVATION_PATH, storefrontGate } from "../../../lib/activation";
import type { Profile } from "../../shared/types";
import { billingPlansLabel } from "../../billing/billing-helpers";

// eslint-disable-next-line max-lines-per-function -- footer owns compact and expanded variants for the same account actions
export function RailFooter({
  profile,
  storefrontURL,
  compact,
  verified,
  pendingActivation,
}: Readonly<{
  profile: Profile;
  storefrontURL: string;
  compact: boolean;
  verified: boolean;
  pendingActivation: boolean;
}>) {
  // The public storefront isn't live until the business is verified AND its plan
  // is activated, so the "View storefront" control is disabled with a tooltip
  // pointing at the blocking step rather than opening a not-yet-live page.
  const gate = storefrontGate(verified, !pendingActivation);
  const billingLabel = billingPlansLabel(profile.plan);
  const billingIcon =
    billingLabel === "View billing plans" ? (
      <PaymentsRounded />
    ) : (
      <TrendingUpRounded />
    );
  return (
    <Box sx={{ mt: "auto" }}>
      {gate.locked ? (
        <Tooltip title={gate.hint} placement={compact ? "right" : "top"}>
          <Box component="span" sx={{ display: "block", width: "100%" }}>
            {compact ? (
              <IconButton
                disabled
                aria-label="View storefront"
                sx={{
                  width: "100%",
                  height: 48,
                  border: "1px solid",
                  borderColor: alpha(tokens.white, 0.1),
                  bgcolor: alpha(tokens.burgundy, 0.3),
                  borderRadius: 1.5,
                  "&.Mui-disabled": { color: alpha(tokens.white, 0.4) },
                }}
              >
                <VisibilityRounded />
              </IconButton>
            ) : (
              <Button
                disabled
                variant="contained"
                startIcon={<VisibilityRounded />}
                fullWidth
                sx={{
                  bgcolor: alpha(tokens.burgundy, 0.3),
                  "&.Mui-disabled": { color: alpha(tokens.white, 0.5) },
                }}
              >
                View storefront
              </Button>
            )}
          </Box>
        </Tooltip>
      ) : compact ? (
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
      {pendingActivation ? (
        compact ? (
          <Tooltip title="Activate plan" placement="right">
            <IconButton
              component={RouterLink}
              to={ACTIVATION_PATH}
              aria-label="Activate plan"
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
              <BoltRounded />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            component={RouterLink}
            to={ACTIVATION_PATH}
            startIcon={<BoltRounded />}
            fullWidth
            sx={{
              mt: 1,
              color: tokens.charcoal,
              fontWeight: 800,
              bgcolor: tokens.gold,
              "&:hover": { bgcolor: alpha(tokens.gold, 0.85) },
            }}
          >
            Activate plan
          </Button>
        )
      ) : null}
      {!pendingActivation ? (
        compact ? (
          <Tooltip title={billingLabel} placement="right">
            <IconButton
              component={RouterLink}
              to="/onboarding/billing"
              aria-label={billingLabel}
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
              {billingIcon}
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            component={RouterLink}
            to="/onboarding/billing"
            startIcon={billingIcon}
            fullWidth
            sx={{
              mt: 1,
              color: tokens.charcoal,
              fontWeight: 800,
              bgcolor: tokens.gold,
              "&:hover": { bgcolor: alpha(tokens.gold, 0.85) },
            }}
          >
            {billingLabel}
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
