# Xtiitch Affiliates and Promotions Agent Plan

Last updated: 2026-07-30  
Working branch: `dev/affiliate-promotions`  
Merge policy: merge to `main` only after migrations, API, web apps, attribution, money flows, and production-like QA are stable.  
Phase 7 status: engineering complete on this branch; staging deploy + merge remain an explicit acceptance gate.

## Goal

Build one tenant-aware growth system that supports:

- public applications to become a Xtiitch platform affiliate;
- unique shareable affiliate links and codes;
- a private affiliate dashboard showing clicks, signups, purchases, conversion rate, and earnings;
- admin approval, configurable commissions, conversion review, and payout reconciliation;
- commission on qualifying customer purchases and the first successful paid-plan payment;
- business-owned affiliate programmes for a store, collection, design, or product;
- admin visibility across platform-owned and business-owned programmes;
- platform and business promotions/coupons with safe checkout enforcement and complete redemption reporting.

## Product Decisions

- Public affiliate signup is self-service, but every application requires approval before its code can earn commission.
- Default attribution is last eligible affiliate touch within a configurable 30-day cookie window.
- Purchase commissions are based on the captured merchandise amount after discounts, excluding delivery, taxes, refunds, reversals, and Xtiitch fees.
- Paid-plan commission applies to the first successful paid-plan payment only. Renewals do not earn commission in the first release.
- New commissions remain pending for 14 days. Refunds, disputes, reversals, and fraudulent/self-referrals void or reverse commission.
- Commission rates are snapshotted on each conversion. Later rate changes never rewrite historical earnings.
- Admin may configure separate purchase and paid-plan percentages, with per-affiliate overrides.
- A business funds commissions for its own programme. Xtiitch funds platform programme and paid-plan commissions.
- Manual payout reconciliation remains the first payout rail. Paystack transfers can be added after beneficiary verification and reconciliation are stable.
- Promotions and affiliate attribution may coexist. Discounts are applied first; commission is calculated from the actual captured eligible amount.
- Codes are globally unique, uppercase, case-insensitive, and cannot collide with promotion or referral codes.
- Business owners/admins may manage business programmes. Staff roles cannot change growth or payout settings.

## Existing Foundation

### Already implemented

- Admin-managed affiliates with status, code, commission model/rate, cookie window, payout mode, and contact details.
- Affiliate click capture, last-click checkout reservation, purchase conversion creation, hold/status workflow, reversals, and manual payout batches.
- Admin affiliate list, attribution/conversion views, approval/reversal actions, and payout reconciliation.
- Platform promotions and business-funded store/collection/design promotions.
- Promotion validation, checkout application, redemption ledgers, usage limits, archive controls, and admin/business reporting.
- Storefront support for promo, referral, and affiliate codes.
- `manage_growth` admin permission and tenant-aware PostgreSQL access patterns.

### Material gaps

- No public affiliate application or affiliate authentication/portal.
- Existing affiliates are platform-scoped; there is no explicit owning programme or business-owned affiliate roster.
- One commission field is used for purchase earnings; no independent paid-plan commission policy.
- Affiliate conversions are order-only and require a business/order foreign key.
- No subscription checkout attribution or first-paid-plan conversion ledger.
- No business dashboard affiliate management.
- Admin cannot review applications or compare platform and business-owned programmes.
- Code uniqueness is enforced per feature table, not across affiliates, promotions, and referrals.
- Promotions do not yet cover paid-plan campaign coupons.

## Target Domain Model

### `affiliate_programmes`

- `affiliate_programme_id`
- `owner_type`: `platform` or `business`
- nullable `business_id`
- name, description, status
- default purchase commission basis points
- default first-paid-plan commission basis points
- cookie window days and hold days
- payout mode and minimum payout amount
- allowed target scope: platform, store, collection, design/product
- created/updated actor metadata and timestamps

Exactly one active default platform programme is allowed. Business rows are protected by RLS and must match `xtiitch.current_business_id`.

### `affiliate_applications`

