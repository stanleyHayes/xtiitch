import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import StraightenRoundedIcon from "@mui/icons-material/StraightenRounded";
import { bespokeStages } from "../../content";
import { riseInSx, statusColour } from "./shared";

const currentStage = 1;
type BespokeStage = (typeof bespokeStages)[number];

// Status styling is intentionally state-driven in one place.
// eslint-disable-next-line complexity
function TrackingStage({
  stage,
  index,
}: {
  stage: BespokeStage;
  index: number;
}) {
  const done = index < currentStage;
  const isCurrent = index === currentStage;
  const colour = statusColour[stage.colour];

  return (
    <Box
      component="li"
      sx={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "34px minmax(0,1fr) auto",
        alignItems: "center",
        gap: 1.25,
        minHeight: 58,
        "&:not(:last-child):after": {
          content: '""',
          position: "absolute",
          top: 42,
          bottom: -16,
          left: 16,
          width: 2,
          bgcolor: done ? `${colour}.main` : "divider",
          opacity: done ? 0.55 : 0.85,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "relative",
          zIndex: 1,
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: done || isCurrent ? "common.white" : "text.disabled",
          bgcolor: done || isCurrent ? `${colour}.main` : "background.default",
          border: "1px solid",
          borderColor: done || isCurrent ? `${colour}.main` : "divider",
          boxShadow: isCurrent
            ? "0 0 0 5px rgba(184,121,20,0.1)"
            : "none",
        }}
      >
        {done ? (
          <CheckRoundedIcon sx={{ fontSize: 18 }} />
        ) : (
          <Typography sx={{ fontSize: 12, fontWeight: 850 }}>
            {index + 1}
          </Typography>
        )}
      </Box>
      <Typography
        variant="body2"
        sx={{
          minWidth: 0,
          fontWeight: isCurrent ? 850 : done ? 700 : 550,
          color: done || isCurrent ? "text.primary" : "text.secondary",
        }}
      >
        {stage.customerText}
      </Typography>
      {isCurrent ? (
        <Chip size="small" color="warning" label="Now" sx={{ minWidth: 54 }} />
      ) : null}
    </Box>
  );
}

export function TrackingPreview() {
  return (
    <Card
      aria-label="Example customer order progress"
      sx={{
        position: "relative",
        maxWidth: 500,
        mx: "auto",
        overflow: "hidden",
        border: "1px solid rgba(128,0,32,0.18)",
        borderRadius: 3,
        bgcolor: "background.paper",
        boxShadow: "0 32px 80px -42px rgba(21,17,26,0.62)",
        ...riseInSx(80),
      }}
    >
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          px: { xs: 2.5, sm: 3.5 },
          py: { xs: 2.5, sm: 3 },
          color: "common.white",
          bgcolor: "secondary.main",
          "&:after": {
            content: '""',
            position: "absolute",
            width: 190,
            height: 190,
            right: -84,
            top: -110,
            borderRadius: "50%",
            border: "30px solid rgba(255,255,255,0.04)",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{
            position: "relative",
            zIndex: 1,
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{
                color: "rgba(255,255,255,0.62)",
                letterSpacing: "0.12em",
                fontWeight: 800,
              }}
            >
              Akosua’s Atelier · #A3F92
            </Typography>
            <Typography
              component="h3"
              sx={{
                mt: 0.5,
                fontFamily: "inherit",
                fontSize: { xs: 21, sm: 24 },
                lineHeight: 1.2,
                fontWeight: 850,
              }}
            >
              Kente-trim wrap dress
            </Typography>
          </Box>
          <Chip
            label="In progress"
            size="small"
            sx={{
              flexShrink: 0,
              color: "common.white",
              bgcolor: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          />
        </Stack>
      </Box>

      <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            alignItems: "center",
            gap: 2,
            p: { xs: 2, sm: 2.5 },
            border: "1px solid rgba(184,121,20,0.2)",
            borderRadius: 2,
            bgcolor: "rgba(184,121,20,0.08)",
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              display: "grid",
              placeItems: "center",
              bgcolor: "warning.main",
              color: "common.white",
              boxShadow: "0 12px 28px -16px rgba(184,121,20,0.8)",
            }}
          >
            <StraightenRoundedIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 850, lineHeight: 1.25 }}>
              Your outfit is being made
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                color: "text.secondary",
              }}
            >
              <ScheduleRoundedIcon sx={{ fontSize: 17 }} />
              Roughly ready in 4–6 days
            </Typography>
          </Box>
        </Box>

        <Stack
          component="ol"
          spacing={0}
          sx={{ listStyle: "none", p: 0, m: "26px 0 0" }}
        >
          {bespokeStages.map((stage, index) => (
            <TrackingStage key={stage.label} stage={stage} index={index} />
          ))}
        </Stack>
      </Box>
    </Card>
  );
}
