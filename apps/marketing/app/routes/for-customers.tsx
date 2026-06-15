import type { MetaDescriptor } from "react-router";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  MeasurementRouteGrid,
  PageHero,
  Section,
  SectionHeading,
  TrackingPreview,
} from "../components/ui";
import { customerPoints, measurementRoutes } from "../content";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "For customers",
    description:
      "Why an Xtiitch tracking and payment link is trustworthy: see where your garment is, pay by mobile money or card, and collect or have it delivered.",
    path: "/for-customers",
  });
}

export default function ForCustomers() {
  return (
    <>
      <PageHero
        eyebrow="For customers"
        title="Got an Xtiitch link? Here’s how it works"
        subtitle="When a fashion business sends you an Xtiitch link, you can browse, order and pay with confidence — and finally see where your garment has reached."
      />

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
              eyebrow="Where is my cloth?"
              title="No more chasing by phone"
              subtitle="After you order, a simple view shows where your garment is — received, being made, or ready — with a rough timeframe. The colour is the headline, so it’s clear at a glance."
            />
          </Box>
          <Box
            sx={{
              p: { xs: 2, md: 3 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "rgba(255,255,255,0.72)",
            }}
          >
            <TrackingPreview />
          </Box>
        </Box>
      </Section>

      <Section alt>
        <SectionHeading eyebrow="The essentials" title="What to expect" />
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1fr 1fr",
              lg: "1fr 1fr 1fr",
            },
          }}
        >
          {customerPoints.map((point, index) => (
            <Box
              key={point.title}
              sx={{
                position: "relative",
                p: 3,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "rgba(255,255,255,0.82)",
                minHeight: 210,
                overflow: "hidden",
              }}
            >
              <Typography
                variant="body2"
                sx={{ color: "primary.main", fontWeight: 800, mb: 1 }}
              >
                {String(index + 1).padStart(2, "0")}
              </Typography>
              <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                {point.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {point.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Getting your size right"
          title="Pick a size, or get measured"
          subtitle="If you fit one of the shop’s sizes, order in one step. If not, choose the way that suits you."
        />
        <MeasurementRouteGrid items={measurementRoutes} />
      </Section>

      <CtaBand
        title="Run a fashion business?"
        body="Give your own customers this experience. Join the waitlist to get your store."
      />
    </>
  );
}
