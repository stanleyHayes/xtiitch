import { type ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import type { SxProps, Theme } from "@mui/material/styles";
import type { SvgIconComponent } from "@mui/icons-material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CircleIcon from "@mui/icons-material/Circle";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HelpRoundedIcon from "@mui/icons-material/HelpRounded";
import Inventory2RoundedIcon from "@mui/icons-material/Inventory2Rounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { FeatureGlyph } from "./icons";
import {
  bespokeStages,
  site,
  type Faq,
  type Feature,
  type Plan,
  type Step,
  type TrustPoint,
} from "../content";

const pageHeroIcons: Record<string, SvgIconComponent> = {
  FAQ: HelpRoundedIcon,
  Features: Inventory2RoundedIcon,
  "For customers": GroupsRoundedIcon,
  "How it works": ChecklistRoundedIcon,
  Pricing: PaymentsRoundedIcon,
  Privacy: SecurityRoundedIcon,
  "Security and trust": SecurityRoundedIcon,
  Terms: ReceiptLongRoundedIcon,
};

const featureAccent: Record<Feature["icon"], string> = {
  bookings: "#315f8f",
  catalogue: "#b87914",
  money: "#2f6b4f",
  notifications: "#5c0017",
  orders: "#800020",
  payments: "#237a4b",
  store: "#800020",
  tracking: "#b87914",
};

const riseInSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const fadeInSx = (delayMs = 0) => ({
  animation: `xtiitch-fade-in 520ms ease ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

export function Eyebrow({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "light";
}) {
  const isLight = tone === "light";
  return (
    <Typography
      component="p"
      sx={{
        textTransform: "uppercase",
        letterSpacing: 0,
        fontSize: 11,
        fontWeight: 800,
        color: isLight ? "common.white" : "primary.main",
        mb: 1.5,
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        "&:before": {
          content: '""',
          width: 28,
          height: 2,
          borderRadius: 1,
          bgcolor: isLight ? "common.white" : "primary.main",
        },
      }}
    >
      {children}
    </Typography>
  );
}

export function Section({
  children,
  alt,
  sx,
}: {
  children: ReactNode;
  alt?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        py: { xs: 6, md: 10 },
        overflow: "hidden",
        bgcolor: alt ? "background.paper" : "background.default",
        borderTop: alt ? "1px solid" : "none",
        borderBottom: alt ? "1px solid" : "none",
        borderColor: "divider",
        "&:before": alt
          ? {
              content: '""',
              position: "absolute",
              inset: 0,
              opacity: 0.72,
              background: [
                "linear-gradient(90deg, rgba(128,0,32,0.035) 1px, transparent 1px)",
                "linear-gradient(180deg, rgba(21,17,26,0.026) 1px, transparent 1px)",
                "radial-gradient(circle, rgba(128,0,32,0.09) 1px, transparent 1.5px)",
              ].join(", "),
              backgroundSize: "42px 42px, 42px 42px, 14px 14px",
              animation: "xtiitch-thread-drift 24s linear infinite",
              pointerEvents: "none",
              "@media (prefers-reduced-motion: reduce)": {
                animation: "none",
              },
            }
          : undefined,
        ...sx,
      }}
    >
      <Container sx={{ position: "relative" }}>{children}</Container>
    </Box>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const isCenter = align === "center";
  return (
    <Box
      sx={{
        maxWidth: 820,
        mx: isCenter ? "auto" : 0,
        textAlign: align,
        mb: { xs: 4, md: 6 },
        ...riseInSx(40),
      }}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Typography variant="h2" component="h2">
        {title}
      </Typography>
      {subtitle ? (
        <Typography
          sx={{
            mt: 2,
            color: "text.secondary",
            fontSize: { xs: 16, md: 18 },
            maxWidth: 700,
            mx: isCenter ? "auto" : 0,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}

export function CtaRow({
  align = "flex-start",
}: {
  align?: "flex-start" | "center";
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      sx={{
        justifyContent: align,
        alignItems: { xs: "stretch", sm: "center" },
      }}
    >
      <Button
        component={RouterLink}
        to={site.primaryCta.href}
        variant="contained"
        size="large"
        endIcon={<ArrowForwardRoundedIcon />}
      >
        {site.primaryCta.label}
      </Button>
      <Button
        component={RouterLink}
        to={site.secondaryCta.href}
        variant="outlined"
        size="large"
      >
        {site.secondaryCta.label}
      </Button>
    </Stack>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const Icon = pageHeroIcons[eyebrow] ?? StorefrontRoundedIcon;
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.06) 1px, transparent 1px), linear-gradient(180deg, rgba(21,17,26,0.04) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
        }}
      />
      <Container sx={{ position: "relative", py: { xs: 6, md: 10 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1.12fr 0.88fr" },
            alignItems: "center",
          }}
        >
          <Box sx={{ maxWidth: 820, ...riseInSx(40) }}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <Typography
              variant="h1"
              component="h1"
              sx={{
                fontSize: { xs: 38, sm: 48, md: 64 },
                maxWidth: "100%",
                overflowWrap: "break-word",
              }}
            >
              {title}
            </Typography>
            <Typography
              sx={{
                mt: 2.5,
                color: "text.secondary",
                fontSize: { xs: 17, md: 20 },
                maxWidth: 680,
              }}
            >
              {subtitle}
            </Typography>
          </Box>

          <Box
            sx={{
              position: "relative",
              minHeight: { xs: 180, md: 260 },
              overflow: "hidden",
              display: { xs: "none", sm: "block" },
            }}
          >
            <Icon
              sx={{
                position: "absolute",
                right: { sm: 10, md: 20 },
                bottom: { sm: 10, md: 8 },
                fontSize: { sm: 190, md: 248 },
                color: "rgba(21,17,26,0.14)",
                animation: "xtiitch-float-mark 8s ease-in-out infinite",
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              }}
              aria-hidden
            />
            <Stack
              sx={{
                position: "relative",
                p: { sm: 3, md: 4 },
                height: "100%",
                minHeight: { sm: 180, md: 260 },
              }}
            >
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  left: { sm: 28, md: 34 },
                  top: { sm: 28, md: 34 },
                  width: 88,
                  height: 3,
                  borderRadius: 1,
                  bgcolor: "primary.main",
                  transformOrigin: "left center",
                  animation:
                    "xtiitch-rise-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) 180ms both",
                }}
              />
              <Box
                aria-hidden
                sx={{
                  position: "absolute",
                  left: { sm: 28, md: 34 },
                  top: { sm: 42, md: 50 },
                  width: 42,
                  height: 3,
                  borderRadius: 1,
                  bgcolor: "rgba(21,17,26,0.32)",
                  transformOrigin: "left center",
                  animation:
                    "xtiitch-rise-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) 260ms both",
                }}
              />
            </Stack>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

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

export function StepList({ items }: { items: Step[] }) {
  return (
    <Box
      sx={{
        position: "relative",
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
        "&:before": {
          content: { xs: "none", lg: '""' },
          position: "absolute",
          left: "8%",
          right: "8%",
          top: 32,
          height: 2,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.2), rgba(184,121,20,0.26), rgba(35,122,75,0.22))",
        },
      }}
    >
      {items.map((step, index) => (
        <Box
          key={step.number}
          sx={{
            position: "relative",
            display: "flex",
            gap: 2,
            p: 2.5,
            border: "1px solid",
            borderColor: index === 0 ? "rgba(128,0,32,0.26)" : "divider",
            borderRadius: 1,
            bgcolor:
              index === 0 ? "rgba(255,255,255,0.94)" : "background.paper",
            minHeight: 168,
            boxShadow:
              index === 0 ? "0 28px 68px -54px rgba(128,0,32,0.72)" : "none",
            transition:
              "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
            ...riseInSx(80 + index * 70),
            "&:hover": {
              transform: "translateY(-3px)",
              borderColor: "rgba(128,0,32,0.2)",
              boxShadow: "0 26px 60px -48px rgba(21,17,26,0.55)",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 1,
              bgcolor: index === 0 ? "primary.main" : "background.default",
              color: index === 0 ? "primary.contrastText" : "primary.main",
              border: "1px solid",
              borderColor: index === 0 ? "primary.main" : "rgba(128,0,32,0.18)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              boxShadow:
                index === 0 ? "0 12px 30px -18px rgba(128,0,32,0.9)" : "none",
            }}
          >
            {step.number}
          </Box>
          <Box>
            <Typography variant="h6" component="h3">
              {step.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              {step.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

const measurementIcons = [
  ChecklistRoundedIcon,
  GroupsRoundedIcon,
  StorefrontRoundedIcon,
  PaymentsRoundedIcon,
] as const;

const measurementAccents = [
  "#800020",
  "#315f8f",
  "#b87914",
  "#237a4b",
] as const;

export function MeasurementRouteGrid({
  items,
}: {
  items: { title: string; body: string; deposit: string }[];
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "1fr 1fr",
          lg: "repeat(4, 1fr)",
        },
      }}
    >
      {items.map((route, index) => {
        const Icon = measurementIcons[index] ?? ChecklistRoundedIcon;
        const accent = measurementAccents[index] ?? "#800020";
        return (
          <Box
            key={route.title}
            sx={{
              position: "relative",
              p: 3,
              borderRadius: 1,
              border: "1px solid",
              borderColor: index === 0 ? `${accent}55` : "divider",
              bgcolor: "rgba(255,255,255,0.86)",
              overflow: "hidden",
              minHeight: 254,
              boxShadow:
                index === 0
                  ? "0 28px 70px -54px rgba(128,0,32,0.7)"
                  : "0 22px 60px -50px rgba(21,17,26,0.42)",
              transition:
                "transform 190ms ease, border-color 190ms ease, box-shadow 190ms ease",
              ...riseInSx(90 + index * 65),
              "&:hover": {
                transform: "translateY(-3px)",
                borderColor: `${accent}66`,
                boxShadow: "0 30px 72px -52px rgba(21,17,26,0.58)",
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
                right: -18,
                bottom: -18,
                fontSize: 112,
                color: `${accent}14`,
                transform: "rotate(-7deg)",
              }}
            />
            <Box sx={{ position: "relative" }}>
              <Box
                aria-hidden
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1,
                  mb: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: `${accent}12`,
                  color: accent,
                  border: "1px solid",
                  borderColor: `${accent}24`,
                }}
              >
                <Icon fontSize="small" />
              </Box>
              <Typography variant="h6" component="h3">
                {route.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "text.secondary" }}
              >
                {route.body}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={route.deposit}
                sx={{
                  mt: 2,
                  bgcolor: "background.paper",
                  borderColor: `${accent}40`,
                  color: accent,
                  maxWidth: "100%",
                  "& .MuiChip-label": {
                    whiteSpace: "normal",
                    py: 0.4,
                  },
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

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
              bgcolor: "rgba(255,255,255,0.84)",
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
            bgcolor: "rgba(255,255,255,0.72)",
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
                      ? "rgba(250,246,242,0.96)"
                      : "rgba(255,255,255,0.9)",
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

export function PlanCards({ items }: { items: Plan[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        alignItems: "stretch",
      }}
    >
      {items.map((plan, index) => (
        <Card
          key={plan.name}
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
            borderColor: plan.highlight ? "primary.main" : "divider",
            borderWidth: plan.highlight ? 2 : 1,
            opacity: plan.available ? 1 : 0.92,
            bgcolor: plan.highlight
              ? "rgba(255,255,255,0.98)"
              : "background.paper",
            transform: plan.highlight ? { md: "translateY(-10px)" } : "none",
            boxShadow: plan.highlight
              ? "0 34px 86px -52px rgba(128,0,32,0.76)"
              : undefined,
            ...fadeInSx(80 + index * 80),
            "&:hover": {
              transform: plan.highlight
                ? { xs: "translateY(-4px)", md: "translateY(-14px)" }
                : "translateY(-4px)",
              boxShadow: plan.highlight
                ? "0 38px 92px -50px rgba(128,0,32,0.82)"
                : "0 30px 70px -50px rgba(21,17,26,0.55)",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              height: 8,
              bgcolor: plan.highlight ? "primary.main" : "rgba(128,0,32,0.12)",
            }}
          />
          <CardContent
            sx={{
              p: { xs: 3, md: 3.25 },
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="h5" component="h3">
                {plan.name}
              </Typography>
              {plan.badge ? (
                <Chip
                  size="small"
                  label={plan.badge}
                  color={plan.highlight ? "primary" : "default"}
                  variant={plan.highlight ? "filled" : "outlined"}
                />
              ) : null}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                mt: 1.5,
              }}
            >
              <Typography
                variant="h3"
                component="p"
                sx={{ color: "primary.main" }}
              >
                {plan.price}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {plan.priceNote}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={`${plan.feeLabel}: ${plan.feeValue}`}
              sx={{
                mt: 1.5,
                alignSelf: "flex-start",
                bgcolor: plan.highlight ? "rgba(128,0,32,0.06)" : undefined,
              }}
            />
            <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
              {plan.summary}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1.25} sx={{ flexGrow: 1 }}>
              {plan.includes.map((line) => (
                <Box
                  key={line}
                  sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                >
                  <CheckCircleRoundedIcon
                    fontSize="small"
                    sx={{ color: "success.main", mt: "2px" }}
                    aria-hidden
                  />
                  <Typography variant="body2">{line}</Typography>
                </Box>
              ))}
            </Stack>
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              variant={plan.highlight ? "contained" : "outlined"}
              size="large"
              disabled={!plan.available}
              sx={{ mt: 3 }}
            >
              {plan.available ? "Get started" : "Coming later"}
            </Button>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <Box sx={{ maxWidth: 920, mx: "auto" }}>
      {items.map((faq, index) => (
        <Accordion
          key={faq.question}
          disableGutters
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            mb: 1.5,
            "&:before": { display: "none" },
            bgcolor: "rgba(255,255,255,0.88)",
            overflow: "hidden",
            transition:
              "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
            ...riseInSx(60 + index * 45),
            "&:hover": {
              transform: "translateY(-2px)",
              borderColor: "rgba(128,0,32,0.18)",
              boxShadow: "0 24px 60px -52px rgba(21,17,26,0.56)",
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              minHeight: 68,
              "& .MuiAccordionSummary-content": {
                alignItems: "center",
                gap: 2,
              },
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                flexShrink: 0,
                width: 30,
                height: 30,
                borderRadius: 1,
                bgcolor: "rgba(128,0,32,0.08)",
                color: "primary.main",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Box>
            <Typography sx={{ fontWeight: 800 }}>{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pl: { xs: 2, sm: 8 } }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {faq.answer}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export function PolicySectionList({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
      }}
    >
      {items.map((section, index) => {
        const accent =
          index % 3 === 0 ? "#800020" : index % 3 === 1 ? "#315f8f" : "#2f6b4f";
        return (
          <Box
            key={section.title}
            sx={{
              position: "relative",
              minHeight: 248,
              p: { xs: 2.5, md: 3 },
              border: "1px solid",
              borderColor: index === 0 ? `${accent}55` : "divider",
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.88)",
              overflow: "hidden",
              boxShadow:
                index === 0
                  ? "0 28px 72px -56px rgba(128,0,32,0.72)"
                  : "0 22px 58px -52px rgba(21,17,26,0.44)",
              ...riseInSx(70 + index * 50),
              "&:before": {
                content: '""',
                position: "absolute",
                inset: "0 0 auto 0",
                height: 5,
                bgcolor: accent,
              },
            }}
          >
            <Typography
              aria-hidden
              component="p"
              sx={{
                position: "absolute",
                right: 18,
                top: 8,
                fontFamily: "DM Serif Display, Instrument Sans, serif",
                fontSize: 80,
                lineHeight: 1,
                color: `${accent}12`,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Typography>
            <Box sx={{ position: "relative" }}>
              <Box
                aria-hidden
                sx={{
                  width: 42,
                  height: 42,
                  mb: 2,
                  borderRadius: 1,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: `${accent}12`,
                  color: accent,
                  border: "1px solid",
                  borderColor: `${accent}24`,
                }}
              >
                <ReceiptLongRoundedIcon fontSize="small" />
              </Box>
              <Typography variant="h5" component="h2">
                {section.title}
              </Typography>
              <Typography sx={{ mt: 1, color: "text.secondary" }}>
                {section.body}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function TrustGrid({ items }: { items: TrustPoint[] }) {
  const accents = [
    "#800020",
    "#2f6b4f",
    "#315f8f",
    "#b87914",
    "#5c0017",
    "#237a4b",
  ];
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((point, index) => (
        <Box
          key={point.title}
          sx={{
            position: "relative",
            p: 3,
            borderRadius: 1,
            border: "1px solid",
            borderColor: index === 0 ? "rgba(128,0,32,0.24)" : "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
            minHeight: 232,
            transition:
              "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
            ...riseInSx(80 + index * 70),
            "&:hover": {
              transform: "translateY(-3px)",
              borderColor: "rgba(128,0,32,0.18)",
              boxShadow: "0 26px 62px -50px rgba(21,17,26,0.58)",
            },
            "&:before": {
              content: '""',
              position: "absolute",
              inset: "0 0 auto 0",
              height: 5,
              bgcolor: accents[index % accents.length],
            },
          }}
        >
          <Typography
            aria-hidden
            component="p"
            sx={{
              position: "absolute",
              right: 18,
              top: 10,
              fontFamily: "DM Serif Display, Instrument Sans, serif",
              fontSize: 74,
              lineHeight: 1,
              color: `${accents[index % accents.length]}12`,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </Typography>
          <Box
            aria-hidden
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1,
              mb: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: `${accents[index % accents.length]}12`,
              color: accents[index % accents.length],
              border: "1px solid",
              borderColor: `${accents[index % accents.length]}24`,
            }}
          >
            <SecurityRoundedIcon fontSize="small" />
          </Box>
          <Box sx={{ position: "relative" }}>
            <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
              {point.title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {point.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function CtaBand({ title, body }: { title: string; body: string }) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <Box
        component="img"
        src="/images/payment-handoff.webp"
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.18,
          transform: "scale(1.03)",
          animation: "xtiitch-hero-zoom 1200ms ease-out both",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            transform: "none",
          },
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(128,0,32,0.95), rgba(21,17,26,0.84))",
        }}
      />
      <Container sx={{ position: "relative", py: { xs: 6, md: 9 } }}>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, md: 5 },
            gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
            alignItems: "center",
          }}
        >
          <Box sx={riseInSx(40)}>
            <Typography variant="h2" component="h2" sx={{ maxWidth: 760 }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 2, maxWidth: 620, opacity: 0.9 }}>
              {body}
            </Typography>
          </Box>
          <Box
            sx={{
              width: { xs: "100%", md: 360 },
              p: { xs: 1.5, sm: 2 },
              border: "1px solid",
              borderColor: "rgba(255,255,255,0.24)",
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 28px 80px -56px rgba(0,0,0,0.78)",
              ...riseInSx(140),
            }}
          >
            <Chip
              size="small"
              icon={<CheckCircleRoundedIcon />}
              label="Free to start"
              sx={{
                mb: 1.5,
                color: "common.white",
                bgcolor: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.22)",
                "& .MuiChip-icon": { color: "common.white" },
              }}
            />
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              size="large"
              fullWidth
              sx={{
                justifyContent: "space-between",
                bgcolor: "common.white",
                color: "primary.main",
                minHeight: 58,
                px: 2.5,
                "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
              }}
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {site.primaryCta.label}
            </Button>
            <Box
              sx={{
                mt: 1.25,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1.5,
                px: 0.5,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  Plans and fees
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "rgba(255,255,255,0.68)" }}
                >
                  Free plan available
                </Typography>
              </Box>
              <Button
                component={RouterLink}
                to="/pricing"
                size="small"
                sx={{
                  color: "common.white",
                  minHeight: 36,
                  px: 1,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                }}
                endIcon={<ArrowForwardRoundedIcon />}
              >
                See pricing
              </Button>
            </Box>
            <Divider sx={{ my: 1.75, borderColor: "rgba(255,255,255,0.18)" }} />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr" },
                gap: 1,
              }}
            >
              {["No monthly cost to start", "Your money stays yours"].map(
                (line) => (
                  <Stack
                    key={line}
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    <CheckCircleRoundedIcon sx={{ fontSize: 17 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {line}
                    </Typography>
                  </Stack>
                ),
              )}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

const statusColour: Record<
  "red" | "yellow" | "green",
  "error" | "warning" | "success"
> = {
  red: "error",
  yellow: "warning",
  green: "success",
};

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
