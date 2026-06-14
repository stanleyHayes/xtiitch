# Ghana Legal And Compliance Engineering Guide

This guide is an engineering checklist for Xtiitch. It is not legal advice. Before live launch, Ghana-qualified counsel and a tax professional should review the product, payment model, terms, privacy notice, refund policy, and subscription billing.

## Jurisdiction Assumption

The product is built for Ghanaian fashion businesses and customers, takes payment in Ghana Cedis, and uses Paystack for Ghana payment flows. Treat Ghana as the primary compliance jurisdiction unless the business model changes.

## Primary Sources To Review

- Data Protection Commission: https://dataprotection.org.gh/
- Data Protection Act, 2012 (Act 843): https://nita.gov.gh/wp-content/uploads/2017/12/Data-Protection-Act-2012-Act-843.pdf
- Bank of Ghana Payment Systems and Services Act, 2019 (Act 987): https://www.bog.gov.gh/wp-content/uploads/2019/08/Payment-Systems-and-Services-Act-2019-Act-987-.pdf
- Bank of Ghana approved PSP list: https://www.bog.gov.gh/news/list-of-approved-electronic-money-issuers-and-payment-service-providers/
- Cybersecurity Act, 2020 (Act 1038): https://www.csa.gov.gh/
- Electronic Transactions Act, 2008 (Act 772): https://nita.gov.gh/wp-content/uploads/2017/12/Electronic-Transactions-Act-772.pdf
- Ghana Revenue Authority e-commerce guidance: https://gra.gov.gh/file-and-pay-taxes/e-commerce/
- Paystack split payments docs: https://paystack.com/docs/payments/split-payments/
- PCI Security Standards Council PCI DSS: https://www.pcisecuritystandards.org/standards/pci-dss/

## Data Protection

Engineering requirements:

- Register Xtiitch with Ghana's Data Protection Commission as needed before processing live personal data.
- Maintain a public privacy notice before launch.
- Collect only data required for accounts, orders, measurements, payments, delivery, support, security, and legal obligations.
- Keep customer identity global, but expose customer data to a business only through tenant-scoped orders and relationships.
- Protect measurements, settlement details, identity details, contact information, and order history as sensitive personal data.
- Encrypt secrets and sensitive operational values.
- Use TLS in transit.
- Define retention rules for accounts, measurements, order records, payment records, audit logs, and deleted media.
- Implement account access, correction, deletion, and export request workflows before public launch.
- Keep processor records for Paystack, Cloudinary, Resend, Render, Vercel, Expo, and any analytics provider.
- Review cross-border processing and processor agreements before launch.

Do not:

- Use production customer data in local development.
- Expose customer activity across businesses.
- Log raw personal data, card data, tokens, webhook secrets, or settlement details.

## Payments And Financial Regulation

The product posture is direct settlement through Paystack. Xtiitch must not hold funds.

Engineering requirements:

- Use Paystack-hosted or Paystack-controlled payment collection for cards and mobile money.
- Use Paystack subaccounts/splits for business settlement and platform commission.
- Verify Paystack webhooks before changing money state.
- Make webhook processing idempotent.
- Store Paystack references needed for reconciliation.
- Store commission amount and provider fees in exact GHS minor units.
- Keep manual takings separate from platform payments.
- Keep subscription billing separate from customer order settlement.
- Add legal review before introducing escrow, wallet, stored balance, pooled funds, delayed settlement, or platform-managed payouts.

Do not:

- Store card numbers, CVV, PINs, or raw payment credentials.
- Treat client-side payment success as final.
- Move business funds through an Xtiitch bank or mobile money account.

## E-Commerce Consumer Information

Public storefront and checkout flows should clearly show:

- Business display name and contact channel.
- Product title, images, description, size/measurement path, and price in GHS.
- Whether the item is ready-made, made-to-measure, or custom.
- Deposit amount and whether it is required.
- Delivery or pickup options.
- Delivery fees where known.
- Expected stage/status language.
- Refund, cancellation, alteration, and dispute policy.
- Subscription/package terms for businesses.

Before launch, counsel should approve:

- Customer terms.
- Business terms.
- Refund/cancellation policy.
- Privacy notice.
- Paystack/payment disclosures.
- Subscription auto-renewal and cancellation wording.

## Cybersecurity

Engineering requirements:

- Maintain an incident response runbook.
- Log security-relevant events without leaking secrets or sensitive data.
- Rotate compromised credentials.
- Keep dependency and container vulnerability scanning in CI once packages are installed.
- Use role-based access for business users.
- Require tenant isolation tests for critical paths.
- If Xtiitch is ever designated critical information infrastructure, add the reporting and audit obligations required by the Cybersecurity Act.

## Tax And Invoicing

Engineering requirements:

- Keep platform commissions and subscription fees reportable.
- Keep business order payment records exportable.
- Do not present v1 money tracker as tax accounting.
- Add invoice/tax document support only after tax professional review.
- Review VAT and digital/e-commerce obligations before live billing.

## Launch Blockers

Do not launch publicly until these are complete:

- Privacy notice approved.
- Terms approved.
- Refund/cancellation policy approved.
- Paystack live account/subaccount flow verified.
- Data Protection Commission registration decision complete.
- Processor list reviewed.
- Incident response runbook written.
- SonarQube quality gate passing.
- Critical tests passing.
- No known tenant isolation defects.
- No code path that stores card data or holds customer/business funds.

