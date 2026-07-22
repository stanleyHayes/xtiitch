import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
  StepList,
  TrackingPreview,
} from "../components/ui";
import { steps } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "How it works",
    description:
      "Set up your store, add designs and sizes, share your links, receive orders, take payment, and move work through the stages — with customers tracking along.",
    path: "/how-it-works",
  });
}

const depositRules: string[] = [
  "Standard order — the customer fits one of your size bands and takes the design as shown. The price is known, so it’s paid in full at checkout.",
  "Custom order — measurements or changes mean the full price isn’t known yet, so a deposit confirms the order instead.",
  "The deposit defaults to GHS 1, can be set higher per store or per design, and never goes below GHS 1. It counts towards the final price.",
  "Come to the shop to be measured? No deposit is taken — the order is simply placed and money is arranged directly with you.",
];

export default function HowItWorks() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="From first design to finished garment"
        subtitle="Xtiitch is deliberately simple. Set it up once, then run every order from one dashboard while your customers follow along."
      />

      <Section>
        <StepList items={steps} />
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="Confirming and paying"
          title="Standard orders pay in full. Custom orders take a deposit."
          subtitle="The rule that keeps custom work honest without Xtiitch ever holding your money."
          align="left"
        />
        <Stack spacing={1.5} sx={{ maxWidth: 900 }}>
          {depositRules.map((rule, index) => (
            <Box
              key={rule}
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 1.5,
                p: 2,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "rgba(var(--surface-rgb), 0.78)",
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{
                  width: 30,
                  height: 30,
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
              <Typography sx={{ color: "text.secondary" }}>{rule}</Typography>
            </Box>
          ))}
        </Stack>
        <Chip
          sx={{ mt: 3 }}
          color="primary"
          variant="outlined"
          label="The balance is settled your way — another Xtiitch link, or cash / mobile money off the platform."
        />
      </Section>

      <Section>
        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "center",
          }}
        >
          <Box>
            <SectionHeading
              align="left"
              eyebrow="Tracking"
              title="One simple signal, whatever stages you use"
              subtitle="Behind the scenes you can add, rename or reorder your production stages. The customer always sees the same plain red, yellow or green."
            />
          </Box>
          <Box
            sx={{
              p: { xs: 2, md: 3 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "rgba(var(--surface-rgb), 0.72)",
            }}
          >
            <TrackingPreview />
          </Box>
        </Box>
      </Section>

      <CtaBand
        title="Ready to set up your store?"
        body="Create your store for free and set up your first designs, sizes and production stages."
      />
    </>
  );
}
