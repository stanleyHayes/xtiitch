import type { SvgIconComponent } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";

const homeRiseSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const stats: {
  eyebrow: string;
  value: string;
  label: string;
  accent: string;
  Icon: SvgIconComponent;
  statuses?: { label: string; color: string }[];
}[] = [
  {
    eyebrow: "Start without pressure",
    value: "GHS 0",
    label: "to start on the Free plan",
    accent: "#800020",
    Icon: LocalOfferRoundedIcon,
  },
  {
    eyebrow: "Tracking customers can understand",
    value: "Red · Yellow · Green",
    label: "order status anyone can read",
    accent: "#b87914",
    Icon: TimelineRoundedIcon,
    statuses: [
      { label: "Red", color: "#a92727" },
      { label: "Yellow", color: "#b87914" },
      { label: "Green", color: "#237a4b" },
    ],
  },
  {
    eyebrow: "Your money stays yours",
    value: "0",
    label: "of your money we ever hold",
    accent: "#237a4b",
    Icon: AccountBalanceWalletRoundedIcon,
  },
];

export function StatsSection() {
  return (
    <Box
      sx={{
        position: "relative",
        bgcolor: "background.default",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.04) 1px, transparent 1px), linear-gradient(180deg, rgba(21,17,26,0.035) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          pointerEvents: "none",
        },
      }}
    >
      <Container
        sx={{
          position: "relative",
          pt: { xs: 3, md: 5 },
          pb: { xs: 4, md: 5 },
        }}
      >
        <Box
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: { xs: 2, md: 3 },
            ...homeRiseSx(240),
          }}
        >
          {stats.map((stat, index) => (
            <Box
              key={stat.label}
              sx={{
                position: "relative",
                overflow: "hidden",
                minHeight: { xs: "auto", md: 224 },
                p: { xs: 3, md: 3.5 },
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                borderRadius: 3,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "0 24px 60px -50px rgba(21,17,26,0.6)",
                transition:
                  "transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease",
                ...homeRiseSx(300 + index * 90),
                "&:before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${stat.accent}, ${stat.accent}33)`,
                },
                "&:hover": {
                  transform: "translateY(-4px)",
                  borderColor: `${stat.accent}66`,
                  boxShadow: `0 30px 72px -46px ${stat.accent}88`,
                },
              }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ position: "relative", alignItems: "center" }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1,
                    display: "grid",
                    placeItems: "center",
                    color: stat.accent,
                    bgcolor: `${stat.accent}12`,
                  }}
                >
                  <stat.Icon sx={{ fontSize: 22 }} />
                </Box>
                <Typography
                  component="p"
                  sx={{
                    color: "text.secondary",
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: 0,
                  }}
                >
                  {stat.eyebrow}
                </Typography>
              </Stack>

              <Box sx={{ position: "relative", mt: "auto" }}>
                {stat.statuses ? (
                  <Stack
                    direction="row"
                    spacing={1}
                    aria-label={stat.value}
                    sx={{
                      mb: 1.25,
                      flexWrap: "wrap",
                      rowGap: 1,
                    }}
                  >
                    {stat.statuses.map((status) => (
                      <Box
                        key={status.label}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          px: 1.25,
                          py: 0.6,
                          borderRadius: 999,
                          bgcolor: `${status.color}14`,
                          border: `1px solid ${status.color}55`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            bgcolor: status.color,
                          }}
                        />
                        <Typography
                          sx={{
                            color: status.color,
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {status.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography
                    component="p"
                    sx={{
                      color: stat.accent,
                      fontWeight: 800,
                      lineHeight: 0.95,
                      letterSpacing: "-0.02em",
                      fontSize: { xs: 46, md: 58 },
                      mb: 1,
                    }}
                  >
                    {stat.value}
                  </Typography>
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    maxWidth: 250,
                    fontSize: { xs: 15, md: 16 },
                  }}
                >
                  {stat.label}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
