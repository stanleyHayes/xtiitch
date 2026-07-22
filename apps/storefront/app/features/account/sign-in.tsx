import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import type { ActionResult, OtpChannel, Step } from "./types";
import { SignInFlow } from "./sign-in-flow";
import { SignInHero } from "./sign-in-hero";

export function SignIn({
  redirectTo,
  action,
  step,
  channel,
  phoneEnabled,
  pendingIntent,
}: {
  redirectTo: string;
  action?: ActionResult;
  step: Step;
  channel: OtpChannel;
  phoneEnabled: boolean;
  pendingIntent: string | null;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {/* Ambient brand glow — theme-safe (reads on both cream and ink). */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 12% 8%, ${alpha(tokens.burgundy, 0.18)}, transparent 46%), radial-gradient(circle at 92% 0%, ${alpha(tokens.gold, 0.12)}, transparent 42%)`,
        }}
      />
      {/* Grid texture, faded out toward the edges. */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${alpha(tokens.burgundy, 0.05)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(tokens.burgundy, 0.05)} 1px, transparent 1px)`,
          backgroundSize: "38px 38px",
          maskImage:
            "radial-gradient(circle at 28% 45%, #000, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(circle at 28% 45%, #000, transparent 78%)",
        }}
      />
      <Container
        maxWidth="xl"
        sx={{
          position: "relative",
          minHeight: "100vh",
          py: { xs: 3, md: 6 },
          display: "grid",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3.5, lg: 6 },
            gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" },
            alignItems: "center",
          }}
        >
          <SignInHero />
          <SignInFlow
            redirectTo={redirectTo}
            action={action}
            step={step}
            channel={channel}
            phoneEnabled={phoneEnabled}
            pendingIntent={pendingIntent}
          />
        </Box>
      </Container>
    </Box>
  );
}
