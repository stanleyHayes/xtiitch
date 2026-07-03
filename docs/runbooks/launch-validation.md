# Launch Validation Runbook

This runbook turns the remaining launch gates in `agent_plan.md` into repeatable
checks. Do not commit secrets or provider screenshots that expose tokens.

## Preflight

Run from a clean checkout of `main`:

```sh
git status --short --branch
pnpm install --frozen-lockfile
pnpm test
pnpm check
```

Confirm the deployment environment has the required secrets without printing
their values:

```sh
pnpm launch:check -- --warn-only
```

## Sonar Quality Gate

Set the real SonarQube or SonarCloud values in the shell or CI secrets:

```sh
SONAR_HOST_URL=https://sonarcloud.io \
SONAR_ORGANIZATION=<organization> \
SONAR_TOKEN=<token> \
pnpm sonar
```

Pass evidence:

- Scanner exits zero.
- Quality gate is passing in Sonar.
- Any security hotspot is reviewed or linked to a tracked blocker.

## Paystack Sandbox

Use Paystack test credentials only. Keep the API pointed at the app-role
database user so row-level security is still exercised.

Required environment:

```sh
PAYSTACK_SECRET_KEY=<test-secret>
PAYSTACK_WEBHOOK_SECRET=<test-webhook-secret>
BUSINESS_DASHBOARD_BASE_URL=https://app.xtiitch.test
```

First confirm the configured key can initialize a hosted checkout and that the
local webhook signing secret can produce the Paystack HMAC shape:

```sh
pnpm smoke:paystack
```

This smoke only proves the provider key can initialize hosted checkout and that
the local webhook secret signs events in Paystack's shape. Full storefront
checkout still requires each sandbox business in the smoke to have a real
Paystack subaccount code, not a local `DEV_SUB_*` seed value.

Smoke sequence:

1. Verify or create a sandbox business and confirm subaccount provisioning.
2. Place a standard storefront order and complete a sandbox card or MoMo charge.
3. Place a custom-order deposit and confirm the webhook moves the order out of draft.
4. Issue a subscription invoice/payment link from admin and reconcile a success webhook.
5. Attach a reusable authorization reference and run the recurring charge sweep.
6. Collect a sponsored-placement payment from admin and reconcile the payment event.
7. Replay a duplicate webhook and confirm idempotency: no double settlement, no double reward.
8. Trigger a failed payment event and confirm pending promotion/referral rows are voided.

Pass evidence:

- Paystack dashboard shows the expected split/subaccount routing.
- API payment rows show exact integer pesewas, provider reference, status, and tenant.
- Orders/subscriptions/ads move only through webhook-confirmed states.
- No code path creates a wallet, escrow, pooled balance, or Xtiitch-held customer funds.

## Notification Provider Sandbox

Use WhatsApp Cloud credentials for the primary Ghana customer channel, or an
approved HTTP/SMS provider sandbox endpoint that behaves like production.

For WhatsApp Cloud:

```sh
NOTIFICATION_TRANSPORT=whatsapp_cloud \
WHATSAPP_PHONE_NUMBER_ID=<meta-phone-number-id> \
WHATSAPP_ACCESS_TOKEN=<meta-access-token> \
WHATSAPP_VERIFY_TOKEN=<webhook-verify-token> \
WHATSAPP_APP_SECRET=<meta-app-secret> \
pnpm launch:check -- --warn-only
pnpm smoke:whatsapp
```

For a generic provider gateway:

```sh
DATABASE_URL=<app-role-database-url> \
NOTIFICATION_TRANSPORT=http \
NOTIFICATION_HTTP_URL=https://provider.example/messages \
NOTIFICATION_HTTP_AUTH_HEADER=Authorization \
NOTIFICATION_HTTP_AUTH_VALUE="Bearer <token>" \
NOTIFICATION_FROM=Xtiitch \
pnpm dev:worker
```

Smoke sequence:

1. Enqueue or trigger `order_confirmed`, `order_fulfilled`, `booking_confirmed`,
   `balance_paid`, `handover_dispatched`, and `handover_completed` messages.
2. Confirm successful provider responses store `provider_response` and
   `provider_message_id` on `outbound_messages`.
3. Confirm a forced non-2xx provider response retries and eventually dead-letters
   only after `OUTBOX_MAX_ATTEMPTS`.
4. Confirm provider-approved message templates match the rendered lifecycle copy.

Pass evidence:

- At least one successful sandbox message per lifecycle kind.
- One forced failure path proves retry/dead-letter behavior.
- No notification failure blocks payment or order state transitions.

## Marketing Waitlist Delivery

The marketing form POSTs to the API (`POST /v1/marketing/waitlist`). Every lead
is stored in the `waitlist_leads` table and shown in admin → Waitlist, so
capture works as soon as the API is deployed — the marketing app only needs
`XTIITCH_API_URL`, no waitlist-specific config.

To also email each lead, set these on the **API** (recommended, not required —
leads are never lost since they persist to the DB):

```sh
RESEND_API_KEY=<key>
RESEND_FROM_EMAIL=Xtiitch <hello@xtiitch.com>
MARKETING_WAITLIST_EMAIL_TO=xcreativscompany@gmail.com
```

Smoke sequence:

1. Submit the marketing contact/waitlist form with a real test lead.
2. Confirm the lead appears in admin → Waitlist (and an email arrives if Resend is configured).
3. Submit with the honeypot field filled and confirm it is rejected or ignored.
4. Confirm town/city is required, and that a graceful error shows if the API is unreachable.

## Legal And Policy Sign-Off

Before public launch, collect owner and qualified legal sign-off for:

- Privacy notice.
- Terms of service.
- Payment, refund, cancellation, subscription renewal, and chargeback policy.
- Data Protection Commission registration decision.
- Processor list: Paystack, Cloudinary, Resend, Render, Vercel, Expo, notification provider.
- No-wallet/no-escrow/no-pooled-balance product boundary.

Record the approver, date, document version, and any conditions in the launch
ticket. Do not represent policy text as legally approved until this is complete.
Set `XTIITCH_LEGAL_REVIEW_CONFIRMED=true` only after that approval is recorded;
the admin Launch Readiness screen will then move this gate to ready.

## Growth Policy Decisions

The growth code paths are built, but launch needs owner sign-off for:

- Default funding for business promotions.
- Whether platform-wide admin promotions are opt-in per business.
- Affiliate payout KYC and minimum payout policy.
- Sponsored placement pricing model and rate card.
- Whether referral vouchers are store-scoped or platform-wide.
- Precedence when a promo, referral, and affiliate all touch one order.
- Commercial policy for subscription billing, grace, and downgrade timing.

Set `XTIITCH_GROWTH_POLICY_CONFIRMED=true` only after these owner decisions are
recorded; the admin Launch Readiness screen will then move this gate to ready.

## Evidence Template

```text
Date:
Environment:
Commit:
Operator:
Sonar gate:
Paystack smoke:
Notification smoke:
Waitlist smoke:
Legal/policy status:
Growth decisions status:
Open blockers:
```
