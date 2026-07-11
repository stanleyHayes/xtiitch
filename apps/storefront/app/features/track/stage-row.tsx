import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CircleIcon from "@mui/icons-material/Circle";
import RadioButtonUncheckedRounded from "@mui/icons-material/RadioButtonUncheckedRounded";
import { tokens } from "../../theme";
import type { TrackingStage } from "../../lib/api";
import { paletteFor } from "./utils";

export function StageRow({ stage }: { stage: TrackingStage }) {
  const palette = paletteFor(stage.colour);
  const active = stage.is_current || stage.is_complete;
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: active ? alpha(palette.main, 0.22) : "divider",
        bgcolor: active ? palette.soft : alpha(tokens.white, 0.7),
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box
          aria-hidden
          sx={{
            width: 34,
            height: 34,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            bgcolor: active ? alpha(palette.main, 0.12) : "background.default",
            flexShrink: 0,
          }}
        >
          {stage.is_complete ? (
            <CheckCircleRounded sx={{ color: palette.main }} />
          ) : stage.is_current ? (
            <CircleIcon sx={{ color: palette.main, fontSize: 18 }} />
          ) : (
            <RadioButtonUncheckedRounded sx={{ color: "text.disabled" }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: stage.is_current ? 900 : 700,
              color: active ? "text.primary" : "text.secondary",
            }}
          >
            {stage.name}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {stage.is_complete
              ? "Completed"
              : stage.is_current
                ? "In progress"
                : "Up next"}
          </Typography>
        </Box>
        {stage.is_current ? (
          <Chip
            size="small"
            label="Now"
            sx={{ bgcolor: palette.main, color: "#fff", fontWeight: 900 }}
          />
        ) : null}
      </Stack>
    </Box>
  );
}
