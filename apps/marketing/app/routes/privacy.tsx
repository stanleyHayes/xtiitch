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
    title: "Privacy",
    description:
      "How Xtiitch plans to handle waitlist, business, customer, order, measurement and payment-related information.",
    path: "/privacy",
  });
}

const privacySections = [
  {
    title: "What we collect",
    body: "For the waitlist we collect the details you submit: your name, business name, phone, optional email, town or city, and any message. In the product, Xtiitch will also process business setup details, customer contact details, order information, measurements, delivery choices, booking details and payment metadata needed to run the service.",
  },
  {
    title: "How we use it",
    body: "We use this information to contact businesses about onboarding, set up stores, process orders, show customer tracking views, support payments, send notifications, prevent misuse, maintain security and keep service records.",
  },
  {
    title: "Payments",
    body: "Paystack handles payment collection on its own secure surfaces. Xtiitch does not receive or store raw card details and does not operate a wallet or escrow balance.",
  },
  {
    title: "Business boundaries",
    body: "Each business’s data is scoped to that business. Tenant isolation is a release-blocking security requirement for customer, order, measurement, catalogue and money records.",
  },
  {
    title: "Your choices",
    body: "Before public launch, Xtiitch will publish the final support channel for access, correction, deletion and consent questions. Waitlist contacts can ask us to stop contacting them at any time.",
  },
];

export default function Privacy() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Privacy, written plainly"
        subtitle="Xtiitch handles sensitive business and customer data, including measurements. The product is being built with tenant isolation, limited data access and Ghana data-protection review in mind."
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
          This is a launch-draft privacy notice for implementation and legal
          review. Final privacy terms must be approved before public launch.
        </Alert>
        <PolicySectionList items={privacySections} />
      </Section>

      <Section alt>
        <SectionHeading
          align="left"
          eyebrow="Before launch"
          title="What still needs final legal review"
          subtitle="The final privacy policy must confirm Xtiitch’s data controller/processor roles, retention periods, support contacts, international service providers, incident process and user rights under applicable Ghana law."
        />
      </Section>
    </>
  );
}
