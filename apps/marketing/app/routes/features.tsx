import { Link as RouterLink, type MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  FeatureGrid,
  MeasurementRouteGrid,
  PageHero,
  Section,
  SectionHeading,
} from "../components/ui";
import { features, growthProgrammes, measurementRoutes } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Features",
    description:
      "Storefront, catalogue, orders, tracking, payments, bookings, money tracker and notifications — everything a Ghanaian fashion business needs in one dashboard.",
    path: "/features",
  });
}

export default function Features() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Run the whole business from one place"
        subtitle="Every feature is a switch, so each shop shapes Xtiitch to its own way of working — bespoke or ready-made, with collections or without, delivery on or off."
      />

      <Section>
        <FeatureGrid items={features} />
        <Box
          sx={{
            mt: { xs: 5, md: 7 },
            display: "grid",
            gap: { xs: 3, md: 4 },
            gridTemplateColumns: { xs: "1fr", lg: "0.8fr 1.2fr" },
            alignItems: "start",
            p: { xs: 2.5, md: 3.5 },
            border: "1px solid",
            borderColor: "rgba(128,0,32,0.16)",
            borderRadius: 1,
            bgcolor: "rgba(var(--surface-rgb), 0.82)",
            boxShadow: "0 26px 70px -56px rgba(21,17,26,0.56)",
          }}
        >
          <Box>
            <Typography
              component="p"
              sx={{
                color: "primary.main",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0,
              }}
            >
              Growth layer
            </Typography>
            <Typography variant="h3" component="h2" sx={{ mt: 1 }}>
              Campaigns, partners and sponsored discovery sit on top.
            </Typography>
            <Typography sx={{ mt: 1.5, color: "text.secondary" }}>
              Once a store is running, Xtiitch can help the business promote
              specific designs, reward referrals, track partner links and appear
              in labelled sponsored slots.
            </Typography>
            <Button
              component={RouterLink}
              to="/growth"
              variant="contained"
              sx={{ mt: 2.5 }}
            >
              See growth programmes
            </Button>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ flexWrap: "wrap", alignItems: "center" }}
          >
            {growthProgrammes.map((programme) => (
              <Chip
                key={programme.title}
                label={`${programme.label}: ${programme.title}`}
                variant="outlined"
                sx={{
                  minHeight: 40,
                  px: 0.5,
                  bgcolor: "background.paper",
                  borderColor: "divider",
                  "& .MuiChip-label": { py: 0.5 },
                }}
              />
            ))}
          </Stack>
        </Box>
      </Section>

      <Section alt>
        <SectionHeading
          eyebrow="Sizes and measurement"
          title="Sizing is yours, not a fixed platform standard"
          subtitle="Set up your own size bands and charts. A customer who fits one orders in a single step; anyone else is measured in whichever of these ways suits them."
        />
        <MeasurementRouteGrid items={measurementRoutes} />
      </Section>

      <CtaBand
        title="See it working for your shop"
        body="Join the waitlist and we’ll help you set up your store, sizes and first designs."
      />
    </>
  );
}
