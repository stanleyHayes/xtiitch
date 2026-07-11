import Box from "@mui/material/Box";

// The ii-stitch brand mark (two stitches joined by a seam), per the brand
// guidelines — replaces the old "X" placeholder tile.
export function XtiitchMark({
  color = "#800020",
  size = 32,
  sx,
}: {
  color?: string;
  size?: number;
  sx?: object;
}) {
  return (
    <Box
      aria-hidden
      component="svg"
      viewBox="1.4 3.8 97.2 97.2"
      sx={{ width: size, height: size, display: "block", ...sx }}
    >
      <line x1="37" y1="40" x2="37" y2="74" stroke={color} strokeWidth="15" strokeLinecap="round" />
      <line x1="63" y1="40" x2="63" y2="74" stroke={color} strokeWidth="15" strokeLinecap="round" />
      <circle cx="37" cy="22" r="8.2" fill={color} />
      <circle cx="63" cy="22" r="8.2" fill={color} />
      <path d="M37 72.5 Q50 91 63 72.5" stroke={color} strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </Box>
  );
}
