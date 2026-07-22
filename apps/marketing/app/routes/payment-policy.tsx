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
    title: "Payment Policy",
    description:
      "How Xtiitch handles checkout charges, awaiting-payment orders, settlements, refunds, subscriptions, upgrades, downgrades and disputes.",
    path: "/payment-policy",
  });
}

const customerPaymentSections = [
  {
    title: "1. Payment roles",
    body: "The fashion business named on the storefront is the merchant for the garment or service. Paystack provides the card and mobile-money payment service. Xtiitch calculates and displays the checkout total, sends the payment request to Paystack, verifies the provider result and records the order workflow. Xtiitch does not store raw card details, operate a customer wallet or hold funds in escrow.",
  },
  {
    title: "2. What the customer may pay",
    body: "The order subtotal covers the selected products, services and delivery. Xtiitch’s sales fee is currently 3% on Free, 1.5% on Starter, 1% on Growth and 0.5% on Studio, subject to the platform’s per-design cap. Paystack’s current transaction-fee rate is 1.95%. A Tax fee is calculated at the configured tax rate on the Xtiitch fee; the current standard configuration is 20%. A store can choose whether the customer or the business bears the Xtiitch fee, Tax fee and Paystack transaction fee. Checkout shows only the fee lines passed to the customer and displays the final total before payment.",
  },
  {
    title: "3. Authorisation, cancellation and failed payment",
    body: "Selecting Pay opens Paystack so the customer can authorise the displayed amount. An order is paid only after Xtiitch receives and verifies a successful provider result. Cancelling or abandoning Paystack, a declined payment, an expired session or a verification failure does not complete the order and should not result in a successful charge. The customer may return to checkout and try again. If an account appears charged without a successful order, contact the business and support@xtiitch.com with the Paystack reference.",
  },
  {
    title: "4. Awaiting-payment orders",
    body: "An awaiting-payment order is a temporary checkout record, not proof of payment. It remains available for up to 24 hours so the customer can retry. After 24 hours it disappears from both the customer account and the business Orders view. A signed-in customer may close it earlier using the Close action, which removes it from both views. Limited technical or audit data may be retained for fraud prevention, reconciliation and legal obligations.",
  },
  {
    title: "5. Settlement to the business",
    body: "Successful online payments settle through Paystack’s payment and settlement infrastructure to the business’s verified settlement destination, after applicable Xtiitch fees, Tax fee, Paystack charges, refunds and reversals. For eligible mobile-money settlements, Paystack may also deduct its approximately GHS 1 payout fee from the business’s settlement; this is a per-settlement provider charge, not a per-order customer fee. Settlement timing depends on provider processing, banking calendars, verification and risk checks. Paystack or Xtiitch may delay or restrict settlement where a payment is disputed, reversed, suspicious, incorrectly configured or subject to law or provider rules.",
  },
  {
    title: "6. Refund requests",
    body: "A customer should first request a refund from the business responsible for the order. The business must review the order status, work completed, delivery evidence and customer communication, then approve a full or partial Paystack refund or another lawful resolution where appropriate. Refunds are generally expected for a confirmed duplicate or incorrect charge, an unavailable paid item, a business cancellation before work begins, or confirmed non-fulfilment. Provider and bank processing times apply after approval.",
  },
  {
    title: "7. Ready-made orders, bespoke work and visits",
    body: "A ready-made order may be cancelled before fulfilment or dispatch, subject to the business’s disclosed return conditions and mandatory customer rights. Bespoke deposits may reserve materials, production time, measurements or an appointment and are not automatically refundable after agreed work or sourcing begins, unless the business caused the cancellation, approves an exception or law requires a refund. A business-cancelled paid visit should be rescheduled or refunded; customer-requested changes and missed appointments follow the disclosed booking conditions.",
  },
  {
    title: "8. Chargebacks and payment disputes",
    body: "A customer may have rights to dispute a payment through the payment provider or financial institution. The business must provide accurate order, delivery and communication evidence when requested. A chargeback, refund or reversal can change an order’s payment state, reduce a future settlement and void related rewards, referrals, commissions or promotional benefits. Fraudulent or abusive disputes may lead to account restrictions and lawful recovery action.",
  },
];

const subscriptionPaymentSections = [
  {
    title: "1. Subscription checkout",
    body: "Paid business plans are billed on the quarterly or yearly cycle selected before Paystack checkout. The billing screen shows the package amount, Tax fee, transaction fee, introductory price where applicable, renewal amount and total due. The plan activates only after Xtiitch verifies a successful Paystack payment. Closing, cancelling or failing checkout leaves the current plan unchanged and allows a retry.",
  },
  {
    title: "2. Renewal and discounts",
    body: "Paid plans renew automatically on the selected billing cycle at the renewal price shown during purchase, unless changed or cancelled. An introductory or discount-code price applies only for the period and eligibility disclosed; it does not permanently replace the renewal price. Xtiitch may validate, limit, expire or withdraw a code where its conditions are not met or it is misused.",
  },
  {
    title: "3. Upgrades",
    body: "An upgrade to a higher-priced plan requires payment before activation. Xtiitch calculates the amount due for the remaining paid period, adds the applicable Tax fee and transaction fee, and opens Paystack checkout. The higher plan and its entitlements take effect only after provider verification. A cancelled, declined or unverified upgrade leaves the existing plan active and can be retried.",
  },
  {
    title: "4. Downgrades",
    body: "A downgrade does not require an immediate payment and is scheduled for the next renewal date. The current paid plan remains active until the end of its paid period, when the lower plan and its fees and limits take effect. The business can review the pending change in billing. Content or team access above the lower plan’s limits may become unavailable or require adjustment when the downgrade becomes effective.",
  },
  {
    title: "5. Failed renewals, grace and cancellation",
    body: "If renewal fails, Xtiitch may retry payment and place the subscription in a grace or past-due state. Paid features may be restricted and the business may be moved to Free when the grace period expires. A cancellation stops future renewal in accordance with the effective date shown in billing but does not reverse a valid charge already used for a billing period. Mandatory refund rights and confirmed billing errors are not affected.",
  },
  {
    title: "6. Billing errors and support",
    body: "Review the amount, plan, cycle and renewal terms before authorising payment. Report a duplicate charge, wrong plan, missing verified upgrade or other billing error promptly to support@xtiitch.com with the business name and payment reference. We may request identity or account verification before discussing or changing billing information.",
  },
];

export default function PaymentPolicy() {
  return (
    <>
      <PageHero
        eyebrow="Payment Policy"
        title="Checkout, payouts and subscriptions"
        subtitle="A clear record of who charges what, when an order is paid, how refunds work, and when plan changes take effect."
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
          Effective 22 July 2026. Last updated 22 July 2026. Amounts and rates
          shown at checkout control the payment you authorise.
        </Alert>
        <SectionHeading
          align="left"
          eyebrow="Customer orders"
          title="Checkout, settlement, refunds and disputes"
          subtitle="The business owns fulfilment, Paystack processes payment, and Xtiitch keeps both sides in sync."
        />
        <PolicySectionList items={customerPaymentSections} />
      </Section>

      <Section alt>
        <SectionHeading
          align="left"
          eyebrow="Business billing"
          title="Plan activation and changes"
          subtitle="Paid access follows verified payment: upgrades activate after payment and downgrades wait until the current paid period ends."
        />
        <PolicySectionList items={subscriptionPaymentSections} />
      </Section>
    </>
  );
}
