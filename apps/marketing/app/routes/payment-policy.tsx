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
    title: "Payment policy",
    description:
      "How Xtiitch handles order cancellations, customer refunds, deposits, subscriptions, chargebacks and payment records.",
    path: "/payment-policy",
  });
}

const customerPaymentSections = [
  {
    title: "Where payments go",
    body: "Customer payments are processed by Paystack and settle to the fashion business that accepted the order. Xtiitch does not hold customer money, run escrow, keep wallet balances or store raw card details.",
  },
  {
    title: "Refund requests",
    body: "A customer starts a refund request with the business that owns the order. The business reviews the order state, work already completed, delivery status and customer communication, then confirms whether a provider refund or direct resolution is appropriate.",
  },
  {
    title: "When a refund is expected",
    body: "A refund or reversal is expected when a duplicate or incorrect charge is confirmed, a business cancels before work begins, an unavailable item was paid for, or the business confirms it cannot fulfil the paid order.",
  },
  {
    title: "Bespoke deposits",
    body: "Custom-order and home-visit deposits reserve work, materials, time or a measuring slot. Once measurement work, cutting, sourcing or visit preparation has started, the deposit is not automatically refundable unless the business approves an exception or caused the cancellation.",
  },
  {
    title: "Ready-made cancellations",
    body: "A ready-made order can be cancelled before the business starts fulfilment or dispatch. Once the item is prepared, dispatched or collected, the customer must resolve changes with the business under the business's own garment policy.",
  },
  {
    title: "Visit changes",
    body: "Home-visit bookings are moved or cancelled by contacting the business. If a paid visit is cancelled by the business, the customer should receive a new slot or an approved refund path. If the customer misses the slot, the business may keep the deposit.",
  },
];

const platformPaymentSections = [
  {
    title: "Subscription renewal",
    body: "Paid business packages renew on their billing cycle until cancelled or downgraded. Failed renewal attempts can put a subscription into grace or past-due status, and expired grace periods move the business back to the Free package.",
  },
  {
    title: "Business cancellation",
    body: "When a paid package is cancelled by an owner, an operator or an expired grace sweep, the business returns to the Free package. Paid package limits and fee settings no longer apply as current entitlement after cancellation.",
  },
  {
    title: "Chargebacks and disputes",
    body: "If Paystack or a card network opens a dispute, Xtiitch can review the payment record, order trail, customer communication, promotions, referrals and affiliate attribution. Reversed payments can void related rewards and commissions.",
  },
  {
    title: "Operator audit trail",
    body: "Admin reversals, dispute decisions, reward voiding and subscription changes are recorded with operator identity and reason. The record exists so support, finance and business owners can inspect what changed.",
  },
  {
    title: "No funds held by Xtiitch",
    body: "Xtiitch records the workflow, but the refund movement itself happens through the payment provider or the business's agreed direct channel. The platform does not pay customers from an escrow balance.",
  },
  {
    title: "Legal approval gate",
    body: "This launch policy must still receive final legal and owner approval before live public payments. Product readiness can show that the policy exists, but legal sign-off remains a separate launch gate.",
  },
];

export default function PaymentPolicy() {
  return (
    <>
      <PageHero
        eyebrow="Payment policy"
        title="Refunds, cancellations and payment records"
        subtitle="A practical policy for the money flows Xtiitch actually supports: Paystack checkout, business-owned fulfilment, bespoke deposits, package subscriptions and dispute records."
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
          This is the launch payment-policy draft for implementation and legal
          review. It keeps Xtiitch's no-funds-held boundary clear while giving
          customers and businesses a shared operating rule before live payments.
        </Alert>
        <SectionHeading
          align="left"
          eyebrow="For customers"
          title="Order refunds and cancellations"
          subtitle="Customers see the same basic rule everywhere: the business owns the order, Xtiitch records the workflow, and provider-confirmed reversals are reflected in the platform."
        />
        <PolicySectionList items={customerPaymentSections} />
      </Section>

      <Section alt>
        <SectionHeading
          align="left"
          eyebrow="For businesses and operators"
          title="Subscriptions, disputes and audit trail"
          subtitle="Business package changes, failed renewal handling, disputes and reward reversals stay visible to admins without turning Xtiitch into an escrow or wallet."
        />
        <PolicySectionList items={platformPaymentSections} />
      </Section>
    </>
  );
}
