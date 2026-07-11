import { useState } from "react";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { tokens } from "../../theme";
import {
  ACTIVATION_PATH,
  activationPlanLabel,
  type ActivationStatus,
} from "../../lib/activation";

// Persistent activation banner. It renders on every page for a paid plan that is
// still pending, and is deliberately NOT permanently dismissible: the "hide"
// control only collapses it to a slim strip for the current view (component
// state), so it always returns on reload/navigation. Free / active owners
// (`activated === true`) see nothing.
export function ActivationBanner({
  activation,
}: {
  activation: ActivationStatus;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (activation.activated) {
    return null;
  }
  const planLabel = activationPlanLabel(activation);

  if (collapsed) {
    return (
      <Box
        sx={{
          mb: 2,
          px: { xs: 1.5, md: 2 },
          py: 1,
          borderRadius: 2,
          border: "1px solid",
          borderColor: alpha(tokens.gold, 0.5),
          bgcolor: alpha(tokens.gold, 0.1),
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 700 }}>
          Your {planLabel} plan isn&apos;t active yet.
        </Typography>
        <Button
          component={RouterLink}
          to={ACTIVATION_PATH}
          variant="text"
          size="small"
        >
          Activate now
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mb: 2.5,
        p: { xs: 1.75, md: 2.25 },
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(tokens.gold, 0.5),
        bgcolor: alpha(tokens.gold, 0.1),
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Typography sx={{ fontWeight: 800 }}>
          Activate your {planLabel} plan to start using Xtiitch
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Complete your first payment to unlock designs, storefront settings, and
          payouts. Your other pages stay available.
        </Typography>
      </Box>
      <Button
        component={RouterLink}
        to={ACTIVATION_PATH}
        variant="contained"
        size="small"
      >
        Activate now
      </Button>
      <IconButton
        aria-label="Hide for now"
        size="small"
        onClick={() => setCollapsed(true)}
        sx={{ color: "text.secondary" }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}
