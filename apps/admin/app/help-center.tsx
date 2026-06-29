import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import VolumeUpRounded from "@mui/icons-material/VolumeUpRounded";
import StopCircleRounded from "@mui/icons-material/StopCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { tokens } from "./theme";
import { HELP_GUIDES, spokenGuide, type HelpGuide } from "./lib/help-content";

// Reads text aloud with the browser's built-in speech synthesis — no audio files
// or network. Renders nothing until hydrated (and only where supported), so SSR
// stays clean. Cancels on unmount and toggles play/stop.
export function SpeakButton({
  text,
  label = "Listen",
  size = "small",
}: {
  text: string;
  label?: string;
  size?: "small" | "medium" | "large";
}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    return () => {
      if (ok) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <Button
      onClick={toggle}
      size={size}
      variant={speaking ? "contained" : "outlined"}
      startIcon={speaking ? <StopCircleRounded /> : <VolumeUpRounded />}
      aria-label={speaking ? "Stop reading" : "Read this guide aloud"}
    >
      {speaking ? "Stop" : label}
    </Button>
  );
}

export function HelpGuideCard({
  guide,
  elevated = false,
}: {
  guide: HelpGuide;
  elevated?: boolean;
}) {
  return (
    <Box
      sx={{
        p: { xs: 2.25, md: 3 },
        borderRadius: "14px",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        bgcolor: elevated
          ? "rgba(var(--surface-rgb), 0.96)"
          : "rgba(var(--surface-rgb), 0.6)",
      }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1.5,
        }}
      >
        <Box>
          <Typography variant="h6" component="h3">
            {guide.title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: tokens.burgundy,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {guide.helper}
          </Typography>
        </Box>
        <SpeakButton text={spokenGuide(guide)} />
      </Stack>
      <Typography sx={{ mt: 1.5, color: "text.secondary", lineHeight: 1.65 }}>
        {guide.summary}
      </Typography>
      <Box
        component="ol"
        sx={{ mt: 1.5, mb: 0, pl: 2.5, color: "text.primary" }}
      >
        {guide.steps.map((step, index) => (
          <Box
            component="li"
            key={index}
            sx={{
              mb: 0.75,
              lineHeight: 1.55,
              "&::marker": { color: tokens.burgundy, fontWeight: 800 },
            }}
          >
            {step}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// Per-section help: a right-hand drawer showing the guide for the current admin
// section, opened from the "?" button next to the page title.
export function HelpDrawer({
  open,
  onClose,
  section,
}: {
  open: boolean;
  onClose: () => void;
  section: string;
}) {
  const guide =
    HELP_GUIDES.find((candidate) => candidate.section === section) ??
    HELP_GUIDES[0];

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: "92vw", sm: 400 },
          maxWidth: "100vw",
          p: { xs: 2, md: 2.5 },
        }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
        >
          <Typography sx={{ fontWeight: 900, letterSpacing: 0.3 }}>
            Section guide
          </Typography>
          <IconButton onClick={onClose} aria-label="Close guide" size="small">
            <CloseRounded />
          </IconButton>
        </Stack>

        {guide ? <HelpGuideCard guide={guide} elevated /> : null}

        <Button
          component={RouterLink}
          to="/help"
          variant="text"
          endIcon={<ArrowForwardRounded />}
          onClick={onClose}
          sx={{ mt: 2 }}
        >
          Open the full guide
        </Button>
      </Box>
    </Drawer>
  );
}
