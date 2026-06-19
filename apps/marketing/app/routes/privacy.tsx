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
    title: "Who is responsible for your data (controller vs processor)",
    body: "For account, waitlist and platform data, Xtiitch (XCreativs Technologies) is the data controller. For the customer, order and measurement records a business records inside its own store, that business is the data controller and Xtiitch acts as its data processor — handling the data only on the business’s instructions to run the service. This follows the controller/processor roles set out in the Data Protection Act, 2012 (Act 843).",
  },
  {
    title: "What we collect",
    body: "Waitlist: the name, business name, phone, optional email, town or city and any message you submit. In the product: business setup details; customer contact details; order, catalogue and measurement information; delivery and booking choices; payment metadata (never raw card details); and technical data such as device, log and usage information needed for security and reliability.",
  },
  {
    title: "Why we use it and our lawful basis",
    body: "We process data to deliver the contract you or your business asked for (set up stores, process orders, show tracking, support payments, send service notifications); for our legitimate interest in keeping the service secure and preventing misuse; with your consent for optional marketing or non-essential contact; and to meet legal, tax and accounting obligations. You can withdraw consent for marketing at any time.",
  },
  {
    title: "Payments",
    body: "Paystack collects payments on its own PCI-compliant surfaces. Xtiitch never receives or stores raw card details and does not operate a wallet or hold customer funds in escrow — it only records payment state.",
  },
  {
    title: "Tenant isolation",
    body: "Each business’s data is scoped to that business and enforced at the database layer (row-level security). Tenant isolation across customer, order, measurement, catalogue and money records is a release-blocking security requirement; one business can never read another’s data.",
  },
  {
    title: "How we keep data secure",
    body: "Data is encrypted in transit (TLS); passwords are hashed with bcrypt, never stored in plain text; access follows least-privilege principles; sensitive operator actions are audit-logged; and the platform applies conservative security headers, request limits and dependency-vulnerability scanning.",
  },
  {
    title: "How long we keep it",
    body: "We keep personal data only as long as needed to provide the service and to meet legal, tax and accounting obligations, after which it is deleted or anonymised. Waitlist contacts are removed on request. Exact retention periods per data category are being finalised and will be published before public launch.",
  },
  {
    title: "Your rights under Act 843",
    body: "Subject to the Data Protection Act, 2012, you may request access to your personal data, ask us to correct or delete it, object to or restrict certain processing, ask for a portable copy, and withdraw consent. For data a business holds in its store, we forward such requests to that business as the controller. We will respond within the time the law allows.",
  },
  {
    title: "Service providers and international transfers",
    body: "We rely on vetted providers to run the service — for example Paystack (payments), Cloudinary (image hosting), an email delivery provider and cloud infrastructure. Some of these process data outside Ghana; where they do, we use providers that apply appropriate security and contractual safeguards.",
  },
  {
    title: "Children",
    body: "Xtiitch is a business tool and is not directed at children. We do not knowingly collect personal data from anyone under 18; if you believe a child’s data has been shared with us, contact us and we will remove it.",
  },
  {
    title: "Contact and complaints",
    body: "For privacy questions or to exercise your rights, contact Xtiitch’s data-protection point of contact (published with the final policy before launch). You also have the right to lodge a complaint with the Data Protection Commission of Ghana.",
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