- applicant type, display/contact details, website/social URL, promotion approach
- requested code and optional target programme
- source and consent timestamps
- status: `pending_review`, `approved`, `rejected`, `withdrawn`
- review note, reviewer, reviewed timestamp
- linked `affiliate_id` after approval

Email is normalized and indexed. Public submission is rate-limited and idempotent for an unresolved application.

### Extended `affiliates`

- owning programme and nullable owner business
- source application
- purchase commission override
- first-paid-plan commission override
- optional authenticated account link
- target scope and target references
- approval/activation metadata

Existing affiliate records are backfilled into the default platform programme without changing their active codes or historical calculations.

### Unified conversion ledger

Evolve `affiliate_conversions` from order-only rows to typed conversions:

- `conversion_type`: `purchase` or `paid_plan_signup`
- nullable order/business/subscription/payment references as appropriate
- gross eligible amount, snapshotted commission basis/rate, commission amount
- programme owner/funding source
- pending/approved/settled/reversed status and hold timestamps
- immutable attribution metadata and reversal reason

Database constraints enforce the required reference for each conversion type and idempotency per qualifying order/payment.

### Affiliate sessions and portal

Use a dedicated affiliate identity/session boundary. Do not reuse admin or business JWTs. Store password hashes or magic-link challenges, never raw credentials. The portal exposes only the signed-in affiliate's links, clicks, conversions, balances, payout history, and profile.

The portal is a standalone deployable web app at `apps/affiliate`, with its own
package scripts, environment contract, health/build checks, and hosting service
for `affiliate.xtiitch.com`. It shares API contracts and design primitives where
appropriate, but it does not deploy as part of the admin or business dashboard.

The first dashboard release will show:

- total and period-filtered link clicks;
- customer accounts and businesses that completed signup with the affiliate code, reported separately;
- first paid-plan signups attributed to the code;
- customer purchase conversions and gross eligible sales;
- click-to-signup and click-to-purchase conversion rates;
- commission split into pending hold, available/approved, paid, and reversed;
- total lifetime earnings and the next minimum-payout target;
- a recent activity ledger with conversion type, amount, commission, status, and date;
- payout history and references;
- the affiliate's code, canonical share link, and copy/share actions.

Counts must represent qualified records, not raw form submissions. Personally identifiable customer or business data is masked; affiliates see aggregate performance and only the minimum conversion detail needed for reconciliation.

## Permission and Isolation Rules

- Public: submit an application, resolve an active code, record privacy-safe clicks.
- Affiliate: read/update own profile and payout details; read own analytics and payouts.
- Business owner/admin: manage only programmes and affiliates owned by that business.
- Platform admin with `manage_growth`: review all applications and programmes, configure platform defaults, pause risky actors, review conversions, and reconcile payouts.
- Money-rail permission is required when an action initiates or confirms an external payout.
- All mutations generate durable audit events.
- Business-owned tables use RLS; platform-wide reads use the existing audited admin bypass path.

## API Plan

### Public

- `POST /v1/public/affiliate-applications`
- `GET /v1/public/affiliate-programmes/default`
- `POST /v1/public/affiliates/{code}/clicks` (extend with programme/target context)
- `GET /v1/public/affiliates/{code}` for safe code preview

### Affiliate portal

- `POST /v1/affiliate/auth/login`
- `POST /v1/affiliate/auth/refresh`
- `POST /v1/affiliate/auth/logout`
- `GET/PATCH /v1/affiliate/me`
- `GET /v1/affiliate/dashboard?from=&to=` returning clicks, qualified customer and business signups, paid-plan signups, purchases, conversion rates, and earnings buckets
- `GET /v1/affiliate/conversions?type=&status=&cursor=`
- `GET /v1/affiliate/payouts?cursor=`
- `GET /v1/affiliate/share-links`

### Business dashboard

- `GET/POST/PATCH /v1/business/affiliate-programmes`
- `GET/POST/PATCH /v1/business/affiliates`
- `POST /v1/business/affiliates/{id}/pause`
- `GET /v1/business/affiliate-attribution`

### Admin

- application list/detail/review endpoints;
- programme defaults and business-programme oversight;
- existing affiliate endpoints extended with owner/programme and separate commission fields;
- typed conversion filters and aggregate reporting;
- paid-plan promotion controls and redemption reporting.

