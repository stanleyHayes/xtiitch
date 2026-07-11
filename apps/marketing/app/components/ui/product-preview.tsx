import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CircleIcon from "@mui/icons-material/Circle";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import { bespokeStages } from "../../content";
import { riseInSx, statusColour } from "./shared";

export function ProductPreview() {
  const workflow = [
    {
      label: "Share the store",
      title: "A link customers can trust",
      body: "Every design or collection can be sent to WhatsApp, Instagram, Facebook or a customer directly.",
    },
    {
      label: "Collect the order",
      title: "Choices, measurements and payment together",
      body: "Standard orders, custom requests, bookings and deposits arrive as complete records.",
    },
    {
      label: "Move the work",
      title: "Customers see progress without chasing",
      body: "As the business updates stages, the customer gets a simple red, yellow or green tracking view.",
    },
  ] as const;
  const signals = [
    {
      label: "Public storefront",
      value: "Browse",
      Icon: StorefrontRoundedIcon,
      accent: "#800020",
    },
    {
      label: "Order record",
      value: "Confirm",
      Icon: ReceiptLongRoundedIcon,
      accent: "#b87914",
    },
    {
      label: "Customer tracking",
      value: "Follow",
      Icon: ChecklistRoundedIcon,
      accent: "#237a4b",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 3, md: 4 },
        gridTemplateColumns: { xs: "1fr", lg: "1.08fr 0.92fr" },
        alignItems: "start",
      }}
    >
      <Box
        sx={{
          position: "relative",
          minHeight: { xs: 360, md: 560 },
          border: "1px solid",
          borderColor: "rgba(255,255,255,0.36)",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: "0 34px 80px -48px rgba(21,17,26,0.62)",
          ...riseInSx(80),
        }}
      >
        <Box
          component="img"
          src="/images/atelier-review.webp"
          alt="Fashion designer and customer reviewing a burgundy kente-trim garment in an atelier"
          loading="lazy"
          decoding="async"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            animation: "xtiitch-hero-zoom 1200ms ease-out both",
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(21,17,26,0.02) 15%, rgba(21,17,26,0.72) 100%), linear-gradient(90deg, rgba(128,0,32,0.18), rgba(21,17,26,0.05))",
          }}
        />
        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            minHeight: { xs: 360, md: 560 },
            display: "flex",
            alignItems: "flex-end",
            p: { xs: 2.5, md: 4 },
            color: "common.white",
          }}
        >
          <Box sx={{ maxWidth: 520 }}>
            <Typography variant="h3" component="h3">
              The public store is only the front door.
            </Typography>
            <Typography sx={{ mt: 1.5, color: "rgba(255,255,255,0.78)" }}>
              Behind every link is the work itself: measurements, deposits,
              fittings, delivery choices, and the customer’s progress view.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gap: 2.5 }}>
        {workflow.map((item, index) => (
          <Box
            key={item.label}
            sx={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 2,
              p: { xs: 2.5, md: 3 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.84)",
              boxShadow:
                index === 0 ? "0 24px 60px -48px rgba(128,0,32,0.78)" : "none",
              backdropFilter: "blur(10px)",
              transition:
                "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
              ...riseInSx(150 + index * 80),
              "&:hover": {
                transform: "translateY(-3px)",
                borderColor: "rgba(128,0,32,0.22)",
                boxShadow: "0 26px 64px -50px rgba(128,0,32,0.65)",
              },
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 38,
                height: 38,
                borderRadius: 1,
                bgcolor: index === 0 ? "primary.main" : "background.default",
                color: index === 0 ? "primary.contrastText" : "primary.main",
                border: "1px solid",
                borderColor: index === 0 ? "primary.main" : "divider",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
              }}
            >
              {index + 1}
            </Box>
            <Box>
              <Typography
                variant="body2"
                sx={{ color: "primary.main", fontWeight: 700, mb: 0.5 }}
              >
                {item.label}
              </Typography>
              <Typography variant="h5" component="h3">
                {item.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mt: 1 }}
              >
                {item.body}
              </Typography>
            </Box>
          </Box>
        ))}

        <Box
          aria-label="Storefront to tracking workflow"
          sx={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: { xs: 1.25, sm: 0 },
            p: { xs: 1, sm: 1.25 },
            border: "1px solid",
            borderColor: "rgba(128,0,32,0.14)",
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.72)",
            boxShadow: "0 22px 60px -48px rgba(21,17,26,0.62)",
            overflow: "hidden",
            "&:before": {
              content: '""',
              position: "absolute",
              left: { xs: 25, sm: 32 },
              right: { xs: "auto", sm: 32 },
              top: { xs: 30, sm: "50%" },
              bottom: { xs: 30, sm: "auto" },
              width: { xs: 2, sm: "auto" },
              height: { xs: "auto", sm: 2 },
              transform: { xs: "none", sm: "translateY(-50%)" },
              borderRadius: 1,
              background:
                "linear-gradient(180deg, rgba(128,0,32,0.26), rgba(184,121,20,0.34), rgba(35,122,75,0.3))",
              "@media (min-width: 600px)": {
                background:
                  "linear-gradient(90deg, rgba(128,0,32,0.26), rgba(184,121,20,0.34), rgba(35,122,75,0.3))",
              },
            },
          }}
        >
          {signals.map((signal, index) => {
            const Icon = signal.Icon;
            return (
              <Box
                key={signal.label}
                sx={{
                  position: "relative",
                  zIndex: 1,
                  display: "grid",
                  gridTemplateColumns: { xs: "auto 1fr", sm: "1fr" },
                  alignItems: { xs: "center", sm: "stretch" },
                  gap: { xs: 1.5, sm: 1.75 },
                  minHeight: { xs: 96, sm: 152 },
                  p: { xs: 1.75, sm: 2 },
                  borderRadius: 1,
                  bgcolor:
                    index === 1
                      ? "rgba(var(--surface-rgb),0.96)"
                      : "rgba(var(--surface-rgb),0.9)",
                  border: "1px solid",
                  borderColor:
                    index === 1 ? "rgba(128,0,32,0.18)" : "transparent",
                  boxShadow:
                    index === 1
                      ? "0 20px 52px -44px rgba(128,0,32,0.62)"
                      : "none",
                  transition:
                    "transform 190ms ease, border-color 190ms ease, box-shadow 190ms ease",
                  ...riseInSx(260 + index * 80),
                  "&:hover": {
                    transform: "translateY(-3px)",
                    borderColor: `${signal.accent}2e`,
                    boxShadow: `0 24px 56px -48px ${signal.accent}`,
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: { xs: "flex-start", sm: "space-between" },
                    alignItems: "center",
                    gap: 1.25,
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1,
                      display: "grid",
                      placeItems: "center",
                      color: signal.accent,
                      bgcolor: `${signal.accent}12`,
                      border: "1px solid",
                      borderColor: `${signal.accent}24`,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Typography
                    aria-hidden
                    sx={{
                      display: { xs: "none", sm: "block" },
                      fontSize: 12,
                      fontWeight: 900,
                      color: "text.secondary",
                    }}
                  >
                    0{index + 1}
                  </Typography>
                </Box>
                <Box sx={{ alignSelf: "end", minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 700,
                      maxWidth: 150,
                    }}
                  >
                    {signal.label}
                  </Typography>
                  <Typography
                    variant="h4"
                    component="p"
                    sx={{
                      mt: 0.25,
                      color: "primary.main",
                      lineHeight: 1.1,
                    }}
                  >
                    {signal.value}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
            p: 2.5,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "secondary.main",
            color: "common.white",
            boxShadow: "0 26px 60px -48px rgba(21,17,26,0.7)",
          }}
        >
          <Typography sx={{ fontWeight: 700, mr: 1 }}>
            Customer view:
          </Typography>
          {bespokeStages.slice(0, 3).map((stage, index) => (
            <Chip
              key={stage.label}
              size="small"
              color={statusColour[stage.colour]}
              label={stage.customerText}
              icon={index < 2 ? <CircleIcon /> : undefined}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
