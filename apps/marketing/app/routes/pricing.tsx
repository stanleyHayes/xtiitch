import type { MetaDescriptor } from "react-router";
import { useLoaderData } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  PageHero,
  PlanCards,
  Section,
  SectionHeading,
} from "../components/ui";
import { growthProgrammes, plans, pricingNotes } from "../content";
import { loadLivePlanPricing, withLivePricing } from "../lib/pricing";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Pricing",
    description:
      "Start free with a real storefront and a 3% share on online sales, then move to a simple monthly plan as you grow — Starter GHS 49, Growth GHS 99, Studio GHS 199. Money you take outside Xtiitch is always yours, fee-free.",
    path: "/pricing",
  });
}

// Prices come from the API so an admin price change shows here without a
// deploy. loadLivePlanPricing fails open, in which case the copy's own figures
// are used.
export async function loader() {
  return { livePricing: await loadLivePlanPricing() };
}

export default function Pricing() {
  const { livePricing } = useLoaderData<typeof loader>();
  const livePlans = withLivePricing(plans, livePricing);
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Small monthly fee, small share of online sales"
        subtitle="Priced for real Ghanaian SME budgets. Start free with a real storefront, then move to a simple monthly plan as you grow — money you take outside Xtiitch is always yours, fee-free."
      />

      <Section>
        <PlanCards items={livePlans} />
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="Platform programmes"
          title="Operator-managed programmes sit outside plan entitlements"
          subtitle="Plan pricing runs the store. Referral, affiliate and sponsored programmes have separate approval and ledger controls; promotion codes are currently parked and are not included in any plan."
        />
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
          }}
        >
          {growthProgrammes.map((programme, index) => (
            <Box
              key={programme.title}
              sx={{
                p: 2.5,
                minHeight: 212,
                border: "1px solid",
                borderColor: index === 0 ? "rgba(128,0,32,0.26)" : "divider",
                borderRadius: 1,
                bgcolor: "rgba(var(--surface-rgb), 0.86)",
              }}
            >
              <Chip
                size="small"
                label={programme.label}
                color={index === 0 ? "primary" : "default"}
                variant={index === 0 ? "filled" : "outlined"}
              />
              <Typography variant="h6" component="h3" sx={{ mt: 1.5 }}>
                {programme.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 1, color: "text.secondary" }}
              >
                {programme.status}
              </Typography>
            </Box>
          ))}
        </Box>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="The fine print, in plain words"
          title="How the sales fee works"
          align="left"
        />
        <Stack spacing={1.5} sx={{ maxWidth: 900 }}>
          {pricingNotes.map((note) => (
            <Box
              key={note}
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 1.5,
                alignItems: "flex-start",
                p: 2,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "rgba(var(--surface-rgb), 0.78)",
              }}
            >
              <InfoOutlinedIcon
                sx={{ color: "info.main", mt: "2px" }}
                aria-hidden
              />
              <Typography sx={{ color: "text.secondary" }}>{note}</Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <CtaBand
        title="Start on Free, upgrade when it pays off"
        body="There’s no monthly cost to get online. Create your store now and choose a paid plan whenever the lower sales fee and added tools make sense."
        image="/images/cta-pricing.webp"
      />
    </>
  );
}