## Attribution and Money Rules

1. Resolve a code and record a privacy-safe click.
2. Store the last eligible touch with code, click ID, programme, target scope, and expiry.
3. Validate target compatibility at checkout or paid-plan selection.
4. Reserve attribution before payment initialization.
5. Finalize exactly once only after a verified provider success event.
6. Calculate commission from captured eligible value using the snapshotted effective rate.
7. Hold for 14 days, then make eligible for operator approval.
8. Reverse on refund, dispute, chargeback, cancellation, or confirmed abuse.
9. Settle only approved, unpaid conversions in a transactional payout batch.

Self-referrals, same-account referrals, duplicate provider events, code cycling, suspicious IP/device repetition, and excessive reversals are flagged for review.

## Promotions Plan

The existing promotion engine remains the base. Extend it instead of creating a second coupon system.

- Add promotion channel: `store_purchase` or `paid_plan`.
- Paid-plan scope supports selected package(s), first billing only, start/end window, total redemption cap, and per-business cap.
- Preserve platform-funded vs business-funded discount accounting.
- Validate all limits and eligibility server-side at payment initialization and webhook finalization.
- Keep promotion redemptions and affiliate conversions as separate immutable ledgers linked by payment/order metadata.
- Admin sees campaign performance across both channels; businesses see only their own store campaigns.

## Delivery Phases

### Phase 0 — branch, plan, and regression baseline

- [x] Create `dev/affiliate-promotions`.
- [x] Audit existing affiliate/promotion code and preserve working flows.
- [x] Record decisions and phased plan in this document.
- [x] Run baseline API and frontend checks before changing behavior.

### Phase 1 — public application and admin review

- [x] Add affiliate application schema, RLS, indexes, and lifecycle constraints.
- [x] Add application repository/service/HTTP contracts with validation and rate-limit hooks.
- [x] Add public affiliate signup page and success/pending states.
- [x] Add admin application queue, detail, approve/reject actions, and audit events.
- [x] Approval creates/links an affiliate atomically with configurable purchase and paid-plan rates.
- [x] Send application-received and decision emails.

### Phase 1.5 — affiliate dashboard MVP

- [x] Add dedicated affiliate account, activation-token, refresh-session, and lockout schema.
- [x] Implement account activation, session rotation, lockout, and recovery services.
- [x] Create an affiliate account/invite atomically when an application is approved.
- [x] Add affiliate login, activation, refresh, logout, and recovery endpoints.
- [x] Add the tenant-safe dashboard aggregate read model and paginated conversion/payout ledgers.
- [x] Add a deduplicated qualified customer/business signup attribution ledger.
- [x] Capture qualified customer and business signup attribution during registration and expose both dashboard totals.
- [x] Create the independently deployable `apps/affiliate` dashboard web surface at `affiliate.xtiitch.com`.
- [x] Show clicks, customer signups, business signups, paid-plan signups, purchases, conversion rates, pending/available/paid/reversed commission, lifetime earnings, and payout history.
- [x] Add canonical share links with copy/share actions and clear attribution-window copy.
- [x] Mask customer/business PII and add authentication, authorization, and cross-account isolation tests.

### Phase 2 — programme ownership and commission policy

- [x] Add `affiliate_programmes` and backfill existing affiliates.
- [x] Add separate purchase and first-paid-plan commission defaults/overrides.
- [x] Add programme owner and target scope to admin read models.
- [x] Add admin settings and business programme controls.
  - [x] Admin programme policy API and settings UI.
  - [x] Business owner/admin programme controls.
- [x] Enforce global growth-code collision checks.

### Phase 3 — business affiliates

- [x] Add business API and dashboard section for programmes, affiliate roster, links, and performance.
- [x] Permit store/collection/design/product targeting.
- [x] Enforce owner/admin writes and tenant RLS.
- [x] Expose all business programmes read-only to authorized platform admins.

### Phase 4 — paid-plan attribution

