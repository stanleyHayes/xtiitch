import type { MetaDescriptor } from "react-router";
import { Link as RouterLink, useLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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
import {
  features,
  plans,
  site,
  steps,
  trustPoints,
} from "../content";
import {
  loadSponsoredOrFeatured,
  recordSponsoredEvent,
  type SponsoredEventInput,
  type SponsoredPlacement,
} from "../lib/sponsored";
import { useMarketingFlags } from "../root";
import { AtelierImageStrip } from "../features/home/atelier-strip";
import { DiscoverFeaturedBlurb } from "../features/home/discover-blurb";
import { GrowthProgrammesTeaser } from "../features/home/growth-teaser";
import { Hero } from "../features/home/hero";
import { ProofTicker } from "../features/home/proof-ticker";
import { SponsoredPlacements } from "../features/home/sponsored-placements";
import { StatsSection } from "../features/home/stats-section";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Xtiitch — The operating system for fashion",
    description: site.promise,
    path: "/",
    rootTitle: true,
  });
}

export async function loader(): Promise<{ sponsored: SponsoredPlacement[] }> {
  return { sponsored: await loadSponsoredOrFeatured(4) };
}

export async function action({
  request,
}: {
  request: Request;
}): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as
    | (SponsoredEventInput & { intent?: string })
    | null;
  if (!payload || payload.intent !== "sponsored_event") {
    return Response.json({ ok: false }, { status: 400 });
  }
  const ok = await recordSponsoredEvent(payload, request);
  return Response.json({ ok });
}

export default function Home() {
  const { sponsored } = useLoaderData<typeof loader>();
  // The live business directory is gated behind the discover flag. Pre-launch
  // (flag off) we never show businesses — only the explanatory blurb.
  const { discover: discoverLive } = useMarketingFlags();

  return (
    <>
      <Hero />
      <ProofTicker />
      <StatsSection />

      {discoverLive ? (
        <SponsoredPlacements placements={sponsored} />
      ) : (
        <DiscoverFeaturedBlurb />
      )}
      <GrowthProgrammesTeaser />

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
