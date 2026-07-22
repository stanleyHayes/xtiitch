import type { MetaDescriptor } from "react-router";
import Alert from "@mui/material/Alert";
import { pageMeta } from "../components/seo";
import { PageHero, PolicySectionList, Section } from "../components/ui";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Privacy Policy",
    description:
      "How Xtiitch collects, uses, shares, protects and retains business, customer, order, measurement and payment-related information.",
    path: "/privacy",
  });
}

const privacySections = [
  {
    title: "1. Who we are and when this policy applies",
    body: "Xtiitch is operated by XCreativs Technologies in Ghana. This policy applies to xtiitch.com, business.xtiitch.com, Xtiitch storefronts, the business and customer account areas, and related support communications. It explains how we handle personal data when you visit, create or use an account, operate a store, place or track an order, make a payment, or contact us. Questions and rights requests can be sent to support@xtiitch.com.",
  },
  {
    title: "2. Controller and processor roles",
    body: "XCreativs Technologies is the data controller for marketing-site activity, business and customer accounts, subscription billing, platform security, support and operator records. A fashion business is normally the controller of customer, measurement, appointment, order and fulfilment information it enters or receives through its store; Xtiitch processes that information to provide the service on the business’s instructions. Each business remains responsible for telling its customers why it collects their data and for using it lawfully.",
  },
  {
    title: "3. Information we collect",
    body: "Depending on how you use Xtiitch, we collect identity and contact details; account credentials and security settings; business profile, ownership, team and verification information; catalogue, images, sizes and availability; customer contacts, measurements and fitting notes; orders, appointments, delivery and fulfilment records; subscription, invoice and payment metadata; support messages; and device, IP address, browser, log and usage information. We receive information directly from you, from a store you deal with, from authorised team members, and from service providers such as Paystack.",
  },
  {
    title: "4. Why we use personal data",
    body: "We use personal data to create and secure accounts; publish and operate storefronts; manage customers, measurements, orders, appointments and delivery; calculate charges; initialise and verify payments; administer subscriptions; send service messages; provide support; prevent fraud and abuse; maintain audit records; improve reliability and usability; and meet legal, tax, accounting and regulatory duties. We process data where necessary to perform a contract, comply with law, pursue legitimate interests that do not override your rights, or act on consent where consent is required. Marketing communications are optional and can be stopped at any time.",
  },
  {
    title: "5. Payments and financial information",
    body: "Paystack processes card and mobile-money payment details on its payment surfaces. Xtiitch does not receive or store raw card numbers, card security codes or mobile-money PINs. We do receive and retain payment references, amounts, fee and tax breakdowns, status, channel, payer or settlement metadata and provider responses needed to reconcile payments, subscriptions, refunds, disputes and payouts. Xtiitch does not operate a customer wallet or escrow account.",
  },
  {
    title: "6. How we share information",
    body: "We share data only as needed with the fashion business responsible for an order; authorised members of that business; payment, hosting, image, email, messaging, analytics and security providers; professional advisers; and regulators, courts or law-enforcement bodies where lawfully required. Providers may include Paystack for payments and Cloudinary for images. We require providers to handle data for the agreed purpose and apply appropriate confidentiality and security protections. We do not sell personal data.",
  },
  {
    title: "7. International processing",
    body: "Some service providers may process or store information outside Ghana. Where personal data is transferred internationally, we use providers and contractual, organisational or legal safeguards appropriate to the destination and the sensitivity of the data, as required by applicable Ghanaian data-protection law.",
  },
  {
    title: "8. Retention and account closure",
    body: "We retain personal data only for as long as necessary for the purposes in this policy, including while an account is active and for legal, tax, accounting, fraud-prevention, dispute and audit requirements afterwards. Awaiting-payment orders stop appearing to customers and businesses after 24 hours or when the customer closes them, although limited payment and audit records may remain where needed for security, reconciliation or law. When retention is no longer justified, information is deleted, anonymised or securely isolated.",
  },
  {
    title: "9. Security and access",
    body: "We use technical and organisational safeguards appropriate to the data and risk, including encrypted connections, password hashing, role-based access, tenant separation, audit logging, request controls and security monitoring. Businesses must keep account credentials confidential, use appropriate staff roles, remove access promptly when a team member leaves and notify us of suspected compromise. No online service can guarantee absolute security.",
  },
  {
    title: "10. Your rights",
    body: "Subject to the Data Protection Act, 2012 (Act 843), you may ask whether we process your personal data and request access, correction, completion, deletion, restriction or objection where applicable. You may withdraw consent without affecting earlier lawful processing and may ask for a portable copy where the law provides. For store-controlled order or measurement data, we may refer the request to the relevant fashion business and assist it in responding. We may verify identity before acting on a request.",
  },
  {
    title: "11. Children’s information",
    body: "A person must be at least 18 and able to contract to open or administer a business account. Fashion businesses may record garment measurements or order details relating to a child only where the parent, guardian or other authorised adult has provided the information or authorised its collection. Businesses must avoid entering unnecessary information about children. Contact support@xtiitch.com if you believe a child’s data has been handled improperly.",
  },
  {
    title: "12. Complaints, changes and contact",
    body: "Contact support@xtiitch.com with a privacy question, request or complaint. You may also complain to Ghana’s Data Protection Commission. We may update this policy when the service, providers or legal requirements change. Material changes will be highlighted on the service or communicated to account holders, and the effective date will be updated.",
  },
];

export default function Privacy() {
  return (
    <>
      <PageHero
        eyebrow="Privacy Policy"
        title="Your information, handled with care"
        subtitle="This policy explains what Xtiitch collects, why we use it, who receives it and the choices available to businesses and customers."
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
          Effective 22 July 2026. Last updated 22 July 2026.
        </Alert>
        <PolicySectionList items={privacySections} />
      </Section>
    </>
  );
}
