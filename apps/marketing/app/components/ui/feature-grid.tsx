import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { FeatureGlyph } from "../icons";
import { type Feature } from "../../content";
import { riseInSx } from "./shared";

const featureAccent: Record<Feature["icon"], string> = {
  bookings: "#315f8f",
  catalogue: "#b87914",
  money: "#2f6b4f",
  notifications: "#5c0017",
  orders: "#800020",
  payments: "#237a4b",
  store: "#800020",
  tracking: "#b87914",
  branding: "#6a1b9a",
  waitlist: "#315f8f",
  security: "#2f6b4f",
};

export function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2.5, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((feature, index) => (
        <Card
          key={feature.title}
          sx={{
            height: "100%",
            position: "relative",
            overflow: "hidden",
            bgcolor: "background.paper",
            minHeight: 268,
            borderColor: index % 3 === 1 ? "rgba(128,0,32,0.16)" : "divider",
            transition:
              "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
            ...riseInSx(80 + index * 70),
            "&:hover": {
              transform: "translateY(-4px)",
              borderColor: `${featureAccent[feature.icon]}55`,
              boxShadow: "0 30px 70px -44px rgba(21,17,26,0.62)",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              bgcolor: featureAccent[feature.icon],
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              right: -24,
              bottom: -24,
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: `1px solid ${featureAccent[feature.icon]}`,
              opacity: 0.12,
              transition: "transform 220ms ease, opacity 220ms ease",
              ".MuiCard-root:hover &": {
                transform: "scale(1.08)",
                opacity: 0.18,
              },
            }}
          />
          <FeatureGlyph
            icon={feature.icon}
            aria-hidden
            sx={{
              position: "absolute",
              right: -12,
              bottom: -18,
              fontSize: 124,
              color: `${featureAccent[feature.icon]}14`,
              transform: "rotate(-6deg)",
              transition: "transform 220ms ease, color 220ms ease",
              ".MuiCard-root:hover &": {
                color: `${featureAccent[feature.icon]}1f`,
                transform: "rotate(-3deg) scale(1.04)",
              },
            }}
          />
          <CardContent
            sx={{
              p: 3.25,
              position: "relative",
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: `${featureAccent[feature.icon]}14`,
                color: featureAccent[feature.icon],
                display: "grid",
                placeItems: "center",
                mb: 2,
                boxShadow: `0 18px 34px -28px ${featureAccent[feature.icon]}`,
              }}
            >
              <FeatureGlyph icon={feature.icon} />
            </Box>
            <Typography
              component="p"
              sx={{
                mb: 1.25,
                color: featureAccent[feature.icon],
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Typography>
            <Typography variant="h5" component="h3" sx={{ mb: 1 }}>
              {feature.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {feature.body}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
