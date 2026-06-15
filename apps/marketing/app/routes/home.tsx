import type { MetaDescriptor } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { SvgIconComponent } from "@mui/icons-material";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import TimelineRoundedIcon from "@mui/icons-material/TimelineRounded";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  FeatureGrid,
  PlanCards,
  ProductPreview,
  Section,
  SectionHeading,
  StepList,
  TrackingPreview,
  TrustGrid,
} from "../components/ui";
import { features, plans, site, steps, trustPoints } from "../content";

const homeRiseSx = (delayMs = 0) => ({
  animation: `xtiitch-rise-in 620ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delayMs}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
});

const tickerItems = [
  "Branded storefront",
  "Orders",
  "Payments",
  "Walk-in takings",
  "Fittings",
  "Customer tracking",
  "Mobile money",
  "Studio workflow",
];

const imageStories = [
  {
    title: "Design review",
    body: "Show the customer the finished piece, keep the order record behind it.",
    image: "/images/atelier-review.webp",
    alt: "Fashion designer and customer reviewing a burgundy kente-trim garment in an atelier",
  },
  {
    title: "Payment handoff",
    body: "Package the garment, collect payment, and keep the sale tied to the customer.",
    image: "/images/payment-handoff.webp",
    alt: "Fashion business owner handing a packaged garment to a customer beside a phone storefront",
  },
  {
    title: "Fitting progress",
    body: "Move the garment through stages while the customer sees a calm progress view.",
    image: "/images/tracking-fitting.webp",
    alt: "Tailor fitting a burgundy dress while another team member checks a tablet tracking view",
  },
];

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Xtiitch — The operating system for fashion",
    description: site.promise,
    path: "/",
    rootTitle: true,
  });
}

function Hero() {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: "calc(100svh - 180px)", md: "calc(100svh - 210px)" },
        display: "grid",
        alignItems: "center",
        overflow: "hidden",
        bgcolor: "secondary.main",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        component="img"
        src="/images/atelier-hero.webp"
        alt=""
        aria-hidden
        decoding="async"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: { xs: "62% center", md: "center" },
          transform: "scale(1.035)",
          animation: "xtiitch-hero-zoom 1400ms ease-out both",
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
          inset: { xs: "-12% -38% 12% -28%", md: "-18% -24% 8% -18%" },
          zIndex: 1,
          opacity: 0.74,
          filter: "blur(6px)",
          background:
            "radial-gradient(circle at 18% 68%, rgba(128,0,32,0.48), transparent 36%), radial-gradient(circle at 74% 22%, rgba(184,121,20,0.34), transparent 30%), radial-gradient(circle at 56% 78%, rgba(250,246,242,0.16), transparent 28%)",
          animation: "xtiitch-spotlight-drift 16s ease-in-out infinite",
          pointerEvents: "none",
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
          zIndex: 2,
          background:
            "linear-gradient(90deg, rgba(21,17,26,0.9) 0%, rgba(21,17,26,0.66) 44%, rgba(21,17,26,0.2) 78%), linear-gradient(180deg, rgba(128,0,32,0.22), rgba(21,17,26,0.58))",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(180deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px, 44px 44px",
          opacity: 0.16,
          animation: "xtiitch-thread-drift 30s linear infinite",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
      />
      <Container sx={{ position: "relative", zIndex: 4, py: { xs: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 720, color: "common.white" }}>
          <Chip
            label="Built for Ghanaian fashion businesses"
            sx={{
              mb: 3,
              fontWeight: 700,
              color: "common.white",
              borderColor: "rgba(255,255,255,0.6)",
              bgcolor: "rgba(255,255,255,0.08)",
              ...homeRiseSx(80),
            }}
            variant="outlined"
          />
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontSize: { xs: 40, sm: 52, md: 72 },
              lineHeight: 0.98,
              maxWidth: "100%",
              overflowWrap: "break-word",
              ...homeRiseSx(160),
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "inline", sm: "none" } }}
            >
              A real shop for fashion businesses.
            </Box>{" "}
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              A real shop, run simply — and an answer to{" "}
              <Box component="span" sx={{ color: "rgba(255,255,255,0.86)" }}>
                “where is my cloth?”
              </Box>
            </Box>
          </Typography>
          <Typography
            sx={{
              mt: 3,
              fontSize: { xs: 17, md: 20 },
              color: "rgba(255,255,255,0.82)",
              maxWidth: 620,
              ...homeRiseSx(240),
            }}
          >
            {site.promise}
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              mt: 4,
              alignItems: { xs: "stretch", sm: "center" },
              ...homeRiseSx(320),
            }}
          >
            <Button
              component={RouterLink}
              to={site.primaryCta.href}
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                bgcolor: "common.white",
                color: "primary.main",
                "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
              }}
            >
              {site.primaryCta.label}
            </Button>
            <Button
              component={RouterLink}
              to={site.secondaryCta.href}
              size="large"
              variant="outlined"
              sx={{
                color: "common.white",
                borderColor: "rgba(255,255,255,0.62)",
                "&:hover": {
                  borderColor: "common.white",
                  bgcolor: "rgba(255,255,255,0.08)",
                },
              }}
            >
              {site.secondaryCta.label}
            </Button>
          </Stack>
          <Typography
            variant="body2"
            sx={{
              mt: 2.5,
              color: "rgba(255,255,255,0.76)",
              ...homeRiseSx(400),
            }}
          >
            Start free. Take mobile money and cards through Paystack. Keep your
            own money.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

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
    eyebrow: "Tracking customers understand",
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

function ProofTicker() {
  const items = [...tickerItems, ...tickerItems];
  return (
    <Box
      aria-label="Xtiitch product areas"
      sx={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        bgcolor: "primary.main",
        color: "primary.contrastText",
        borderBottom: "1px solid",
        borderColor: "rgba(21,17,26,0.12)",
      }}
    >
      <Box
        sx={{
          display: "inline-flex",
          minWidth: "max-content",
          animation: "xtiitch-ticker 34s linear infinite",
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
          },
        }}
      >
        {items.map((item, index) => (
          <Typography
            key={`${item}-${index}`}
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              px: { xs: 2.5, md: 4 },
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0,
              color: "rgba(255,255,255,0.9)",
              "&:after": {
                content: '"•"',
                ml: { xs: 2.5, md: 4 },
                color: "rgba(255,255,255,0.42)",
              },
            }}
          >
            {item}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function AtelierImageStrip() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.15fr 0.85fr" },
        gap: { xs: 2.5, md: 3 },
        mt: { xs: 4, md: 6 },
      }}
    >
      {imageStories.map((story, index) => (
        <Box
          key={story.title}
          sx={{
            position: "relative",
            minHeight:
              index === 0 ? { xs: 320, md: 500 } : { xs: 260, md: 240 },
            gridRow: index === 0 ? { md: "span 2" } : undefined,
            borderRadius: 1,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 30px 76px -54px rgba(21,17,26,0.62)",
            ...homeRiseSx(120 + index * 90),
          }}
        >
          <Box
            component="img"
            src={story.image}
            alt={story.alt}
            loading="lazy"
            decoding="async"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 700ms ease",
              ".MuiBox-root:hover > &": {
                transform: "scale(1.035)",
              },
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(21,17,26,0.02) 24%, rgba(21,17,26,0.7) 100%)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              p: { xs: 2.5, md: 3 },
              color: "common.white",
            }}
          >
            <Typography variant={index === 0 ? "h3" : "h5"} component="h3">
              {story.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 1, maxWidth: 520, color: "rgba(255,255,255,0.78)" }}
            >
              {story.body}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <ProofTicker />

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
            py: { xs: 0, md: 0 },
          }}
        >
          <Box
            sx={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              mt: { xs: -3, md: -5 },
              mb: { xs: 4, md: 5 },
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
              boxShadow: "0 30px 80px -54px rgba(21,17,26,0.72)",
              ...homeRiseSx(240),
              "&:before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background:
                  "linear-gradient(90deg, #800020 0%, #b87914 50%, #237a4b 100%)",
              },
            }}
          >
            {stats.map((stat, index) => (
              <Box
                key={stat.label}
                sx={{
                  position: "relative",
                  minHeight: { xs: 156, md: 190 },
                  p: { xs: 2.5, md: 3.25 },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 2.5,
                  borderRight: {
                    xs: "none",
                    sm: index === stats.length - 1 ? "none" : "1px solid",
                  },
                  borderBottom: {
                    xs: index === stats.length - 1 ? "none" : "1px solid",
                    sm: "none",
                  },
                  borderColor: "divider",
                  overflow: "hidden",
                  bgcolor:
                    index === 1 ? "rgba(250,246,242,0.68)" : "background.paper",
                  transition:
                    "transform 200ms ease, background-color 200ms ease, box-shadow 200ms ease",
                  ...homeRiseSx(300 + index * 80),
                  "&:hover": {
                    transform: "translateY(-3px)",
                    bgcolor:
                      index === 1
                        ? "rgba(250,246,242,0.84)"
                        : "rgba(255,255,255,0.92)",
                    boxShadow: "0 24px 60px -52px rgba(21,17,26,0.56)",
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    right: { xs: 14, md: 20 },
                    bottom: { xs: 14, md: 18 },
                    width: { xs: 112, md: 142 },
                    height: { xs: 72, md: 86 },
                    borderRadius: 1,
                    opacity: 0.74,
                    background: [
                      `linear-gradient(90deg, ${stat.accent}18 1px, transparent 1px)`,
                      `linear-gradient(180deg, ${stat.accent}14 1px, transparent 1px)`,
                      `radial-gradient(circle, ${stat.accent}24 1px, transparent 1.5px)`,
                    ].join(", "),
                    backgroundSize: "18px 18px, 18px 18px, 9px 9px",
                    animation: "xtiitch-thread-drift 22s linear infinite",
                    maskImage:
                      "linear-gradient(90deg, transparent 0%, #000 34%, #000 100%)",
                    WebkitMaskImage:
                      "linear-gradient(90deg, transparent 0%, #000 34%, #000 100%)",
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                    },
                  }}
                />
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

                <Box sx={{ position: "relative" }}>
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
                        <Chip
                          key={status.label}
                          label={status.label}
                          size="small"
                          sx={{
                            minHeight: 34,
                            borderRadius: 1,
                            bgcolor: `${status.color}14`,
                            color: status.color,
                            border: "1px solid",
                            borderColor: `${status.color}55`,
                            fontWeight: 800,
                          }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography
                      variant="h3"
                      component="p"
                      sx={{
                        color: stat.accent,
                        fontWeight: 800,
                        lineHeight: 1,
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

      <Section>
        <SectionHeading
          align="left"
          eyebrow="What businesses get"
          title="A public store, with the workflow behind it"
          subtitle="Xtiitch gives customers a clean storefront while the business keeps orders, payments, stages and progress updates moving behind the scenes."
        />
        <ProductPreview />
        <AtelierImageStrip />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="One dashboard, online and offline"
          title="Everything a fashion business needs to run"
          subtitle="From your storefront to your stages to your takings — built around how Ghanaians actually do fashion, not a foreign template."
        />
        <FeatureGrid items={features.slice(0, 6)} />
        <Box sx={{ mt: 5, textAlign: "center" }}>
          <Button
            component={RouterLink}
            to="/features"
            variant="text"
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ fontWeight: 700 }}
          >
            See all features
          </Button>
        </Box>
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="How it works"
          title="From first design to finished garment"
          subtitle="Set up once, then run every order from one place. Your customers follow along in plain colour."
        />
        <StepList items={steps} />
      </Section>

      <Section>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "0.95fr 1.05fr" },
            alignItems: "center",
          }}
        >
          <Box sx={{ order: { xs: 2, md: 1 } }}>
            <TrackingPreview />
          </Box>
          <Box sx={{ order: { xs: 1, md: 2 } }}>
            <SectionHeading
              align="left"
              eyebrow="The heart of the product"
              title="Customers finally see where their garment is"
              subtitle="The most painful part of tailoring is handing over your cloth and being left in the dark. Xtiitch closes that gap with a calm, shared progress view — like watching your car arrive on a ride app."
            />
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              {[
                "Red, yellow, green — understood at a glance, even by someone who reads very little.",
                "A rough timeframe for when it will be ready.",
                "Updates by app and email as the work moves forward.",
              ].map((line) => (
                <Typography
                  key={line}
                  sx={{ display: "flex", gap: 1.5, color: "text.secondary" }}
                >
                  <Box
                    component="span"
                    sx={{ color: "primary.main", fontWeight: 800 }}
                  >
                    →
                  </Box>
                  {line}
                </Typography>
              ))}
            </Stack>
            <Button
              component={RouterLink}
              to="/for-customers"
              variant="outlined"
              sx={{ mt: 3 }}
              endIcon={<ArrowForwardRoundedIcon />}
            >
              How it works for customers
            </Button>
          </Box>
        </Box>
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="Pricing built for real budgets"
          title="Start free, then grow into it"
          subtitle="A small monthly fee and a small share of online sales. Money taken outside Xtiitch is always yours, fee-free."
        />
        <PlanCards items={plans} />
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Why you can trust it"
          title="Your money goes straight to you"
          subtitle="Payments settle directly to your own account through Paystack. Xtiitch never holds anyone’s funds, and each business is sealed off from every other."
        />
        <TrustGrid items={trustPoints.slice(0, 3)} />
      </Section>

      <CtaBand
        title="Get your fashion business online"
        body="Join the waitlist and we’ll set you up as onboarding opens. No monthly cost to start."
      />
    </>
  );
}
