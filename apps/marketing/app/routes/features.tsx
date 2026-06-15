import type { MetaDescriptor } from "react-router";
import { pageMeta } from "../components/seo";
import {
  CtaBand,
  FeatureGrid,
  MeasurementRouteGrid,
  PageHero,
  Section,
  SectionHeading,
} from "../components/ui";
import { features, measurementRoutes } from "../content";

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
