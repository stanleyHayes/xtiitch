import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const tickerItems = [
  "Branded storefront",
  "Orders",
  "Payments",
  "Walk-in takings",
  "Fittings",
  "Customer tracking",
  "Mobile money",
  "Studio workflow",
];

export function ProofTicker() {
  const items = [...tickerItems, ...tickerItems];
  return (
    <Box
      aria-label="Xtiitch product areas"
      sx={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        bgcolor: "primary.main",
        color: "primary.contrastText",
        borderBottom: "1px solid",
        borderColor: "rgba(21,17,26,0.12)",
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          minWidth: "max-content",
          animation: "xtiitch-ticker 34s linear infinite",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
      >
        {items.map((item, index) => (
          <Typography
            key={`${item}-${index}`}
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              px: { xs: 2.5, md: 4 },
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0,
              color: "rgba(255,255,255,0.9)",
              "&:after": {
                content: '"•"',
                ml: { xs: 2.5, md: 4 },
                color: "rgba(255,255,255,0.42)",
              },
            }}
          >
            {item}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
