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
              pointerEvents: "none",
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
          <Box sx={{ maxWidth: 820 }}>
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
                right: { sm: -32, md: -44 },
                bottom: { sm: -44, md: -56 },
                fontSize: { sm: 230, md: 320 },
                color: "rgba(21,17,26,0.14)",
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
        gap: 3,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((feature) => (
        <Card
          key={feature.title}
          sx={{
            height: "100%",
            position: "relative",
            overflow: "hidden",
            bgcolor: "background.paper",
            transition: "transform 180ms ease, box-shadow 180ms ease",
            "&:hover": {
              transform: "translateY(-4px)",
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
            }}
          />
          <CardContent sx={{ p: 3.25, position: "relative" }}>
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
              }}
            >
              <FeatureGlyph icon={feature.icon} />
            </Box>
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
        display: "grid",
        gap: { xs: 2, md: 3 },
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((step) => (
        <Box
          key={step.number}
          sx={{
            position: "relative",
            display: "flex",
            gap: 2,
            p: 2.5,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "background.paper",
            minHeight: 168,
          }}
        >
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 44,
              height: 44,
              borderRadius: 1,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              boxShadow: "0 12px 30px -18px rgba(128,0,32,0.9)",
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
    { label: "Public storefront", value: "Browse" },
    { label: "Order record", value: "Confirm" },
    { label: "Customer tracking", value: "Follow" },
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
        }}
      >
        <Box
          component="img"
          src="/images/atelier-hero.webp"
          alt="Fashion atelier with garments, burgundy fabric and a tablet near a sewing machine"
          loading="lazy"
          decoding="async"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
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
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
            gap: 1.5,
          }}
        >
          {signals.map((signal) => (
            <Box
              key={signal.label}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "rgba(243,229,223,0.58)",
                p: 2,
                minHeight: 106,
              }}
            >
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {signal.label}
              </Typography>
              <Typography
                variant="h5"
                component="p"
                sx={{ mt: 1, color: "primary.main" }}
              >
                {signal.value}
              </Typography>
            </Box>
          ))}
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
      {items.map((plan) => (
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

export function TrustGrid({ items }: { items: TrustPoint[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((point) => (
        <Box
          key={point.title}
          sx={{
            position: "relative",
            p: 3,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
            "&:before": {
              content: '""',
              position: "absolute",
              inset: "0 auto 0 0",
              width: 5,
              bgcolor: "primary.main",
            },
          }}
        >
          <Typography variant="h6" component="h3" sx={{ mb: 1, pl: 1 }}>
            {point.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", pl: 1 }}>
            {point.body}
          </Typography>
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
        src="/images/atelier-hero.webp"
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
          <Box>
            <Typography variant="h2" component="h2" sx={{ maxWidth: 760 }}>
              {title}
            </Typography>
            <Typography sx={{ mt: 2, maxWidth: 620, opacity: 0.9 }}>
              {body}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row", md: "column" }}
            spacing={2}
            sx={{ alignItems: { xs: "stretch", md: "flex-start" } }}
          >
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              size="large"
              sx={{
                bgcolor: "common.white",
                color: "primary.main",
                "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
              }}
              endIcon={<ArrowForwardRoundedIcon />}
            >
              {site.primaryCta.label}
            </Button>
            <Button
              component={RouterLink}
              to="/pricing"
              size="large"
              variant="outlined"
              sx={{
                borderColor: "rgba(255,255,255,0.6)",
                color: "common.white",
                "&:hover": { borderColor: "common.white" },
              }}
            >
              See pricing
            </Button>
          </Stack>
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
