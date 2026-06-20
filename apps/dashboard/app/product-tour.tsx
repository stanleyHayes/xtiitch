import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { tokens } from "./theme";

// A lightweight, dependency-free guided tour: a dim backdrop with a spotlight
// "cutout" (a transparent box with a huge spread shadow) ringing the target
// element, plus a fixed instruction card. Targets are found by CSS selector so
// no refs need threading through the page.
export type TourStep = {
  selector?: string;
  title: string;
  body: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Xtiitch 👋",
    body: "This is your studio's command centre — orders, money, fittings and your storefront all in one place. Here's a 30-second tour of the essentials.",
  },
  {
    selector: "#dashboard-rail",
    title: "Your workspace",
    body: "Use the rail to move between Orders, Money, Visits, your Catalogue and more. Each area is its own page.",
  },
  {
    selector: '[data-tour="help"]',
    title: "Help on every page",
    body: "Stuck on a page? Tap the ? for a short guide that explains it — and press Listen to have it read aloud.",
  },
  {
    selector: '[data-tour="account"]',
    title: "Your account",
    body: "Open your profile to switch theme, manage your store and sign out. You can replay this tour from here anytime.",
  },
  {
    title: "You're all set 🎉",
    body: "That's the tour. Open Help any time for the full guide to every page.",
  },
];

function useTargetRect(selector: string | undefined, step: number): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    measure();
    // Re-measure after the scroll/layout settles.
    const settle = setTimeout(measure, 360);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector, step]);
  return rect;
}

export function ProductTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = TOUR_STEPS[step];
  const rect = useTargetRect(current?.selector, step);

  if (!open || !current) return null;

  const last = step === TOUR_STEPS.length - 1;
  const pad = 8;
  const spotlight = rect
    ? {
        top: Math.max(rect.top - pad, 4),
        left: Math.max(rect.left - pad, 4),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 2500 }} role="dialog" aria-label="Product tour">
      {spotlight ? (
        <Box
          aria-hidden
          sx={{
            position: "fixed",
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 2,
            border: `2px solid ${tokens.gold}`,
            boxShadow: `0 0 0 9999px ${alpha(tokens.ink, 0.66)}`,
            pointerEvents: "none",
            transition: "all 240ms ease",
          }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{ position: "fixed", inset: 0, bgcolor: alpha(tokens.ink, 0.66) }}
        />
      )}

      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 16, md: 28 },
          left: "50%",
          transform: "translateX(-50%)",
          width: 380,
          maxWidth: "92vw",
          p: 2.5,
          borderRadius: "16px",
          bgcolor: "rgba(var(--surface-rgb), 0.98)",
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.12),
          boxShadow: `0 28px 70px ${alpha(tokens.ink, 0.4)}`,
          zIndex: 2501,
        }}
      >
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, color: tokens.burgundy, letterSpacing: 0.4 }}
          >
            STEP {step + 1} OF {TOUR_STEPS.length}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close tour">
            <CloseRounded fontSize="small" />
          </IconButton>
        </Stack>

        <Typography variant="h6" component="p" sx={{ fontWeight: 800 }}>
          {current.title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75, color: "text.secondary", lineHeight: 1.6 }}>
          {current.body}
        </Typography>

        <Stack
          direction="row"
          sx={{ mt: 2, justifyContent: "space-between", alignItems: "center" }}
        >
          <Button size="small" variant="text" onClick={onClose} sx={{ color: "text.secondary" }}>
            {last ? "Close" : "Skip tour"}
          </Button>
          <Stack direction="row" spacing={1}>
            {step > 0 ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBackRounded />}
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
              >
                Back
              </Button>
            ) : null}
            <Button
              size="small"
              variant="contained"
              endIcon={last ? undefined : <ArrowForwardRounded />}
              onClick={() => {
                if (last) {
                  onClose();
                } else {
                  setStep((s) => Math.min(s + 1, TOUR_STEPS.length - 1));
                }
              }}
            >
              {last ? "Done" : "Next"}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
