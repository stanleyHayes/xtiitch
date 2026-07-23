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

export function StatsSection() { // eslint-disable-line max-lines-per-function -- large presentational component; refactor in follow-up
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
          py: { xs: 5, md: 7 },
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "0.72fr 1.28fr" },
            gap: { xs: 3.5, lg: 7 },
            alignItems: "center",
            ...homeRiseSx(240),
          }}
        >
          <Box sx={{ maxWidth: { xs: 540, lg: 430 } }}>
            <Typography
              variant="overline"
              sx={{
                display: "block",
                color: "primary.main",
                fontWeight: 850,
                letterSpacing: "0.1em",
              }}
            >
              Why businesses choose Xtiitch
            </Typography>
            <Typography
              variant="h2"
              component="h2"
              sx={{
                mt: 1,
                fontSize: { xs: 34, sm: 42, lg: 48 },
                lineHeight: 1.02,
              }}
            >
              Simple to start. Clear all the way through.
            </Typography>
            <Typography
              sx={{
                mt: 2,
                color: "text.secondary",
                fontSize: { xs: 15, sm: 17 },
                maxWidth: 410,
              }}
            >
              Open your store without pressure, keep every order easy to
              understand, and receive payments directly through Paystack.
            </Typography>
          </Box>

          <Box
            sx={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0,1fr))" },
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              bgcolor: "background.paper",
              boxShadow: "0 28px 72px -56px rgba(21,17,26,0.72)",
            }}
          >
          {stats.map((stat, index) => (
            <Box
              key={stat.label}
              sx={{
                position: "relative",
                minWidth: 0,
                minHeight: { xs: 0, sm: 238 },
                p: { xs: 2.5, sm: 2.25, md: 3 },
                display: "flex",
                flexDirection: "column",
                gap: { xs: 2, sm: 3 },
                borderTop: {
                  xs: index === 0 ? "none" : "1px solid",
                  sm: "none",
                },
                borderLeft: {
                  xs: "none",
                  sm: index === 0 ? "none" : "1px solid",
                },
                borderColor: "divider",
                transition:
                  "background-color 180ms ease, transform 180ms ease",
                ...homeRiseSx(300 + index * 90),
                "&:hover": {
                  bgcolor: `${stat.accent}08`,
                  transform: { sm: "translateY(-3px)" },
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
                    width: 40,
                    height: 40,
                    flex: "0 0 auto",
                    borderRadius: 1.25,
                    display: "grid",
                    placeItems: "center",
                    color: stat.accent,
                    bgcolor: `${stat.accent}12`,
                    border: "1px solid",
                    borderColor: `${stat.accent}24`,
                  }}
                >
                  <stat.Icon sx={{ fontSize: 22 }} />
                </Box>
                <Typography
                  component="p"
                  sx={{
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.055em",
                    lineHeight: 1.35,
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
                      rowGap: 0.75,
                      columnGap: 0.5,
                    }}
                  >
                    {stat.statuses.map((status) => (
                      <Box
                        key={status.label}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          px: 1,
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
                            fontSize: 12,
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
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      fontSize: { xs: 42, sm: 45, md: 50 },
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
                  fontSize: { xs: 14, md: 15 },
                }}
              >
                {stat.label}
                </Typography>
              </Box>
            </Box>
          ))}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
