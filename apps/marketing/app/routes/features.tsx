import { Link as RouterLink, type MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  Eyebrow,
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
      "Storefront, catalogue, orders, tracking, payments, bookings, money tracker, notifications, plan-based branding, design waiting lists and two-step security — everything a Ghanaian fashion business needs in one dashboard.",
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
            gap: { xs: 3, md: 5 },
            gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" },
            alignItems: "stretch",
            p: { xs: 2.5, md: 4 },
            border: "1px solid",
            borderColor: "rgba(128,0,32,0.16)",
            borderRadius: 2,
            bgcolor: "rgba(var(--surface-rgb), 0.82)",
            boxShadow: "0 26px 70px -56px rgba(21,17,26,0.56)",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Eyebrow>Growth layer</Eyebrow>
            <Typography variant="h3" component="h2" sx={{ mt: 0.5 }}>
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
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ mt: 3, alignSelf: "flex-start" }}
            >
              See growth programmes
            </Button>
          </Box>
          <Box sx={{ display: "grid", gap: 1.25 }}>
            {growthProgrammes.map((programme) => (
              <Box
                key={programme.title}
                sx={{
                  display: "flex",
                  gap: 1.75,
                  p: { xs: 1.5, md: 2 },
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  transition: "border-color 180ms ease, transform 180ms ease",
                  "&:hover": {
                    borderColor: "rgba(128,0,32,0.28)",
                    transform: "translateX(3px)",
                  },
                }}
              >
                <Box
                  aria-hidden
                  sx={{
                    flexShrink: 0,
                    mt: 0.3,
                    px: 1,
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 1,
                    bgcolor: "rgba(128,0,32,0.08)",
                    color: "primary.main",
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {programme.label}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
                    {programme.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 0.25,
                      color: "text.secondary",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {programme.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
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
        body="Start for free and set up your store, sizes and first designs today."
        image="/images/cta-features.webp"
      />
    </>
  );
}
