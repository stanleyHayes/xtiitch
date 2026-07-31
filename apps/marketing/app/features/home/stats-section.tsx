import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import SellRoundedIcon from "@mui/icons-material/SellRounded";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { perspectiveGridSx } from "../../components/ui/shared";

const homeRiseSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
});

const orderStages = [
  { label: "Received", detail: "Red", colour: "#a92727" },
  { label: "In progress", detail: "Yellow", colour: "#b87914" },
  { label: "Ready", detail: "Green", colour: "#237a4b" },
];

export function StatsSection() {
  return (
    <Box
      component="section"
      aria-labelledby="business-promises-title"
      sx={{
        position: "relative",
        py: { xs: 7, md: 10 },
        bgcolor: "background.default",
        borderBottom: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        "&:before": perspectiveGridSx({ opacity: 0.72 }),
      }}
    >
      <Container sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "0.7fr 1.3fr" },
            gap: { xs: 3.5, lg: 7 },
            alignItems: "end",
            mb: { xs: 4, md: 5 },
            ...homeRiseSx(180),
          }}
        >
          <Box>
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 850, letterSpacing: "0.1em" }}
            >
              Built to feel straightforward
            </Typography>
            <Typography
              id="business-promises-title"
              component="h2"
              variant="h2"
              sx={{ mt: 1, fontSize: { xs: 36, sm: 46, md: 54 }, lineHeight: 1.02 }}
            >
              Less uncertainty at every step.
            </Typography>
          </Box>
          <Typography
            sx={{
              maxWidth: 650,
              color: "text.secondary",
              fontSize: { xs: 16, md: 19 },
              lineHeight: 1.65,
              textWrap: "pretty",
            }}
          >
            Start before you are ready to pay for software, show customers what
            is happening with every order, and receive payments through Paystack.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(280px, .82fr) 1.18fr" },
            gap: { xs: 2, md: 2.5 },
            alignItems: "stretch",
          }}
        >
          <FreePlanPanel />

          <Stack spacing={{ xs: 2, md: 2.5 }}>
            <OrderJourney />
            <DirectPaymentPanel />
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

function FreePlanPanel() {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: 330, md: 440 },
        p: { xs: 3, sm: 4 },
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "primary.contrastText",
        bgcolor: "primary.main",
        borderRadius: { xs: 3, md: "28px 8px 28px 8px" },
        boxShadow: "0 34px 80px -50px rgba(128,0,32,.8)",
        overflow: "hidden",
        ...homeRiseSx(260),
        "&::before": {
          content: '"0"',
          position: "absolute",
          right: "-0.06em",
          bottom: "-0.31em",
          color: "rgba(255,255,255,.055)",
          fontSize: { xs: 280, sm: 360 },
          fontWeight: 900,
          lineHeight: 1,
          pointerEvents: "none",
        },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 46,
            height: 46,
            display: "grid",
            placeItems: "center",
            borderRadius: 1.5,
            bgcolor: "rgba(255,255,255,.12)",
            border: "1px solid rgba(255,255,255,.18)",
          }}
        >
          <SellRoundedIcon />
        </Box>
        <Typography sx={{ fontWeight: 800 }}>The Free plan</Typography>
      </Stack>

      <Box sx={{ position: "relative" }}>
        <Typography
          sx={{ fontSize: 13, fontWeight: 750, opacity: 0.72, letterSpacing: ".05em" }}
        >
          START FOR
        </Typography>
        <Typography
          sx={{
            mt: 0.5,
            fontSize: { xs: 64, sm: 82 },
            fontWeight: 850,
            lineHeight: 0.95,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          GHS 0
        </Typography>
        <Typography sx={{ mt: 2, maxWidth: 290, fontSize: 17, lineHeight: 1.5, opacity: 0.82 }}>
          Put your store online now. Upgrade when the business needs more room.
        </Typography>
      </Box>
    </Box>
  );
}

function OrderJourney() {
  return (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: { xs: 3, md: "8px 28px 8px 28px" },
        boxShadow: "0 26px 70px -58px rgba(21,17,26,.8)",
        ...homeRiseSx(340),
      }}
    >
      <Typography variant="h4" component="h3" sx={{ fontSize: { xs: 23, md: 28 } }}>
        Customers always know what comes next.
      </Typography>
      <Typography sx={{ mt: 1, color: "text.secondary", maxWidth: 580 }}>
        One simple status language follows the order from receipt to collection.
      </Typography>

      <Box
        sx={{
          mt: { xs: 3, md: 4 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr auto 1fr auto 1fr" },
          gap: { xs: 1.25, sm: 1 },
          alignItems: "center",
        }}
      >
        {orderStages.map((stage, index) => (
          <Box key={stage.label} sx={{ display: "contents" }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: `${stage.colour}0D`,
                border: `1px solid ${stage.colour}26`,
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Box sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: stage.colour }} />
                <Box>
                  <Typography sx={{ color: stage.colour, fontSize: 12, fontWeight: 850 }}>
                    {stage.detail}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 750 }}>{stage.label}</Typography>
                </Box>
              </Stack>
            </Box>
            {index < orderStages.length - 1 ? (
              <ArrowForwardRoundedIcon
                aria-hidden
                sx={{ display: { xs: "none", sm: "block" }, color: "text.secondary", fontSize: 19 }}
              />
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function DirectPaymentPanel() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "auto 1fr", sm: "auto 1fr auto" },
        gap: { xs: 2, sm: 2.5 },
        alignItems: "center",
        p: { xs: 2.5, md: 3 },
        color: "#f8fff9",
        bgcolor: "#1d7046",
        borderRadius: { xs: 3, md: "20px 8px 20px 8px" },
        overflow: "hidden",
        ...homeRiseSx(420),
      }}
    >
      <Box
        sx={{
          width: 50,
          height: 50,
          display: "grid",
          placeItems: "center",
          borderRadius: 1.5,
          bgcolor: "rgba(255,255,255,.12)",
        }}
      >
        <PaymentsRoundedIcon />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 850, fontSize: 18 }}>Paid directly through Paystack</Typography>
        <Typography sx={{ mt: 0.35, fontSize: 14, opacity: 0.76 }}>
          Xtiitch tracks the payment. Your money goes to your connected account.
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ gridColumn: { xs: "1 / -1", sm: "auto" }, alignItems: "center", whiteSpace: "nowrap" }}
      >
        <CheckRoundedIcon sx={{ fontSize: 19 }} />
        <Typography sx={{ fontWeight: 850 }}>We hold GHS 0</Typography>
      </Stack>
    </Box>
  );
}
