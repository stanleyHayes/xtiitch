import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import { type TrustPoint } from "../../content";
import { riseInSx } from "./shared";

export function TrustGrid({ items }: { items: TrustPoint[] }) {
  const accents = [
    "#800020",
    "#2f6b4f",
    "#315f8f",
    "#b87914",
    "#5c0017",
    "#237a4b",
  ];
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((point, index) => (
        <Box
          key={point.title}
          sx={{
            position: "relative",
            p: 3,
            borderRadius: 1,
            border: "1px solid",
            borderColor: index === 0 ? "rgba(128,0,32,0.24)" : "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
            minHeight: 232,
            transition:
              "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
            ...riseInSx(80 + index * 70),
            "&:hover": {
              transform: "translateY(-3px)",
              borderColor: "rgba(128,0,32,0.18)",
              boxShadow: "0 26px 62px -50px rgba(21,17,26,0.58)",
            },
            "&:before": {
              content: '""',
              position: "absolute",
              inset: "0 0 auto 0",
              height: 5,
              bgcolor: accents[index % accents.length],
            },
          }}
        >
          <Typography
            aria-hidden
            component="p"
            sx={{
              position: "absolute",
              right: 18,
              top: 10,
              fontFamily: "inherit",
              fontSize: 74,
              lineHeight: 1,
              color: `${accents[index % accents.length]}12`,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </Typography>
          <Box
            aria-hidden
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1,
              mb: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${accents[index % accents.length]}12`,
              color: accents[index % accents.length],
              border: "1px solid",
              borderColor: `${accents[index % accents.length]}24`,
            }}
          >
            <SecurityRoundedIcon fontSize="small" />
          </Box>
          <Box sx={{ position: "relative" }}>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              {point.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {point.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
