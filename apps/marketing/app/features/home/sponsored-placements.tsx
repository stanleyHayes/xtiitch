import { useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Section, SectionHeading } from "../../components/ui";
import { type SponsoredPlacement } from "../../lib/sponsored";

const homeRiseSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const sponsoredFallbackImages = [
  "/images/atelier-review.webp",
  "/images/payment-handoff.webp",
  "/images/tracking-fitting.webp",
] as const;

function getSponsoredVisitorID(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const key = "xtiitch-sponsored-visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const next =
    window.crypto?.randomUUID?.() ??
    `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
}

function sendSponsoredEvent(
  campaignId: string,
  eventType: "impression" | "click",
) {
  if (typeof window === "undefined") {
    return;
  }
  const body = JSON.stringify({
    intent: "sponsored_event",
    campaignId,
    eventType,
    visitorId: getSponsoredVisitorID(),
    pageUrl: window.location.href,
    referrerUrl: document.referrer,
  });
  const url = "/?index";
  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) {
      return;
    }
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function SponsoredPlacements({ // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
  placements,
}: {
  placements: SponsoredPlacement[];
}) {
  useEffect(() => {
    if (placements.length === 0 || typeof window === "undefined") {
      return;
    }
    placements.forEach((placement) => {
      const key = `xtiitch-sponsored-impression:${placement.campaignId}`;
      if (window.sessionStorage.getItem(key)) {
        return;
      }
      window.sessionStorage.setItem(key, "1");
      sendSponsoredEvent(placement.campaignId, "impression");
    });
  }, [placements]);

  if (placements.length === 0) {
    return null;
  }

  return (
    <Section alt>
      <SectionHeading
        align="left"
        eyebrow="Featured on Xtiitch"
        title="Discover live fashion businesses"
        subtitle="Sponsored placements from verified businesses running their storefronts on Xtiitch."
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: placements.length > 1 ? "repeat(2, minmax(0, 1fr))" : "1fr",
          },
          gap: { xs: 2, md: 2.5 },
        }}
      >
        {placements.map((placement, index) => (
          <Box
            key={placement.campaignId}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "0.9fr 1.1fr" },
              minHeight: { xs: 420, sm: 300 },
              overflow: "hidden",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              boxShadow: "0 28px 78px -58px rgba(21,17,26,0.68)",
              ...homeRiseSx(80 + index * 80),
            }}
          >
            <Box
              sx={{
                position: "relative",
                minHeight: { xs: 220, sm: "100%" },
                overflow: "hidden",
                bgcolor: "secondary.main",
              }}
            >
              <Box
                component="img"
                src={
                  placement.imageUrl ||
                  sponsoredFallbackImages[
                    index % sponsoredFallbackImages.length
                  ]
                }
                alt=""
                loading="lazy"
                decoding="async"
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "transform 700ms ease",
                  ".MuiBox-root:hover > &": {
                    transform: "scale(1.035)",
                  },
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(21,17,26,0.02), rgba(21,17,26,0.54))",
                }}
              />
              <Chip
                label="Sponsored"
                size="small"
                sx={{
                  position: "absolute",
                  left: 16,
                  top: 16,
                  borderRadius: 1,
                  bgcolor: "rgba(var(--surface-rgb), 0.92)",
                  color: "primary.main",
                  fontWeight: 800,
                }}
              />
            </Box>
            <Box
              sx={{
                p: { xs: 2.5, md: 3 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 2.5,
              }}
            >
              <Box>
                <Typography
                  component="p"
                  sx={{
                    color: "text.secondary",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0,
                  }}
                >
                  {placement.businessName}
                </Typography>
                <Typography variant="h3" component="h2" sx={{ mt: 1 }}>
                  {placement.headline || placement.targetLabel}
                </Typography>
                <Typography sx={{ mt: 1.5, color: "text.secondary" }}>
                  {placement.description ||
                    "Browse the storefront and see what the business is making now."}
                </Typography>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ alignItems: { xs: "stretch", sm: "center" } }}
              >
                <Button
                  component="a"
                  href={placement.href}
                  target="_blank"
                  rel="noreferrer sponsored"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() =>
                    sendSponsoredEvent(placement.campaignId, "click")
                  }
                  sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  Visit storefront
                </Button>
                <Chip
                  label={
                    placement.placementType === "promoted_design"
                      ? "Promoted design"
                      : "Featured business"
                  }
                  sx={{ borderRadius: 1, fontWeight: 800 }}
                  variant="outlined"
                />
              </Stack>
            </Box>
          </Box>
        ))}
      </Box>
    </Section>
  );
}
