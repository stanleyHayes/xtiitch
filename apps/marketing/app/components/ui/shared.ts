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
