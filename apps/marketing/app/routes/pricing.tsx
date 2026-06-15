import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  PageHero,
  PlanCards,
  Section,
  SectionHeading,
} from "../components/ui";
import { plans, pricingNotes } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Pricing",
    description:
      "Free to get online with a 3% share on Xtiitch sales, or Standard at GHS 50/month with a 1% share. Money taken outside Xtiitch carries no fee.",
    path: "/pricing",
  });
}

export default function Pricing() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Small monthly fee, small share of online sales"
        subtitle="Priced for real Ghanaian SME budgets. A free tier removes the wall for the smallest shops; the paid tier lowers your share as you grow."
      />

      <Section>
        <PlanCards items={plans} />
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="The fine print, in plain words"
          title="How the fee actually works"
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
                bgcolor: "rgba(255,255,255,0.78)",
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
        body="There’s no monthly cost to get online. Join the waitlist to claim your store."
      />
    </>
  );
}
