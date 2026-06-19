import type { MetaDescriptor } from "react-router";
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
          eyebrow="Growth add-ons"
          title="Promo, affiliate and sponsored tools sit above the plan"
          subtitle="Plan pricing runs the store. Growth programmes are controlled separately so every code, partner link, and sponsored post has its own approval, ledger, and date window."
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
        body="There’s no monthly cost to get online. Join the waitlist to claim your store."
      />
    </>
  );
}
