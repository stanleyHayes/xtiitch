import type { MetaDescriptor } from "react-router";
import Alert from "@mui/material/Alert";
import { pageMeta } from "../components/seo";
import { PageHero, PolicySectionList, Section } from "../components/ui";

export function meta(): MetaDescriptor[] {
  return pageMeta({
    title: "Terms of Service",
    description:
      "Terms governing Xtiitch business accounts, storefronts, subscriptions, customer orders, Paystack payments and platform use.",
    path: "/terms",
  });
}

const termSections = [
  {
    title: "1. Agreement and eligibility",
    body: "These Terms form an agreement between you and XCreativs Technologies, operator of Xtiitch. By creating an account, using a storefront, placing an order or continuing to use the service, you agree to these Terms, the Privacy Policy and Payment Policy. You must be at least 18 and legally able to contract to administer a business account. If you act for a business, you confirm that you have authority to bind it.",
  },
  {
    title: "2. Accounts and authorised users",
    body: "You must provide accurate information, protect credentials and promptly update account and settlement details. Business owners control invitations, staff roles and access within the limit of their plan. You are responsible for activity by authorised users and must remove access when it is no longer needed. Tell support@xtiitch.com promptly if you suspect unauthorised access.",
  },
  {
    title: "3. What Xtiitch provides",
    body: "Xtiitch provides software for storefronts, catalogue and design management, customer records, measurements, orders, production tracking, appointments, delivery, payment initiation, subscription billing, reporting and related communications. Features and limits vary by plan and are described on the pricing page and in the billing dashboard. Xtiitch is not the seller or maker of garments, a bank, wallet, lender or escrow service.",
  },
  {
    title: "4. Fashion businesses are the merchants",
    body: "The business shown on a storefront is the merchant responsible for its catalogue, descriptions, pricing, availability, measurements, taxes, customer communication, fulfilment, garment quality, returns, refunds, delivery and compliance with consumer and trading laws. A business must publish accurate contact and fulfilment information and must not misrepresent its identity, products or capacity. Xtiitch supplies the platform and records workflow but does not become a party to the garment contract.",
  },
  {
    title: "5. Plans, fees and taxes",
    body: "Xtiitch offers Free, Starter, Growth and Studio plans. Current prices, billing cycles, introductory offers, renewal prices, sales-fee rates, team-account limits and included features are shown before selection. Paid subscriptions may include a package charge, Tax fee and payment-provider transaction fee. Online sales can also include the Xtiitch sales fee, Tax fee on that fee, the Paystack transaction fee and a final payout fee as described in the Payment Policy. Taxes and provider rates may change where required by law or the provider; the amount shown before payment controls that charge.",
  },
  {
    title: "6. Activation, renewal, upgrades and downgrades",
    body: "A paid plan activates only after Paystack verifies the required payment. Paid plans renew automatically on the selected quarterly or yearly billing cycle until cancelled or changed. An upgrade requires payment of the amount shown, including any prorated charge, before the higher plan takes effect. A failed or cancelled upgrade does not activate the higher plan. A downgrade is scheduled for the end of the current paid period, so the existing plan remains available until then. The billing dashboard shows the selected plan, effective date and available changes.",
  },
  {
    title: "7. Failed subscription payments and cancellation",
    body: "If a renewal fails, Xtiitch may retry the charge, mark the subscription past due, provide a grace period, restrict paid features or move the business to Free after the grace period. You remain responsible for amounts validly due before cancellation. Cancellation or downgrade does not erase business records, but content above the resulting plan’s limits may become read-only, hidden or unavailable until the account returns within those limits.",
  },
  {
    title: "8. Orders and awaiting payment",
    body: "An order is not paid merely because an awaiting-payment record exists. Awaiting-payment orders expire from the customer and business views after 24 hours and customers may close them earlier. A cancelled or failed Paystack attempt does not charge the customer and may be retried from checkout. A business should begin paid fulfilment only after the platform records provider verification, except where the business knowingly accepts an offline arrangement.",
  },
  {
    title: "9. Payments, refunds and disputes",
    body: "Paystack processes online payments. Xtiitch does not store raw card details or operate escrow. Refund, cancellation, settlement, chargeback and subscription-payment rules are set out in the Payment Policy. The business must respond to customer issues and provide evidence reasonably required for a refund or payment dispute. Xtiitch or Paystack may delay settlement, reverse records or restrict payment functions where a payment is disputed, reversed, suspicious or legally restrained.",
  },
  {
    title: "10. Acceptable use",
    body: "You must not use Xtiitch for unlawful, deceptive, infringing or harmful activity; sell prohibited goods or services; upload malicious code; scrape or interfere with the service; bypass access controls or plan limits; access another business’s data; misuse customer measurements or contacts; create false orders or payment evidence; or use the platform to harass, discriminate or defraud. We may investigate and act on suspected misuse.",
  },
  {
    title: "11. Content and intellectual property",
    body: "You retain ownership of designs, brand assets, photographs and other content you lawfully provide. You grant Xtiitch a non-exclusive, worldwide licence to host, copy, process, resize and display that content only as needed to operate, secure and promote your storefront or a programme you expressly join. You confirm that you have the rights and permissions needed for uploaded content. Xtiitch and its licensors retain all rights in the platform, software, documentation, branding and design system.",
  },
  {
    title: "12. Privacy and confidential information",
    body: "Personal data is handled under the Privacy Policy and applicable Ghanaian law, including the Data Protection Act, 2012 (Act 843). Businesses must collect and use customer data lawfully, limit staff access and respond to customer rights requests. Each party must protect non-public information received through the service and use it only for the purpose for which it was supplied.",
  },
  {
    title: "13. Third-party services",
    body: "The service depends on third parties such as Paystack, hosting, image, email and messaging providers. Their own terms may apply to their services. Xtiitch is not responsible for a third party’s independent acts, but we will use reasonable care in selecting providers and supporting investigation of service failures within our control.",
  },
  {
    title: "14. Suspension and termination",
    body: "We may suspend or terminate access where reasonably necessary to protect users or the platform, investigate fraud or security risk, comply with law or provider rules, address non-payment or stop a serious breach. Where practical, we will give notice and an opportunity to remedy. You may stop using the service and close your account, subject to unresolved payments, disputes, retention duties and the rights of affected customers.",
  },
  {
    title: "15. Availability, warranties and liability",
    body: "We aim to provide a reliable service but do not promise uninterrupted or error-free operation. To the extent permitted by Ghanaian law, Xtiitch is not liable for a business’s products, measurements, pricing, fulfilment, communications or independent conduct, or for indirect or consequential loss that was not reasonably foreseeable. Nothing in these Terms excludes liability that cannot lawfully be excluded, including liability arising from fraud or wilful misconduct, or removes a customer’s mandatory statutory rights.",
  },
  {
    title: "16. Changes, governing law and contact",
    body: "We may update these Terms to reflect product, commercial or legal changes. We will give reasonable notice of material changes before they take effect where practicable. These Terms are governed by the laws of the Republic of Ghana, including applicable electronic-transactions and data-protection law. The parties should first try to resolve a dispute in good faith through support@xtiitch.com; unresolved disputes may be brought before the courts of Ghana.",
  },
];

export default function Terms() {
  return (
    <>
      <PageHero
        eyebrow="Terms of Service"
        title="Clear rules for running a store on Xtiitch"
        subtitle="These terms explain the platform boundary, business responsibilities, subscription changes, payments and acceptable use."
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
        <PolicySectionList items={termSections} />
      </Section>
    </>
  );
}
