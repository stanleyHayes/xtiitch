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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CircleIcon from "@mui/icons-material/Circle";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
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

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Typography
      component="p"
      sx={{
        textTransform: "uppercase",
        letterSpacing: 0,
        fontSize: 12,
        fontWeight: 700,
        color: "primary.main",
        mb: 1.5,
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
        py: { xs: 6, md: 10 },
        bgcolor: alt ? "background.paper" : "background.default",
        borderTop: alt ? "1px solid" : "none",
        borderBottom: alt ? "1px solid" : "none",
        borderColor: "divider",
        ...sx,
      }}
    >
      <Container>{children}</Container>
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
        maxWidth: 760,
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
          sx={{ mt: 2, color: "text.secondary", fontSize: { xs: 16, md: 18 } }}
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
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container sx={{ py: { xs: 6, md: 9 } }}>
        <Box sx={{ maxWidth: 780 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Typography
            variant="h1"
            component="h1"
            sx={{ fontSize: { xs: 32, md: 44 } }}
          >
            {title}
          </Typography>
          <Typography
            sx={{
              mt: 2.5,
              color: "text.secondary",
              fontSize: { xs: 17, md: 19 },
            }}
          >
            {subtitle}
          </Typography>
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
        <Card key={feature.title} sx={{ height: "100%" }}>
          <CardContent sx={{ p: 3 }}>
            <Box
              aria-hidden
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1,
                bgcolor: "rgba(128,0,32,0.08)",
                color: "primary.main",
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
        gap: 3,
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
      }}
    >
      {items.map((step) => (
        <Box key={step.number} sx={{ display: "flex", gap: 2 }}>
          <Box
            aria-hidden
            sx={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
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
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          boxShadow: "0 24px 60px -38px rgba(21,17,26,0.42)",
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
              "linear-gradient(180deg, rgba(21,17,26,0.04) 22%, rgba(21,17,26,0.78) 100%)",
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
              bgcolor: "background.paper",
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 38,
                height: 38,
                borderRadius: "50%",
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
                bgcolor: "background.default",
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
            borderColor: plan.highlight ? "primary.main" : "divider",
            borderWidth: plan.highlight ? 2 : 1,
            opacity: plan.available ? 1 : 0.92,
          }}
        >
          <CardContent
            sx={{
              p: 3,
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
              sx={{ display: "flex", alignItems: "baseline", gap: 1, mt: 1 }}
            >
              <Typography variant="h3" component="p">
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
              sx={{ mt: 1.5, alignSelf: "flex-start" }}
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
    <Box sx={{ maxWidth: 820, mx: "auto" }}>
      {items.map((faq) => (
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
            bgcolor: "background.paper",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography sx={{ fontWeight: 600 }}>{faq.question}</Typography>
          </AccordionSummary>
          <AccordionDetails>
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
            p: 3,
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
            {point.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {point.body}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function CtaBand({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
      <Container sx={{ py: { xs: 6, md: 9 }, textAlign: "center" }}>
        <Typography
          variant="h2"
          component="h2"
          sx={{ maxWidth: 720, mx: "auto" }}
        >
          {title}
        </Typography>
        <Typography
          sx={{ mt: 2, mb: 4, maxWidth: 620, mx: "auto", opacity: 0.9 }}
        >
          {body}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ justifyContent: "center" }}
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
