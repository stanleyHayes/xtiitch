import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import CircleIcon from "@mui/icons-material/Circle";
import { bespokeStages } from "../../content";
import { riseInSx, statusColour } from "./shared";

// A faithful mock of the customer "where is my cloth?" tracking view: colour is
// the primary signal (never colour alone — each carries a label and an icon).
export function TrackingPreview() {
  const current = 1; // "Being made"
  return (
    <Card
      sx={{
        borderRadius: 1,
        boxShadow: "0 24px 60px -28px rgba(21,17,26,0.5)",
        overflow: "hidden",
        maxWidth: 420,
        mx: "auto",
        ...riseInSx(80),
      }}
    >
      <Box
        sx={{ bgcolor: "secondary.main", color: "common.white", px: 3, py: 2 }}
      >
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Akosua’s Atelier · Order #A3F92
        </Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
          Kente-trim wrap dress
        </Typography>
      </Box>
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            p: 2,
            borderRadius: 1,
            bgcolor: "rgba(184,121,20,0.12)",
            mb: 3,
          }}
        >
          <CircleIcon sx={{ color: "warning.main" }} aria-hidden />
          <Box
            aria-hidden
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "warning.main",
              ml: -2.5,
              animation: "xtiitch-status-pulse 1800ms ease-in-out infinite",
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }}
          />
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              Your outfit is being made
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Roughly ready in 4–6 days
            </Typography>
          </Box>
        </Box>

        <Stack spacing={1.5}>
          {bespokeStages.map((stage, index) => {
            const done = index < current;
            const isCurrent = index === current;
            return (
              <Box
                key={stage.label}
                sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
              >
                <CircleIcon
                  fontSize="small"
                  aria-hidden
                  sx={{
                    color:
                      done || isCurrent
                        ? `${statusColour[stage.colour]}.main`
                        : "divider",
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isCurrent ? 700 : 500,
                    color:
                      done || isCurrent ? "text.primary" : "text.secondary",
                  }}
                >
                  {stage.customerText}
                </Typography>
                {isCurrent ? (
                  <Chip
                    size="small"
                    color="warning"
                    label="Now"
                    sx={{ ml: "auto" }}
                  />
                ) : null}
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
