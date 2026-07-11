import { useEffect } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";

export function BillingSetupBanner({
  plan,
  handle,
}: {
  plan: string;
  handle: string;
}) {
  const paid = Boolean(plan) && plan !== "free";
  const storageKey = `xtiitch:billing-setup-dismissed:${handle}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (!paid) return;
    try {
      setHidden(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setHidden(false);
    }
  }, [paid, storageKey]);
  if (!paid || hidden) return null;
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
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
          Activate your {planLabel} plan
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Authorize recurring billing with Paystack to unlock your plan&apos;s
          features. You can cancel anytime.
        </Typography>
      </Box>
      <Button
        href={`/onboarding/billing?plan=${encodeURIComponent(plan)}`}
        variant="contained"
        size="small"
      >
        Set up billing
      </Button>
      <Button
        variant="text"
        size="small"
        onClick={() => {
          try {
            window.localStorage.setItem(storageKey, "1");
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
        sx={{ color: "text.secondary" }}
      >
        Later
      </Button>
    </Box>
  );
}