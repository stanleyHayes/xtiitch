import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import type { SvgIconComponent } from "@mui/icons-material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import { type GrowthProgramme } from "../../content";

const programmeIcons: SvgIconComponent[] = [
  LocalOfferRoundedIcon,
  HandshakeRoundedIcon,
  TrendingUpRoundedIcon,
  CampaignRoundedIcon,
];

const accents = ["#800020", "#315f8f", "#2f6b4f", "#b87914"] as const;

export function ProgrammeCard({
  programme,
  index,
}: {
  programme: GrowthProgramme;
  index: number;
}) {
  const Icon = programmeIcons[index] ?? TrendingUpRoundedIcon;
  const accent = accents[index % accents.length];

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: 360,
        p: { xs: 2.5, md: 3 },
        border: "1px solid",
        borderColor: index === 0 ? `${accent}55` : "divider",
        borderRadius: 1,
        bgcolor: "rgba(var(--surface-rgb), 0.9)",
        overflow: "hidden",
        boxShadow:
          index === 0
            ? "0 30px 78px -56px rgba(128,0,32,0.72)"
            : "0 22px 58px -52px rgba(21,17,26,0.44)",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: `${accent}66`,
          boxShadow: "0 30px 76px -52px rgba(21,17,26,0.6)",
        },
        "&:before": {
          content: '""',
          position: "absolute",
          inset: "0 0 auto 0",
          height: 5,
          bgcolor: accent,
        },
      }}
    >
      <Icon
        aria-hidden
        sx={{
          position: "absolute",
          right: -20,
          bottom: -22,
          fontSize: 128,
          color: `${accent}14`,
          transform: "rotate(-7deg)",
        }}
      />
      <Box sx={{ position: "relative" }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Box
            aria-hidden
            sx={{
              width: 46,
              height: 46,
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              bgcolor: `${accent}12`,
              color: accent,
              border: "1px solid",
              borderColor: `${accent}28`,
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Chip
            label={programme.label}
            size="small"
            variant="outlined"
            sx={{ borderColor: `${accent}40`, color: accent }}
          />
        </Stack>
        <Typography variant="h4" component="h2" sx={{ mt: 2.5 }}>
          {programme.title}
        </Typography>
        <Typography sx={{ mt: 1.25, color: "text.secondary" }}>
          {programme.body}
        </Typography>
        <Chip
          label={programme.status}
          size="small"
          sx={{
            mt: 2,
            maxWidth: "100%",
            bgcolor: `${accent}10`,
            color: accent,
            "& .MuiChip-label": {
              whiteSpace: "normal",
              py: 0.4,
            },
          }}
        />
        <Stack spacing={1.1} sx={{ mt: 2.25 }}>
          {programme.proof.map((item) => (
            <Box
              key={item}
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 1,
                alignItems: "flex-start",
              }}
            >
              <CheckCircleRoundedIcon
                aria-hidden
                fontSize="small"
                sx={{ mt: "2px", color: accent }}
              />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {item}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
