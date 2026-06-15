import type { MetaDescriptor } from "react-router";
import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
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
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(21,17,26,0.9) 0%, rgba(21,17,26,0.66) 44%, rgba(21,17,26,0.2) 78%), linear-gradient(180deg, rgba(128,0,32,0.22), rgba(21,17,26,0.58))",
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          opacity: 0.18,
        }}
      />
      <Container sx={{ position: "relative", py: { xs: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 720, color: "common.white" }}>
          <Chip
            label="Built for Ghanaian fashion businesses"
            sx={{
              mb: 3,
              fontWeight: 700,
              color: "common.white",
              borderColor: "rgba(255,255,255,0.6)",
              bgcolor: "rgba(255,255,255,0.08)",
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
            }}
          >
            {site.promise}
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ mt: 4, alignItems: { xs: "stretch", sm: "center" } }}
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
            sx={{ mt: 2.5, color: "rgba(255,255,255,0.76)" }}
          >
            Start free. Take mobile money and cards through Paystack. Keep your
            own money.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

const stats: { value: string; label: string }[] = [
  { value: "GHS 0", label: "to start on the Free plan" },
  { value: "Red · Yellow · Green", label: "order status anyone can read" },
  { value: "0", label: "of your money we ever hold" },
];

export default function Home() {
  return (
    <>
      <Hero />

      <Box
        sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Container sx={{ py: { xs: 4, md: 5 } }}>
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              textAlign: { xs: "left", sm: "center" },
            }}
          >
            {stats.map((stat) => (
              <Box
                key={stat.label}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.default",
                }}
              >
                <Typography
                  variant="h4"
                  component="p"
                  sx={{ color: "primary.main", fontWeight: 800 }}
                >
                  {stat.value}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {stat.label}
                </Typography>
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