- [x] Carry affiliate attribution through paid-plan checkout.
- [x] Evolve conversion schema for typed, nullable order/subscription references.
- [x] Create first-payment conversion from verified Paystack webhook success.
- [x] Ensure retries, renewals, downgrades, refunds, and reversals are idempotent and correct.

### Phase 5 — affiliate portal expansion

- [x] Add QR exports, campaign-specific links, and deeper channel breakdowns.
- [x] Add configurable reports and affiliate CSV exports.
- [x] Add payout-profile management with masked sensitive values.
- [x] Add notification preferences for conversions, approvals, reversals, and payouts.

### Phase 6 — paid-plan promotions and reporting

- [x] Extend promotion model and checkout to paid plans.
- [x] Add admin campaign creation and package targeting.
- [x] Add aggregate funnel, discount, commission, reversal, and payout reporting.
- [x] Add CSV exports without exposing tokens or sensitive payout data.

### Phase 7 — hardening and release

- [x] Abuse controls, rate limiting, idempotency, audit coverage, and privacy review.
  - Public application/click route rate limits, risk-event triggers (click velocity, self-referral, reversal velocity), portal mutation audit trail (`000138_affiliate_hardening`), growth-report export bounds, payout-profile auth gate.
- [x] Migration upgrade/downgrade and legacy-data tests.
  - Verified `000136`→`000138` down/up on demo Postgres; hardening tables stay RLS-forced.
- [x] Unit, repository integration, handler, checkout, webhook, RLS, and UI tests.
  - Focused Go suites green for growth, adminauth, affiliateauth, growth HTTP, Paystack webhook parsing; affiliate portal modularised and lint-clean.
- [x] Production-like browser QA for public, affiliate, business, admin, and storefront flows.
  - Local surfaces verified: marketing `/affiliates`, affiliate login, dashboard login, admin login, storefront home; public application submit + rate-limit; admin growth report JSON/CSV.
- [x] Reconciliation drill for discount + commission + refund + payout.
  - Transactional drill proved discount-then-commission math, approve→refund reversal, historical rate immutability, purchase idempotency unique index, and unscoped RLS denial; rolled back.
- [ ] Deploy to staging, monitor, then merge to `main` only after acceptance.
  - Remaining release gate. Do not merge until staging acceptance is signed off.

## Acceptance Criteria

- An applicant can submit once and receive a clear pending state.
- Admin can approve with separate purchase and paid-plan percentages; the code becomes active only after approval.
- An approved affiliate can activate a dedicated account and sign in without using admin or business credentials.
- The affiliate dashboard accurately reports qualified customer signups, business signups, paid-plan signups, purchases, conversion rates, and pending/available/paid/reversed earnings.
- Affiliates can see only their own aggregate metrics, conversion ledger, payout history, profile, and share links; customer and business PII is masked.
- A valid code produces at most one commission for each qualifying purchase or first paid-plan payment.
- Historical commission does not change when rates change.
- Business users can manage and report only their own programmes.
- Admin can inspect platform and business programmes, applications, clicks, conversions, reversals, and payouts.
- Promotions and affiliate codes produce correct captured totals and do not double-discount or overpay.
- Refunds/reversals remove unpaid earnings or create an auditable reversal for settled earnings.
- RLS and role tests prove cross-tenant reads/writes are denied.
- All provider/webhook retries are idempotent.
- No production credential file or secret is added to Git.

## Verification Commands

Run focused checks during each phase, then the full suite before merge:

```sh
cd apps/api && go test ./internal/application/growth ./internal/application/adminauth
cd apps/api && go test ./internal/adapters/inbound/http/growth ./internal/adapters/inbound/http/adminauth
cd apps/api && go test ./internal/adapters/outbound/postgres
cd apps/api && go test ./internal/... && go vet ./... && go build ./...
pnpm --filter @xtiitch/admin check
pnpm --filter @xtiitch/dashboard check
pnpm --filter @xtiitch/storefront check
pnpm exec eslint apps/admin apps/dashboard apps/storefront --max-warnings=0
pnpm --filter @xtiitch/admin build
pnpm --filter @xtiitch/dashboard build
pnpm --filter @xtiitch/storefront build
git diff --check
```
