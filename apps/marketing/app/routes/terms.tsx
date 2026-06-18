import type { MetaDescriptor } from "react-router";
import Alert from "@mui/material/Alert";
import { pageMeta } from "../components/seo";
import {
  PageHero,
  PolicySectionList,
  Section,
  SectionHeading,
} from "../components/ui";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Terms",
    description:
      "Launch-draft terms for Xtiitch business subscriptions, customer orders, Paystack payments and platform boundaries.",
    path: "/terms",
  });
}

const termSections = [
  {
    title: "Service boundary",
    body: "Xtiitch is a fashion-business operating system: storefront, catalogue, orders, tracking, payments, subscriptions, bookings, notifications and money records. Version one is not a general marketplace, escrow service, wallet, lending product, POS, inventory system or full accounting product.",
  },
  {
    title: "Business subscriptions",
    body: "Businesses can choose available subscription packages. The Free and Standard plans are the first planned public packages; Growth is a future package and should not be sold until it is enabled in the product and billing flow.",
  },
  {
    title: "Payments and funds",
    body: "Customer payments are processed through Paystack. Xtiitch does not hold customer or business funds, does not store raw card details and does not run escrow. Platform commissions and Paystack charges are shown in pricing and payment flows before live launch.",
  },
  {
    title: "Orders and fulfilment",
    body: "Each fashion business remains responsible for its designs, prices, measurements, fulfilment, delivery, pickup, customer communication and garment quality. Xtiitch provides the software workflow and customer tracking surface.",
  },
  {
    title: "Refunds and cancellations",
    body: "Refunds, order cancellations, subscription changes and disputes follow the public payment policy. Because Xtiitch does not hold funds, provider-confirmed reversals are handled through the business payment flow and recorded by the platform.",
  },
  {
    title: "Acceptable use",
    body: "Businesses must provide real settlement and identity information, must not upload misleading or unlawful content, and must not attempt to access another business’s customers, orders, payments or store records.",
  },
];

export default function Terms() {
  return (
    <>
      <PageHero
        eyebrow="Terms"
        title="Terms that match the product boundary"
        subtitle="The terms are being written around the clearest Xtiitch rule: the platform helps fashion businesses run work, but it does not hold funds or become the merchant of every garment."
      />

      <Section>
        <Alert
          severity="info"
          sx={{
            mb: 4,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(49,95,143,0.08)",
          }}
        >
          This is a launch-draft terms page for implementation and legal review.
          Final terms and payment-policy language must be approved before public
          launch.
        </Alert>
        <PolicySectionList items={termSections} />
      </Section>

      <Section alt>
        <SectionHeading
          align="left"
          eyebrow="Before launch"
          title="Policies that must be finalized"
          subtitle="The payment policy now covers refunds, cancellations, subscription renewal, failed payments and chargebacks. Final legal review, support SLAs and business verification requirements must still be approved before the site is public."
        />
      </Section>
    </>
  );
}
