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
  const queue = [
    {
      name: "Kente-trim wrap dress",
      customer: "Ama Boakye",
      state: "Being made",
      tone: "warning",
    },
    {
      name: "Two-piece linen set",
      customer: "Nana Mensah",
      state: "Awaiting deposit",
      tone: "info",
    },
    {
      name: "Bridal fitting",
      customer: "Esi Arthur",
      state: "Ready for fitting",
      tone: "success",
    },
  ] as const;
  const metrics = [
    { label: "Orders this week", value: "18" },
    { label: "Through-Xtiitch sales", value: "GHS 4.8k" },
    { label: "Offline takings logged", value: "GHS 1.1k" },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: { xs: "1fr", lg: "1.15fr 0.85fr" },
        alignItems: "stretch",
      }}
    >
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          boxShadow: "0 24px 60px -38px rgba(21,17,26,0.42)",
        }}
      >
        <Box
          sx={{
            px: { xs: 2.5, md: 3 },
            py: 2.5,
            bgcolor: "secondary.main",
            color: "common.white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800 }}>Studio dashboard</Typography>
            <Typography
              variant="body2"
              sx={{ color: "rgba(255,255,255,0.68)" }}
            >
              Akosua’s Atelier
            </Typography>
          </Box>
          <Chip
            label="Live orders"
            color="primary"
            sx={{ bgcolor: "primary.main", color: "common.white" }}
          />
        </Box>

        <Box sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              mb: 3,
            }}
          >
            {metrics.map((metric) => (
              <Box
                key={metric.label}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 2,
                  minHeight: 104,
                  bgcolor: "background.default",
                }}
              >
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {metric.label}
                </Typography>
                <Typography variant="h4" component="p" sx={{ mt: 1 }}>
                  {metric.value}
                </Typography>
              </Box>
            ))}
          </Box>

          <Stack spacing={1.5}>
            {queue.map((item) => (
              <Box
                key={item.name}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
                  gap: 1.5,
                  alignItems: "center",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {item.customer}
                  </Typography>
                </Box>
                <Chip label={item.state} color={item.tone} variant="outlined" />
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          display: "grid",
          gridTemplateRows: "minmax(220px, 1fr) auto",
        }}
      >
        <Box
          component="img"
          src="/images/atelier-hero.webp"
          alt="Fashion atelier with garments, burgundy fabric and a tablet near a sewing machine"
          loading="lazy"
          decoding="async"
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            minHeight: 220,
          }}
        />
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" component="h3">
            Storefront and studio stay connected
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Share a design link, collect the order, move the garment through
            stages, and keep the customer’s progress view in sync.
          </Typography>
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
