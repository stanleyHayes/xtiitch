import type { Theme } from "@mui/material/styles";

export const perspectiveGridSx = ({
  lightOnDark = false,
  opacity = 1,
}: {
  lightOnDark?: boolean;
  opacity?: number;
} = {}) => ({
  content: '""',
  position: "absolute" as const,
  // Kept much tighter on phones. The transform below scales and rotates this
  // box, so the layer the compositor allocates is far larger than the inset
  // suggests — at the old mobile inset it measured 2894x1238 CSS pixels
  // against a 390x844 screen, roughly seven times the viewport, and at a
  // phone's 3x pixel density that is a nine-figure byte count for ONE layer.
  // This texture appears on every page (hero, every Section, the footer), so
  // the cost was paid several times over per page.
  inset: { xs: "-8% -18% -18%", md: "-42% -18% -58%" },
  zIndex: 0,
  pointerEvents: "none" as const,
  opacity,
  backgroundImage: (theme: Theme) => {
    const line = lightOnDark
      ? "rgba(255,255,255,0.045)"
      : theme.palette.mode === "dark"
        ? "rgba(255,247,242,0.042)"
        : "rgba(128,0,32,0.038)";
    const horizon = lightOnDark
      ? "rgba(128,0,32,0.12)"
      : theme.palette.mode === "dark"
        ? "rgba(217,138,164,0.055)"
        : "rgba(128,0,32,0.045)";
    return [
      `linear-gradient(${line} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      `radial-gradient(ellipse at 50% 18%, ${horizon}, transparent 48%)`,
    ].join(", ");
  },
  backgroundSize: "56px 56px, 56px 56px, 100% 100%",
  transform:
    "perspective(780px) rotateX(65deg) translate3d(0, 8%, 0) scale(1.34)",
  transformOrigin: "50% 24%",
  maskImage:
    "linear-gradient(to bottom, transparent 2%, rgba(0,0,0,0.32) 22%, rgba(0,0,0,0.72) 58%, transparent 96%)",
  WebkitMaskImage:
    "linear-gradient(to bottom, transparent 2%, rgba(0,0,0,0.32) 22%, rgba(0,0,0,0.72) 58%, transparent 96%)",
  // Static on phones. A masked, 3D-transformed layer cannot be reused by the
  // compositor while it animates: it is re-rasterised every frame, forever,
  // and the mask forces a second offscreen buffer each time. Holding it still
  // lets the layer be painted once and reused, which is the difference
  // between a background texture and a permanent GPU load.
  //
  // The grid lines are rgba(...,0.04) — at that opacity the drift is not
  // something anyone sees on a small screen, so nothing is really lost.
  animation: {
    xs: "none",
    md: "xtiitch-perspective-drift 44s linear infinite",
  },
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

export const riseInSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

export const fadeInSx = (delayMs = 0) => ({
  animation: `xtiitch-fade-in 520ms ease ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

export const statusColour: Record<
  "red" | "yellow" | "green",
  "error" | "warning" | "success"
> = {
  red: "error",
  yellow: "warning",
  green: "success",
};
