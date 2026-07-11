import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import HandshakeRoundedIcon from "@mui/icons-material/HandshakeRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import { Section, SectionHeading } from "../../components/ui";
import { growthProgrammes } from "../../content";

const growthIcons = [
  LocalOfferRoundedIcon,
  HandshakeRoundedIcon,
  TrendingUpRoundedIcon,
  CampaignRoundedIcon,
] as const;

export function GrowthProgrammesTeaser() {
  return (
    <Section>
      <Box
        sx={{
          display: "grid",
          gap: { xs: 4, md: 5 },
          gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" },
          alignItems: "start",
        }}
      >
        <Box>
          <SectionHeading
            align="left"
            eyebrow="Growth tools"
            title="Promote the store without losing the money trail"
            subtitle="Promotion codes, referrals, affiliate links, and sponsored placements are built around the same rule as payments: keep value tied to a real order, a clear ledger, and a verified business."
          />
          <Button
            component={RouterLink}
            to="/growth"
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
          >
            Explore growth programmes
          </Button>
        </Box>
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          {growthProgrammes.map((programme, index) => {
            const Icon = growthIcons[index] ?? TrendingUpRoundedIcon;
            const accent =
              index === 0
                ? "#800020"
                : index === 1
                  ? "#315f8f"
                  : index === 2
                    ? "#2f6b4f"
                    : "#b87914";
            return (
              <Box
                key={programme.title}
                sx={{
                  position: "relative",
                  minHeight: 208,
                  p: 2.5,
                  border: "1px solid",
                  borderColor: index === 0 ? `${accent}55` : "divider",
                  borderRadius: 1,
                  bgcolor: "rgba(var(--surface-rgb), 0.86)",
                  overflow: "hidden",
                  boxShadow:
                    index === 0
                      ? "0 26px 66px -54px rgba(128,0,32,0.72)"
                      : "0 18px 48px -44px rgba(21,17,26,0.42)",
                }}
              >
                <Icon
                  aria-hidden
                  sx={{
                    position: "absolute",
                    right: -14,
                    bottom: -16,
                    fontSize: 104,
                    color: `${accent}14`,
                    transform: "rotate(-8deg)",
                  }}
                />
                <Box sx={{ position: "relative" }}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{ alignItems: "center", mb: 1.5 }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 1,
                        display: "grid",
                        placeItems: "center",
                        color: accent,
                        bgcolor: `${accent}12`,
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                    <Chip
                      label={programme.label}
                      size="small"
                      variant="outlined"
                      sx={{ color: accent, borderColor: `${accent}40` }}
                    />
                  </Stack>
                  <Typography variant="h5" component="h3">
                    {programme.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 1, color: "text.secondary" }}
                  >
                    {programme.body}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Section>
  );
}
