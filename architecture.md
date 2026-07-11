---
title: "Xtiitch — Architecture & Engineering Reference"
author: "Xtiitch Engineering"
date: "2026-07-04"
---

# Xtiitch — Architecture & Engineering Reference

> **Purpose.** This is the single reference for understanding the whole Xtiitch
> system: what each part does, how the parts talk, and where to find the code for
> any concern or symbol. New to the repo? Read §1–§3 top-to-bottom, then use §4
> ("Where to find X") as a jump table into the deep sections that follow.
>
> Companion docs: **The Xtiitch User Guide** (how the product works for end users),
> `FEATURES.md` (feature list), `agent_plan.md` (status/roadmap), `docs/` (ADRs,
> runbooks, compliance).
>
> **Last updated:** 2026-07-04. Every deep section cites `path:line` so you can
> jump straight to any type, function, route, table, or component.

---

## Table of contents

1. System overview
2. Technology stack
3. Repository layout
4. Where to find X — navigation & symbol index
5. **Data Model, Platform & Deployment** — schema (all 63 migrations), RLS, config/env, DI wiring, router, Render/Vercel/worker, testing
6. **API — Identity, Auth & Money** — business auth, admin auth, customer auth, payments/Paystack, delivery, waitlist
7. **API — Catalogue, Orders & Fulfilment** — catalogue, orders, checkout, availability/booking, measurements, media, notifications, WhatsApp bot, growth, AI
8. **Frontends, Mobile & Shared Packages** — dashboard, storefront, marketing, admin, mobile, packages
9. **Security Assessment** — adversarial review: authN/authZ, RLS, payments, OTP/MFA, secrets, injection, transport, rate-limiting

---

## 1. System overview

**Xtiitch** is a commerce platform for Ghana's fashion businesses (tailors,
designers, studios). It has three web surfaces plus a mobile app:

- **Storefront / marketplace** — `store.xtiitch.com` and per-store subdomains
  (`{handle}.xtiitch.com`). Shoppers discover verified studios, browse designs,
  choose sizes, add made-to-wear *and* bespoke pieces to one cart, and check out.
- **Business dashboard** — `business.xtiitch.com`. Owners/staff run their catalogue
  (the "Design Studio"), orders (table + kanban), handovers, money, availability,
  promotions, team, and store settings.
- **Admin / operator console** — internal. Reviews Ghana Card verifications,
  manages businesses and plans, runs launch-readiness checks, sets platform branding.
- **Mobile** — an Expo/React Native companion app.

**Money model:** Xtiitch **never holds funds.** Online payments run through
**Paystack** with a split that settles the garment value directly to the
business's Paystack subaccount; the platform only takes its commission. Offline
("manual") takings a business logs are **commission-free**. Delivery fees ride
the same Paystack charge.

**Shape:** a **pnpm-workspaces monorepo**. The backend is a single **Go** service
in a hexagonal (ports-and-adapters) architecture. The four SSR web apps are
**React Router v7** (framework/SSR mode) + **MUI v9**. A **BullMQ (Node) worker**
drains a transactional notification outbox to WhatsApp Cloud.

**Deployment topology:**

```
                 Vercel                                Render
   ┌───────────────────────────────┐   ┌──────────────────────────────────────┐
   │ marketing  (xtiitch.com)       │   │ Go API  (web)  ── ./migrate up on boot │
   │ storefront (store.xtiitch.com) │──▶│ Postgres (Basic, persistent)           │
   │ dashboard  (business.xtiitch…) │   │ Redis                                  │
   │ admin      (operator console)  │   │ BullMQ worker (outbox → WhatsApp Cloud)│
   └───────────────────────────────┘   └──────────────────────────────────────┘
                    │                                    ▲
                    └──────── HTTPS /v1 JSON API ────────┘
```

The SSR apps call the Go API's `/v1` JSON endpoints server-side (loaders/actions),
holding sessions in httpOnly cookies (`xt_dashboard`, `xt_customer`, `xt_cart`,
`xt_admin`). See §8 for the frontends and §5 for deployment.

---

## 1b. Recent additions (July 2026 — Xtiitch Updates spec)

Shipped on top of the base system; details live in the relevant sections and in `agent_plan.md`.

- **Marketplace multi-store "pay once" (P0.4)** + **payout-provisioning gate (P0.5)** + Paystack fixes (`settlement_bank` on subaccount creation; webhook secret defaults to the secret key) — see the **payments** section. Validated live against Paystack test (real payment + webhook).
- **Subscription / AI-add-on billing → standard Paystack checkout** — replaced the dead direct-debit **mandate** link (a 404 for this merchant account) with a normal `checkout.paystack.com` payment: the tenant/operator pays the first period (MoMo or card) at checkout, and the callback only **confirms + books** it (never re-charges). A card yields a reusable authorization that the recurring sweep charges each renewal; MoMo yields none, so the sweep re-prompts. Free-period / full (≥100%) discounts activate immediately with **no** checkout (a zero-amount checkout would be rejected). Subscription upgrade from the free plan now switches `plan_id` at billing setup so the fee gate passes. See the **payments** section.
- **Colour variations** (`design_variations`, plan-capped) — a design carries named colour/fabric swatches, each an ordered image set; the storefront swaps the gallery, price/flow unchanged. Dashboard editor + `GET/POST/PATCH/DELETE /designs/{id}/variations(+/reorder)`.
- **Per-design size-band overrides** (`design_size_band_overrides`) — a single design overrides a shared band's label/chart without touching the master; resolved on dashboard + storefront reads. `PUT/DELETE /designs/{id}/size-bands/{bandId}/override`.
- **Bespoke display amount** (`designs.bespoke_display_minor`) — an indicative "from" price on customisation designs, distinct from the deposit.
- **Per-day availability** (`availability_windows.specific_date` recurrence `date`; `availability_blackouts`) — one-off day hours + mark-a-day-unavailable alongside daily/weekly/monthly. `GET/POST /availability/blackouts`, `DELETE /availability/blackouts/{date}`.
- **Per-stage-change customer notifications** (`order_stage_advanced` kind, deduped per `order@stage`; worker composes per-stage SMS) + a business `GET /stages` read so the dashboard renders the full four-stage board.
- **Two-phone customer identity** (`customers.whatsapp_phone`) — a WhatsApp contact number distinct from the OTP-verified login phone.
- **Account-gate before pay** — storefront checkout + bespoke-deposit flows require a verified customer session (prefilled from the profile); the API endpoints remain public and are gated server-side by the storefront actions.
- **Unified multi-store basket** — the cart accumulates across shops grouped by store; per-store checkout on the proven single-store rail, plus the P0.4 "pay for all studios at once" split path.
- Storefront **share-link fix** (`/design`,`/collection` → `/d`,`/c` redirects + graceful not-found), longer sessions (access 3h / refresh 90d / customer 90d), and cart-first buying (contact collected at checkout, not on the design page).
- Migrations advanced to **`000080`**; ordering rule reaffirmed (always number above the highest ever committed — golang-migrate silently skips lower numbers).

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Backend API | **Go** — chi router, pgx (Postgres), hexagonal architecture, JWT (HS256) |
| Database | **PostgreSQL** with Row-Level Security (multi-tenant), golang-migrate (63 migrations) |
| Cache/queue | **Redis** + **BullMQ** (notification worker) |
| Payments | **Paystack** (subaccount split charges, recurring subscriptions, HMAC-SHA512 webhooks) |
| Messaging | **WhatsApp Cloud API** (Meta Graph) — OTP delivery, order notifications, inbound bot |
| Media | **Cloudinary** (signed uploads) |
| Web apps | **React Router v7** (SSR) + **MUI v9** + Emotion + TypeScript (`noUncheckedIndexedAccess`) |
| Mobile | **Expo / React Native** |
| Auth | Password (bcrypt) + JWT access/refresh, optional **TOTP MFA**, **WhatsApp one-time codes** |
| Hosting | Go API + Postgres + Redis + worker on **Render**; SSR apps on **Vercel** |
| Tooling | pnpm workspaces, ESLint, Prettier, SonarQube, Go test + Postgres integration tests |

---

## 3. Repository layout

```
xtiitch/
├─ apps/
│  ├─ api/          Go backend (hexagonal). Key dirs under internal/:
│  │   ├─ domain/         pure business types (auth, business, catalogue, order,
│  │   │                  money, booking, delivery, customer, admin, notification, common)
│  │   ├─ application/    services + ports (interfaces) per subsystem — see §6/§7
│  │   ├─ adapters/
│  │   │   ├─ inbound/http/    chi handlers + router + auth middleware
│  │   │   └─ outbound/        postgres repos, paystack, cloudinary, whatsapp, auth crypto
│  │   ├─ platform/       config, clock, ids, logger
│  │   ├─ bootstrap/      app.go — dependency-injection wiring of the whole service
│  │   └─ cmd/api/        main entrypoint
│  ├─ dashboard/    Business dashboard SSR (business.xtiitch.com) — routes/dashboard.tsx (~17k lines)
│  ├─ storefront/   Marketplace + per-store SSR (store.xtiitch.com) — design/cart/checkout/track
│  ├─ marketing/    Marketing site SSR (xtiitch.com)
│  ├─ admin/        Operator/admin console SSR — routes/admin.tsx
│  ├─ mobile/       Expo / React Native app
│  └─ worker/       BullMQ worker (Node/tsx) — drains DB outbox → WhatsApp Cloud; subscription sweeps
├─ packages/
│  ├─ api-client/   shared client scaffold (health only; apps ship their own app/lib/api*)
│  ├─ contracts/    OpenAPI contract seeds + tests
│  ├─ design-tokens/ brand tokens
│  └─ schemas/      shared validation (money/id/handle)
├─ infra/migrations/  63 golang-migrate SQL migrations (000001…000063, split .up/.down)
├─ docs/            ADRs, architecture, security (tenant-isolation.md), runbooks, api, compliance
├─ scripts/         launch-gate checks, paystack/whatsapp smoke tests, sonar setup
├─ render.yaml      Render blueprint (Postgres, Redis, Go API web, BullMQ worker)
├─ architecture.md  ← this document        FEATURES.md · agent_plan.md
└─ package.json · pnpm-workspace.yaml · tsconfig.base.json · eslint.config.mjs · docker-compose.yml
```

Secrets (`production.env`, `credentials.txt`, `prod.credentials.txt`, `.env`) are
**gitignored and never committed** (verified — see §9).

---

## 4. Where to find X — navigation & symbol index

Every deep section cites `path:line`. Use this table to jump to the right section
and starting files.

| I want to understand… | Section | Start here (paths) |
|---|---|---|
| Login, JWT, refresh, MFA, **WhatsApp OTP sign-in** | §6 Identity | `apps/api/internal/application/auth/{service.go,whatsapp_otp.go}`; `adapters/inbound/http/auth/handler.go`; `adapters/outbound/auth/{jwt.go,bcrypt.go,totp.go,customer_otp.go}` |
| Admin console auth, verification decisions, launch readiness | §6 Identity | `application/adminauth/`; `adapters/inbound/http/adminauth/` |
| Customer (shopper) accounts + OTP | §6 Identity | `application/customerauth/`; `adapters/outbound/postgres/customer_auth_repository.go` |
| Payments, Paystack, subaccounts, **webhooks** | §6 Identity | `application/payments/`; `adapters/outbound/paystack/`; `domain/money/` |
| Delivery zones + fees | §6 Identity | `application/delivery/` |
| Designs, collections, size bands/charts, **pricing modes**, image caps | §7 Catalogue | `application/catalogue/`; `adapters/outbound/postgres/catalogue_repository.go` |
| Orders, stages, **kanban**, handovers, measurements, walk-in/bespoke | §7 Catalogue | `application/order/`; `adapters/outbound/postgres/order_repository.go` |
| Checkout, cart, **combined charge**, mixed made-to-wear+bespoke | §7 Catalogue | `application/checkout/`; webhook group-confirm in `adapters/outbound/postgres/payment_repository.go` |
| Availability recurrence + **home-visit calendar** + bookings | §7 Catalogue | `application/availability/`; `application/booking/`; `domain/booking/` |
| Notifications / outbox (drained by the worker) | §5 / §7 | `application/notification/`; `apps/worker/src/` |
| WhatsApp inbound bot | §7 Catalogue | `application/whatsappbot/`; `adapters/.../whatsapp/` |
| Database schema, any table, migrations | §5 Data | `infra/migrations/000001…000063` |
| **RLS / multi-tenant isolation** | §5 Data + §9 | `adapters/outbound/postgres/tenant.go`; `infra/migrations/000004_rls_app_role.up.sql` |
| Config / **environment variables** | §5 Data | `apps/api/internal/platform/config/config.go` |
| Dependency wiring / how the app boots | §5 Data | `apps/api/internal/bootstrap/app.go` |
| HTTP routes / middleware / rate limiting | §5 Data | `adapters/inbound/http/router.go` |
| Dashboard UI (any panel/component) | §8 Frontends | `apps/dashboard/app/routes/dashboard.tsx` |
| Storefront, cart, checkout, visit calendar | §8 Frontends | `apps/storefront/app/routes/{design,cart,checkout}.tsx` |
| Admin console UI | §8 Frontends | `apps/admin/app/routes/admin.tsx` |
| Deployment (Render / Vercel / worker) | §5 Data | `render.yaml`; `apps/worker/src/` |
| Is it secure? attack surface | §9 Security | (this document, §9) |

---

The remaining sections (§5–§9) are the deep reference. Each is self-contained and
heavily cross-referenced by `path:line`.

---


## Data Model, Platform & Deployment

> scope. This section is the reference for the Xtiitch backend's persistence and runtime: the full Postgres schema (63 migrations), the Row-Level-Security multi-tenancy model, the platform primitives (config/clock/ids/logger), how the Go API boots and wires its dependencies, the HTTP router and middleware, the deployment topology (Render + Vercel + the BullMQ worker), and the testing strategy. Everything below was read from source; `path:line` citations point at the exact symbols. Repo root: `/Users/shayford/Desktop/Dev/Projects/xtiitch`.

The system is a Go hexagonal-architecture monolith (`apps/api`) plus a Node BullMQ worker (`apps/worker`) and four React-Router SSR web apps (`apps/marketing`, `apps/storefront`, `apps/dashboard`, `apps/admin`) and an Expo mobile app (`apps/mobile`). Money is always stored in integer minor units (pesewas for GHS). Xtiitch never holds funds — Paystack settles directly to each business's subaccount.

---

### 1. Database schema

Migrations live in `infra/migrations/` as **split `.up.sql` / `.down.sql` pairs**, zero-padded and sequentially numbered `000001` … `000063`. This split-file layout is the **golang-migrate** format, and golang-migrate is the runner used at deploy time (`render.yaml` installs `github.com/golang-migrate/migrate/v4/cmd/migrate` and runs `./migrate -path ../../infra/migrations -database "$DATABASE_URL" up` on API boot). Note a documentation drift: `infra/migrations/README.md` still refers to Goose tooling and `pnpm --filter @xtiitch/api migrate:*` scripts, but the live deployment path uses golang-migrate. `up` exits 0 on both apply and no-change, so a genuine failure blocks boot while a clean restart proceeds.

Conventions enforced across migrations: every tenant-scoped table carries `business_id`; high-traffic indexes lead with `business_id`; client-facing IDs are UUIDs (`gen_random_uuid()` via the `pgcrypto` extension enabled in `000001`); webhook/payment idempotency tables carry unique constraints. Money columns are `bigint`/`integer` minor units with `CHECK (… >= 0)` guards.

The tables below are grouped logically. "Mig." is the migration that created the table (with later-altering migrations noted).

#### 1a. Identity & tenancy

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `plans` | 000001 | Subscription plan catalogue (Free/Starter/Growth/Studio). Seeded inline. | `plan_id` PK; `code` UNIQUE; `monthly_fee_minor`, `yearly_fee_minor` (000040/000045 added yearly = 10× monthly "two months free"), `commission_bps`, `design_limit` (nullable = unlimited); `features jsonb` (000038 — storefront-customization + `online_ordering` entitlement map). 000058 reshaped to four tiers (renamed `standard`→`starter`, added `studio`) updating rows in place so `plan_id` stays stable. |
| `businesses` | 000001 | The tenant root. | `business_id` PK; `plan_id` FK; `handle` (CHECK format `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, unique on `lower(handle)`); `verification_status` (unverified/pending/verified/rejected); settlement provider/subaccount/momo fields; `default_deposit_minor` (≥10000). 000017 added `operational_status` (active/suspended) + `suspension_reason`/`suspended_at`/`suspended_by_admin_user_id`. |
| `store_settings` | 000001 | Per-business storefront toggles (1:1 with business). | `business_id` PK/FK; feature flags (bespoke/measurements/customisation/collections/delivery/dispatch enabled); `brand_color`. 000010 added `business_timezone` (default `Africa/Accra`); 000038 added `logo_url`, `banner_url`, `layout_variant` (standard/spotlight/minimal). |
| `business_users` | 000001 | Dashboard logins (owner/admin/staff). | `business_user_id` PK; `business_id` FK; unique `(business_id, lower(email))`; `password_hash`, `role`. 000063 added `whatsapp_number` (partial-unique globally) + `whatsapp_verified_at` for WhatsApp OTP sign-in. |
| `customers` | 000001 | **Global** customer identity (no `business_id`). | `customer_id` PK; `identity_ref` UNIQUE; email/phone/display_name. 000043 added `erased_at` (right-to-erasure). 000048 added `phone_verified_at`. 000050 added `ai_search_pro`. |
| `customer_businesses` | 000001 | Join of a global customer to a business they've interacted with. | Composite PK `(business_id, customer_id)`; `first_seen_at`. |
| `auth_sessions` | 000002 | Business dashboard refresh-token sessions. | `session_id` PK; `business_id`+`business_user_id` FKs; `refresh_token_hash` UNIQUE; `expires_at`/`revoked_at`; partial active index `WHERE revoked_at IS NULL`; `CHECK (expires_at > created_at)`. |
| `business_user_mfa` | 000041 | Opt-in TOTP MFA per business user. | `business_user_id` PK/FK; `secret_encrypted bytea` (AES-GCM at rest); `enabled`; `backup_codes jsonb` (sha256 hashes). 000042 hardening added `last_used_step` (replay guard, RFC 6238 §5.2), `failed_attempts`, `locked_until` (lockout). |

#### 1b. Catalogue

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `collections` | 000005 | Named groupings of designs. | `collection_id` PK; `business_id` FK; unique `(business_id, handle)`; `status` (active/retired/deleted); `sequence`. 000057 renumbers `sequence` to 1..N and adds partial-unique `(business_id, sequence) WHERE status <> 'deleted'`. |
| `designs` | 000005 | Sellable garments/designs. | `design_id` PK; `business_id` FK; `collection_id` FK (SET NULL); `images text[]`; `customisation_allowed`; `deposit_override_minor` (≥10000 or null); unique `(business_id, handle)`; `status`; `sequence`. |
| `size_bands` | 000005 | Business-defined size labels + measurement chart. | `size_band_id` PK; `business_id` FK; `chart jsonb`; `sequence`. 000057 renumbers + unique `(business_id, sequence)`. |
| `design_prices` | 000005 | Per-design, per-band price. | Composite PK `(design_id, size_band_id)`; `business_id` FK; `price_minor`. |
| `measurement_fields` | 000008 | Business-defined bespoke measurement fields. | `field_id` PK; `business_id` FK; `unit` (cm/in); unique `(business_id, sequence)`. |
| `design_embeddings` | 000049 | AI-search semantic embeddings, 1 per design. | `design_id` PK/FK; `business_id` FK; `content_hash` (skip re-embed); `embedding real[]` (float array so it works on stock Postgres; pgvector is the production upgrade); `model`. |
| `design_waitlist_entries` | 000039 | Customer interest lists per design (Growth+ benefit). | `entry_id` PK; `business_id`+`design_id` FKs; `status` (waiting/notified/closed); partial-unique `(design_id, lower(customer_contact))`. |

#### 1c. Orders, production & fulfilment

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `stage_templates` | 000006 | The business's own production stages, each a colour (red/yellow/green) — the heart of the tracking view. | `stage_id` PK; `business_id` FK; `flow` (ready_made/bespoke); unique `(business_id, flow, sequence)`. |
| `orders` | 000006 | Orders (standard + custom). | `order_id` PK; `business_id` FK; `customer_id`/`design_id`/`size_band_id` FKs; `order_type` (standard/custom); `size_mode` (band/self_measure/home_visit/come_to_shop); `flow`; `channel` (online/walk_in); `agreed_total_minor`; `settled_minor`; `status` (draft/awaiting_deposit/confirmed/fulfilled/cancelled); `current_stage_id`. **000007 added unique `(order_id, business_id)`** — the same-tenant backstop other tables' composite FKs reference. 000059 added `checkout_group_id` (combined-cart). 000060 added `delivery_method`/`delivery_address`/`delivery_fee_minor`/`delivery_zone_id`. |
| `stage_events` | 000006 | Append-only stage-transition history. | `event_id` PK; `order_id` FK (CASCADE); `stage_id` FK; `entered_at`. |
| `order_measurements` | 000008 | Captured bespoke measurements per order. | `measurement_id` PK; unique `(order_id)`; `source` (self/visit/shop); `values jsonb`; composite same-tenant FK `(order_id, business_id)`. |
| `handovers` | 000011 | Final logistics leg (pickup/delivery). Never escrows money. | `handover_id` PK; `method`; `status` (pending/dispatched/completed/cancelled); CHECK "delivery must have address", CHECK "only delivery is dispatched"; **partial-unique `(order_id) WHERE status IN (pending,dispatched)`** (one open handover per order); composite same-tenant FK. |
| `delivery_zones` | 000060 | Named delivery zones with a flat fee. | `zone_id` PK; `business_id` FK; unique `(business_id, name)`; unique `(zone_id, business_id)` (same-tenant backstop for `orders.delivery_zone_id`); `fee_minor`; `active`. |

#### 1d. Money, subscriptions & payments

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `payments` | 000003 | Through-platform payments (carry commission). | `payment_id` PK; `business_id` FK; `order_id`/`booking_id`; `purpose` (standard_full/deposit/balance/booking_deposit; 000059 added `cart_full`); `amount_minor`; `method` (momo/card); `provider_reference` UNIQUE; `status` (initiated/succeeded/failed/reversed); `through_platform`; `commission_minor`. 000007 added composite FK to `orders`; 000010 added composite FK to `bookings`. **000009 partial-unique `(order_id) WHERE purpose='balance' AND status='initiated'`** prevents double-charging a balance. |
| `manual_takings` | 000003 | Off-platform/manual takings — **never carry commission at collection** (Xtiitch didn't move the money). | `taking_id` PK; `business_id` FK; `method` (cash/momo/other); `amount_minor`. 000047 added `commission_bps`/`commission_minor`/`commission_status` (not_applicable/due/invoiced/settled/waived)/`commission_note` — snapshots the plan commission at log time for later invoicing/reconciliation. |
| `payment_provider_events` | 000003 | Webhook idempotency ledger (NOT tenant-scoped — provider infra). | `event_id` PK; unique `(provider, event_signature)` makes a redelivered webhook a no-op. |
| `business_subscriptions` | 000021 | One subscription per business (state machine). | `subscription_id` PK; `business_id` UNIQUE FK; `status` (active/trialing/past_due/grace_period/cancel_at_period_end/canceled); `billing_mode` (manual/payment_link/recurring); `provider` (manual/paystack); period/trial/grace timestamps; `failed_payment_count`; `next_billing_at` (partial index). Backfilled from existing businesses on create. |
| `business_subscription_events` | 000021 | Subscription audit log. | `subscription_event_id` PK; `subscription_id`/`business_id` FKs; `event_type`, `summary`, `metadata jsonb`. |
| `business_subscription_invoices` | 000025 | Subscription invoices. | `invoice_id` PK; `invoice_ref` UNIQUE; `status` (issued/paid/failed/void); `amount_minor`; period/due timestamps; **partial-unique `(subscription_id) WHERE status='issued'`** (one open invoice). |
| `business_addons` | 000053 | Paid add-ons distinct from plan (e.g. AI Assistant). | Composite PK `(business_id, addon)`; `active` gates entitlement; partial active index. 000054 added recurring-billing columns (`authorization_ref`, `customer_ref`, `amount_minor`, `billing_status`, `next_charge_at`, `last_charged_at`) + partial `_due_idx` for the renewal sweep. |

#### 1e. Availability & booking (home visits)

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `availability_windows` | 000010 | Published recurring availability; bookable slots derived at query time (never stored). | `window_id` PK; `business_id` FK; `weekday` (0-6); `start_minute`/`end_minute` (0-1439/1-1440); `slot_minutes` (15-480). 000062 added `recurrence` (daily/weekly/monthly/ongoing, default weekly) + `day_of_month`. |
| `bookings` | 000010 | A booking row **is** the slot reservation. | `booking_id` PK; `business_id` FK; `order_id` (composite same-tenant FK); `slot_start`/`slot_end`; `status` (held/booked/completed/cancelled/rescheduled); `deposit_payment_id`; unique `(booking_id, business_id)`. **Partial-unique `(business_id, slot_start) WHERE status IN (held,booked)`** = atomic no-double-book. |

#### 1f. Customer accounts, OTP & WhatsApp

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `customer_otp_challenges` | 000048 | Customer sign-in OTP (global, bypass-gated). | `challenge_id` PK; `code_hash`; `attempts`; `expires_at`. 000055 added `channel` (whatsapp/email) + nullable `email`, dropped NOT NULL on `phone`, indexed both `(channel,email)` and `(channel,phone)`. |
| `whatsapp_sessions` | 000051 | Inbound-bot per-sender conversation state (global). | `wa_id` PK; `business_id` FK (SET NULL, resolved mid-conversation); `state jsonb`; `expires_at`. No RLS (reached via bypass). |
| `whatsapp_inbound_messages` | 000051 | Dedupe ledger for Meta webhook retries. | `message_id` PK; `received_at`. |
| `business_password_reset_challenges` | 000052 | Dashboard self-service password reset (global, bypass-gated). | `challenge_id` PK; `business_user_id` FK; `code_hash`; `attempts`; `expires_at`. |
| `business_signin_otp_challenges` | 000063 | WhatsApp OTP sign-in for the dashboard (global, bypass-gated). | `challenge_id` PK; `whatsapp_number` (no FK — serves sign-in + pre-registration verify); `code_hash`; `attempts`; `expires_at`. |
| `ai_search_usage` | 000050 | Metered AI-search counting (platform-global, no RLS, no PII — anon subjects hashed). | Composite PK `(subject_kind, subject_id, period_month)`; `search_count`. |

#### 1g. Notifications / outbox

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `outbound_messages` | 000012 | Transactional outbox — a lifecycle event writes a row in the **same transaction** as the state change; the worker drains it. | `message_id` PK; `business_id` FK; `channel` (whatsapp/sms); `kind`; `payload jsonb`; `status` (pending/sending/sent/dead); `attempts`; `dedup_key`; `available_at`. **Unique `(business_id, dedup_key)`** = idempotent enqueue (producer inserts `ON CONFLICT DO NOTHING`); partial due-index `WHERE status IN (pending,sending)`. 000022 added `provider_message_id` + `provider_response jsonb`. |

#### 1h. Admin console

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `admin_users` | 000013 | Platform-operator logins. | `admin_user_id` PK; unique `lower(email)`; `role` (owner/operator/support). |
| `admin_sessions` | 000013 | Admin refresh-token sessions. | `session_id` PK; `refresh_token_hash` UNIQUE; partial active index. |
| `admin_role_permissions` | 000014 | Role→permission grants (seeded). | Composite PK `(role, permission)`. The permission CHECK list is progressively widened across 000021/000023/000024/000027/000029 (adds `manage_subscriptions`, `manage_plans`, `manage_promotions`, `manage_ads`, `manage_growth`). |
| `admin_operator_preferences` | 000015 | Per-operator notification prefs. | `admin_user_id` PK/FK; timezone, digest time (CHECK regex), alert toggles. 000026 added `alert_subscriptions`/`alert_promotions`. |
| `admin_platform_settings` | 000015 | Single-row platform config. | `settings_id boolean PK default true CHECK(settings_id)` (singleton pattern); `platform_name`, `support_email`, `verification_sla_hours`, `payout_review_threshold_pesewas`, `maintenance_mode`. 000046 added `brand_logo_url`. 000056 added `marketing_show_*` launch flags (all default false). |
| `admin_audit_events` | 000016 | Immutable admin audit trail (grant is SELECT/INSERT only). | `audit_event_id` PK; actor fields; `action`/`severity` (info/warning/critical); `metadata jsonb`; indexed by created/actor/severity/target. |
| `admin_money_replay_requests` | 000018 | Queued webhook-replay requests. | `replay_request_id` PK; `provider_reference`; `status` (queued/reviewed/cancelled). |
| `admin_settlement_review_holds` | 000018 | Per-business settlement holds. | `business_id` PK/FK; `is_active` with CHECK coupling `released_at`. |
| `admin_risk_review_states` | 000019 | Keyed risk-review state. | `review_key` PK; `status` (open/closed). |
| `admin_support_ticket_states` | 000020 | Keyed support-ticket state. | `ticket_key` PK; `status` (open/resolved); assignee. |

#### 1i. Growth: promotions, ads, affiliates, referrals

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `promotions` | 000024 | Discount codes (business or platform-funded). `business_id` nullable = platform-wide. | `promotion_id` PK; `discount_type` (percentage/fixed) with value CHECKs; `funding_source` (business/platform/split); `scope` (store/collection/design); `status`. Split RLS: `promotions_read_isolation` (SELECT allows `business_id IS NULL`) vs `promotions_write_isolation`. 000035 added `target_collection_id`/`target_design_id` + scope-target CHECK. |
| `promotion_redemptions` | 000024 | Redemption ledger. | `promotion_redemption_id` PK; unique `(promotion_id, order_id)`; `status` (pending/applied/void). |
| `ad_campaigns` | 000028 | Advertiser (business) campaigns. | `campaign_id` PK; `advertiser_business_id` FK; unique `(campaign_id, advertiser_business_id)`; `placement_type`, `pricing_model`, `budget_minor`, `status`. RLS keys on `advertiser_business_id`. |
| `ad_events` | 000028 | Impression/click events. | `ad_event_id` PK; composite FK to `ad_campaigns`; `event_type` (impression/click). |
| `ad_campaign_payments` | 000037 | Paystack payments for ad spend. | `payment_id` PK; composite FK to campaign; `provider_reference` unique per provider; partial-unique one-open `WHERE status='initiated'`. |
| `affiliates` | 000030 | Affiliate partners (admin-managed; **admin-bypass-only RLS**). | `affiliate_id` PK; `code` unique `lower(code)`; `commission_model`/`commission_rate`; `payout_mode`; `status`. |
| `referral_programmes` | 000031 | Referral programme definitions (admin-bypass-only RLS). | `referral_programme_id` PK; `code_prefix` unique; reward config; `status`. |
| `affiliate_clicks` | 000032 | Click tracking (admin-bypass-only RLS). | `affiliate_click_id` PK; `visitor_id`/`ip_hash`. |
| `affiliate_conversions` | 000032 | Attributed conversions (tenant-scoped). | `affiliate_conversion_id` PK; unique `(order_id)`; composite same-tenant FK; `status` (pending/approved/settled/reversed); CHECK `commission_minor <= gross_minor`. 000034 added `payout_batch_id` FK. |
| `affiliate_attribution_reservations` | 000033 | In-flight attribution holds (tenant-scoped). | `reservation_id` PK; unique `(order_id)`; composite same-tenant FK; `status` (pending/converted/void). |
| `affiliate_payout_batches` | 000034 | Settled payout batches (admin-bypass-only RLS). | `payout_batch_id` PK; `status` (settled/void); count/amount CHECKs. |
| `referral_codes` | 000036 | Per-owner referral codes. | `referral_code_id` PK; `code` unique; `owner_type` (customer/business/platform) with owner-column CHECK. Split select/write RLS (select allows `business_id IS NULL`). |
| `referrals` | 000036 | Attributed referrals. | `referral_id` PK; unique `(order_id)`; composite same-tenant FK; partial-unique `(referee_customer_id) WHERE status <> 'void'` (one referral per referee); `status` (pending/qualified/rewarded/void). |
| `referral_rewards` | 000036 | Referrer/referee rewards. | `referral_reward_id` PK; unique `(referral_id, beneficiary_type)`; `reward_kind` (voucher/commission_rebate); optional `promotion_id` FK. |

#### 1j. Misc / marketing

| Table | Mig. | Purpose | Key columns / constraints |
|---|---|---|---|
| `waitlist_leads` | 000056 | Public marketing-site lead capture (platform-level, no RLS). | `id` PK; name/business/phone/email/city/message/source; `created_at` index. |
| `business_identity_documents` | 000061 | Ghana Card identity verification (PII, tenant-isolated). | `business_id` PK/FK; `card_number`; `id_photo_url`; upserted on resubmission (flips `businesses.verification_status` to pending). |

---

### 2. Row-Level Security (multi-tenancy)

Tenant isolation is the system's primary security invariant (`docs/security/tenant-isolation.md`): a tenant is a business, every tenant-scoped table has `business_id`, and every tenant-scoped query filters by it. RLS makes the **database** — not just the application — enforce this.

**The `xtiitch_app` role.** Migration `000004` creates a dedicated `LOGIN … NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` role named `xtiitch_app` and grants it `SELECT/INSERT/UPDATE/DELETE` on tenant tables (with `ALTER DEFAULT PRIVILEGES` for future tables). **Migrations run as the database owner (a superuser, which bypasses RLS); the API connects as `xtiitch_app`, for which RLS is actually enforced.** The default `DATABASE_URL` in `config.go` bakes this in: `postgres://xtiitch_app:xtiitch_app@localhost:5432/...`.

**ENABLE + FORCE.** Every tenant table runs both `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and `… FORCE ROW LEVEL SECURITY`. FORCE is belt-and-suspenders: it applies RLS even to the table owner, so isolation holds should connection ownership ever change.

**The two session settings.** Policies read two `current_setting(...)` GUCs:
- `xtiitch.current_business_id` — the active tenant. Set per transaction by `setTenantScope`.
- `xtiitch.bypass` — an explicit escape (`'on'`) for the few legitimately cross-tenant credential lookups (login by handle, refresh by token hash, webhook lookup by provider reference), where the tenant is not yet known.

**The hardened policy shape** (introduced in `000004`, reused everywhere after):
```sql
USING (current_setting('xtiitch.bypass', true) = 'on'
       OR business_id = NULLIF(current_setting('xtiitch.current_business_id', true), '')::uuid)
```
Because `current_setting(…, true)` returns empty when unset and `NULLIF(...,'')::uuid` becomes NULL, a query that forgets to set a scope **and** doesn't set bypass matches **zero rows** — it **fails closed** rather than leaking another tenant's data.

**`setTenantScope` vs `setTenantBypass`** (`apps/api/internal/adapters/outbound/postgres/tenant.go`):
- `setTenantScope` — `tenant.go:12` — runs `select set_config('xtiitch.current_business_id', $1, true)` (the trailing `true` = transaction-local). Binds the transaction to one business so RLS constrains every subsequent query.
- `setTenantBypass` — `tenant.go:26` — runs `select set_config('xtiitch.bypass', 'on', true)`. For cross-tenant credential lookups only.
- `clearTenantBypass` — `tenant.go:36` — turns bypass back off within the same transaction. A cross-tenant lookup must narrow to a single tenant the moment it learns which one it is (then call `setTenantScope`), so the writes that follow run under real RLS — otherwise, since the policy is `bypass='on' OR business_id=…`, leaving bypass on would let writes touch any tenant's rows.

**Policy variants observed:**
- Standard tenant tables: the symmetric USING/WITH CHECK shape above (identity, catalogue, orders, bookings, handovers, delivery zones, outbox, subscriptions, addons, MFA, embeddings, identity docs, etc.).
- `promotions` / `referral_codes`: **split** SELECT vs write policies so a `NULL` `business_id` (platform-wide row) is publicly readable but not writable by a tenant.
- `affiliates`, `referral_programmes`, `affiliate_clicks`, `affiliate_payout_batches`: **admin-bypass-only** — visible/writable solely under `bypass='on'`.
- Global credential/metering tables (`customer_otp_challenges`, `business_password_reset_challenges`, `business_signin_otp_challenges`, `whatsapp_sessions`): bypass-only. `whatsapp_inbound_messages`, `ai_search_usage`, `payment_provider_events`, `waitlist_leads`, `admin_*` tables: **no RLS** (platform infra).

**The migration lesson (DML needs bypass, DDL doesn't).** Migration `000057` is the worked example: it renumbers `collections`/`size_bands` sequences before adding a unique index. Because migrations may run as a non-superuser on managed Postgres (e.g. Render) and those tables are FORCE-RLS, the renumber `UPDATE`s would match **zero rows** (the role can't see tenant rows), leaving duplicates so the index build fails. The fix: `select set_config('xtiitch.bypass','on',false)` (session-level, persists across statements) around the DML, then `'off'` at the end. Migration `000062` contrasts this: it only adds columns/constraints (DDL), which is unaffected by RLS, so it needs no bypass.

**Same-tenant FK backstops.** Independent of RLS, several tables enforce cross-table tenancy at the DB via composite FKs to `orders (order_id, business_id)` (the unique key added in `000007`): `payments`, `order_measurements`, `bookings`, `handovers`, `affiliate_conversions`, `affiliate_attribution_reservations`, `referrals`, and `orders.delivery_zone_id`. `MATCH SIMPLE` means a NULL reference skips the check, so non-order rows are unaffected.

---

### 3. Platform (`apps/api/internal/platform/`)

#### 3a. Config — complete env-var reference (`config/config.go`)

`config.Load()` reads the environment with `getenv`/`getenvInt`/`getenvList`/`getenvBool` helpers. A non-empty value wins; otherwise the default below applies. `getenvList` splits on commas and trims.

| Env var | Config field | Default | Purpose |
|---|---|---|---|
| `ADMIN_BOOTSTRAP_DISPLAY_NAME` | `AdminBootstrapDisplayName` | `""` | Display name for the bootstrapped owner admin. |
| `ADMIN_BOOTSTRAP_EMAIL` | `AdminBootstrapEmail` | `""` | Bootstrap owner admin email. |
| `ADMIN_BOOTSTRAP_EXTRA_USERS_JSON` | `AdminBootstrapExtraUsers` | `""` | JSON array of extra admin users to ensure on boot. |
| `ADMIN_BOOTSTRAP_PASSWORD` | `AdminBootstrapPassword` | `""` | Bootstrap owner admin password (secret). |
| `ADMIN_BOOTSTRAP_ROLE` | `AdminBootstrapRole` | `owner` | Role for the bootstrap admin. |
| `ANTHROPIC_API_KEY` | `AnthropicAPIKey` | `""` | Enables Claude query understanding (AI search) + AI assistant; empty → heuristic/passthrough. |
| `ANTHROPIC_QUERY_MODEL` | `AnthropicQueryModel` | `claude-haiku-4-5-20251001` | Claude model for search filters + assist. |
| `AI_ASSISTANT_ADDON_PRICE_MINOR` | `AIAssistantAddonPriceMinor` | `5000` (GHS 50) | Monthly price of the AI Assistant add-on. |
| `BUSINESS_DASHBOARD_BASE_URL` | `BusinessDashboardBaseURL` | `http://localhost:3401` | Dashboard origin (used in emails/links). |
| `CLOUDINARY_URL` | `CloudinaryURL` | `""` | Media store; empty → dev unsigned media store. |
| `CORS_ALLOWED_ORIGINS` | `CORSAllowedOrigins` (`[]string`) | localhost list + `https://*.xtiitch.com,https://xtiitch.com` | Browser CORS allow-list (go-chi `*` wildcards supported). |
| `RATE_LIMIT_RPS` | `RateLimitRPS` | `100` | Per-IP sustained rate limit; ≤0 disables. |
| `DATABASE_URL` | `DatabaseURL` | `postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable` | API DB connection (as the `xtiitch_app` RLS-enforced role). |
| `APP_ENV` | `Environment` | `development` | Environment; `production` triggers `validateProductionConfig`. |
| `EXPO_ACCESS_TOKEN` | `ExpoAccessToken` | `""` | Expo push token (mobile); surfaced in launch readiness. |
| `XTIITCH_GROWTH_POLICY_CONFIRMED` | `GrowthPolicyConfirmed` | `false` | Launch-gate flag. |
| `API_HTTP_ADDR` | `HTTPAddr` | `:8080` | Listen address (Render sets `:$PORT`). |
| `STOREFRONT_BASE_URL` | `StorefrontBaseURL` | `http://localhost:3100` | Public storefront origin (WhatsApp bot links). |
| `JWT_AUDIENCE` | `JWTAudience` | `xtiitch-clients` | JWT audience. |
| `JWT_ISSUER` | `JWTIssuer` | `xtiitch-api` | JWT issuer. |
| `JWT_SIGNING_KEY` | `JWTSigningKey` | `change-me-for-local-development` | HMAC key for access tokens (prod must override). |
| `XTIITCH_LEGAL_REVIEW_CONFIRMED` | `LegalReviewConfirmed` | `false` | Launch-gate flag. |
| `MFA_ISSUER` | `MFAIssuer` | `Xtiitch` | Label shown in authenticator apps. |
| `MFA_ENCRYPTION_KEY` | `MFAEncryptionKey` | `""` | Encrypts TOTP secrets at rest; empty → falls back to `JWT_SIGNING_KEY` (dev only). |
| `MARKETING_WAITLIST_EMAIL_TO` | `MarketingWaitlistEmailTo` | `""` | Recipient for waitlist lead notifications. |
| `MARKETING_WAITLIST_WEBHOOK_URL` | `MarketingWaitlistWebhook` | `""` | Optional waitlist webhook. |
| `MARKETING_WAITLIST_WEBHOOK_SECRET` | `MarketingWaitlistSecret` | `""` | Webhook secret. |
| `NOTIFICATION_HTTP_AUTH_VALUE` | `NotificationHTTPAuthValue` | `""` | Auth value for HTTP notification transport (readiness). |
| `NOTIFICATION_HTTP_URL` | `NotificationHTTPURL` | `""` | HTTP notification relay URL (readiness). |
| `NOTIFICATION_TRANSPORT` | `NotificationTransport` | `log` | Notification transport name (mirrors worker). |
| `OPENAI_API_KEY` | `OpenAIAPIKey` | `""` | Hosted embedding model for AI search; empty → dev hashing embedder. |
| `OPENAI_EMBEDDING_MODEL` | `OpenAIEmbeddingModel` | `text-embedding-3-small` | Embedding model name. |
| `PAYSTACK_SECRET_KEY` | `PaystackSecretKey` | `""` | Paystack secret; empty → dev payment provider. |
| `PAYSTACK_WEBHOOK_SECRET` | `PaystackWebhookKey` | `""` | Verifies Paystack webhook signatures. |
| `REDIS_URL` | `RedisURL` | `redis://localhost:6379/0` | Redis (BullMQ) connection. |
| `RESEND_API_KEY` | `ResendAPIKey` | `""` | Resend email API key; empty → email steps skipped/logged. |
| `RESEND_FROM_EMAIL` | `ResendFromEmail` | `""` | Sender identity for Resend. |
| `SONAR_HOST_URL` | `SonarHostURL` | `""` | SonarQube host (quality/readiness). |
| `SONAR_ORGANIZATION` | `SonarOrganization` | `""` | SonarQube org. |
| `SONAR_TOKEN` | `SonarToken` | `""` | SonarQube token. |
| `WHATSAPP_VERIFY_TOKEN` | `WhatsAppVerifyToken` | `""` | Answers Meta's GET webhook challenge; empty → bot dormant. |
| `WHATSAPP_APP_SECRET` | `WhatsAppAppSecret` | `""` | Verifies `X-Hub-Signature-256` on inbound POSTs. |
| `WHATSAPP_PHONE_NUMBER_ID` | `WhatsAppPhoneNumberID` | `""` | Cloud API sender id (replies + OTP delivery). |
| `WHATSAPP_ACCESS_TOKEN` | `WhatsAppAccessToken` | `""` | Cloud API access token. |
| `WHATSAPP_GRAPH_VERSION` | `WhatsAppGraphVersion` | `v21.0` | Meta Graph API version. |
| `WORKER_QUEUE_NAME` | `WorkerQueueName` | `xtiitch.default` | BullMQ queue name (Render sets `xtiitch.outbox`). |

`validateProductionConfig` (`bootstrap/app.go:467`) fails fast when `APP_ENV=production` and any insecure dev default or stub provider is still active: default/empty `JWT_SIGNING_KEY`, empty `MFA_ENCRYPTION_KEY`, empty `PAYSTACK_SECRET_KEY`, empty `CLOUDINARY_URL`, a local/`sslmode=disable` `DATABASE_URL`, or an enabled WhatsApp bot (`WHATSAPP_VERIFY_TOKEN` set) with no `WHATSAPP_APP_SECRET`.

#### 3b. Clock / IDs / Logger

- `platform/clock/system.go` — `SystemClock.Now()` returns `time.Now().UTC()`. A `Clock` port injected wherever timestamps matter, so tests can freeze time.
- `platform/ids/uuid.go` — `UUIDGenerator.NewID()` returns a `common.ID` from `uuid.NewString()`. `platform/ids/static.go` — `StaticGenerator{Next}` returns a fixed ID for deterministic tests. Both satisfy the `IDs` port passed into every service.
- `platform/logger/logger.go` — `logger.New(environment)` builds a `slog.Logger` with a JSON handler to stdout; level is `Debug` when `environment == "development"`, else `Info`.

---

### 4. Bootstrap / dependency injection (`apps/api/internal/bootstrap/app.go`)

`bootstrap.New(ctx, cfg, logger)` (`app.go:71`) is the composition root — it constructs every adapter, wires each application service, and builds the router. Order:

1. **Guardrails + DB** — `validateProductionConfig` (`app.go:73`); parse admin bootstrap commands (`app.go:77`); open the pgx pool `pgxpool.New` and `Ping` (`app.go:82-89`).
2. **Auth primitives** — `authadapter.NewJWTIssuer` (`app.go:91`) from the JWT key/issuer/audience; MFA key falls back to the JWT key when unset (`app.go:99-102`); `authadapter.NewTOTPManager` (`app.go:103`).
3. **Payment provider selection** (`app.go:105-113`): if `PAYSTACK_SECRET_KEY` is set → `paystack.NewClient(secret, webhookKey)` (live); else it logs a warning and uses `paystack.NewDevProvider(webhookKey)` — a deterministic dev provider with **real webhook-signature verification**, so the money path runs locally and in tests.
4. **Business identity repo + auth service** — `postgres.NewBusinessIdentityRepository` (`app.go:115`) then `authapp.NewService` (`app.go:116-138`), wiring: businesses/resets = the identity repo, payments = the provider, sessions = `NewAuthSessionRepository`, bcrypt hasher, JWT access + refresh issuers, Resend email sender, `NewMFARepository`, the TOTP manager, and **WhatsApp OTP sign-in** (`WhatsAppAuth` = identity repo, `OTPGen` = customer OTP generator, `WhatsAppOTP` = `buildCustomerOTPDelivery`).
5. **Authenticator + admin auth** — `authhttp.NewAuthenticator(jwtIssuer)` (`app.go:140`); `postgres.NewAdminAuthRepository` (`app.go:141`).
6. **Media store selection** (`app.go:143-154`): `CLOUDINARY_URL` set → `cloudinary.NewClientFromURL`; else `cloudinary.NewDevMediaStore()` (unsigned dev signatures).
7. **Admin auth service** — `adminauthapp.NewService` (`app.go:156-173`); its `WhatsAppEnabled` flag is true IFF both `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set. It then loops `BootstrapAdmin` over the bootstrap commands (`app.go:174-181`). `adminauthhttp.NewAuthenticator` at `app.go:182`.
8. **Domain services**, each with its Postgres repo(s) + `ids.UUIDGenerator{}`:
   - `paymentsapp.NewService` — `app.go:184` (provider, `NewPaymentRepository`, `NewBusinessChargeRepository`).
   - `promotionRepository` — `app.go:191`.
   - `catalogueapp.NewService` — `app.go:193` (`NewCatalogueRepository`, `NewStorefrontRepository`, `NewStoreSettingsRepository`, promotions, `NewDesignWaitlistRepository`).
   - `mediaapp.NewService(mediaStore)` — `app.go:202`.
   - `orderapp.NewService` — `app.go:204` (`NewOrderRepository`, payment service).
   - `availabilityapp.NewService` — `app.go:210`; `bookingapp.NewService` — `app.go:216` (depends on the availability service).
   - `deliveryapp.NewService` — `app.go:223` (`NewDeliveryRepository`, `NewDeliveryZoneRepository`).
   - `growthapp.NewService` — `app.go:230` (`NewAffiliateRepository` backs affiliates/sponsored/referrals).
   - `measurementapp.NewService` — `app.go:237`.
   - `notifyapp.NewService` — `app.go:242` (`NewNotificationRepository`).
   - `checkoutapp.NewService` — `app.go:246` (storefront, business charge, orders, bookings, promotions, affiliates, referrals, delivery zones, availability, payments — the widest fan-in; also takes the logger).
   - `customerauthapp.NewService` — `app.go:261` (`NewCustomerAuthRepository`, JWT tokens, OTP generator, WhatsApp OTP + email OTP delivery, clock).
   - `marketingapp.NewService` — `app.go:274` (`NewMarketingWaitlistRepository`, Resend sender, `EmailTo`).
9. **AI + WhatsApp bot builders** (`app.go:282-284`):
   - `buildAISearchService` (`app.go:328`): embedder = `NewOpenAIEmbedder` when `OPENAI_API_KEY` set else `NewDevEmbedder`; query parser = `NewClaudeQueryParser` when `ANTHROPIC_API_KEY` set else `NewHeuristicQueryParser`; wires `NewEmbeddingRepository` + `NewSearchUsageRepository`; kicks off a **non-blocking background embedding backfill** (2-minute timeout, batch 500).
   - `buildAIAssistService` (`app.go:378`): `NewClaudeAssistant` (returns input unchanged with no key), `NewBusinessAddonRepository`, the payment provider, price from `AI_ASSISTANT_ADDON_PRICE_MINOR`, currency GHS.
   - `buildWhatsAppBotService` (`app.go:402`): sender = `whatsappadapter.NewCloudSender` when both phone-number-id + access-token set, else `NewLoggingSender`; wires `NewWhatsAppRepository` (sessions + dedupe) and a `botcatalogue` adapter over storefront/order repos + the checkout service.
   - **OTP delivery selection**: `buildCustomerOTPDelivery` (`app.go:430`) → WhatsApp Cloud sender when creds set, else a logging delivery (dev). `buildCustomerEmailOTPDelivery` (`app.go:444`) → Resend when configured, else logs.
10. **Router** — `httpadapter.NewRouter` (`app.go:286`) receives the logger, `db.Ping` (readiness), a `SecurityOptions{Production, AllowedOrigins, RateLimitRPS}`, and every HTTP handler (each built with its service + the matching authenticator: business `authenticator`, `adminAuthenticator`, or `jwtIssuer` for customer/AI-search token verification).
11. Returns an `App` wrapping an `http.Server` (`ReadHeaderTimeout: 5s`) and the pool. `App.Close()` closes the pool. `cmd/api/main.go` calls `config.Load` → `logger.New` → `bootstrap.New`, runs `ListenAndServe`, and does a 10s graceful `Shutdown` on SIGINT/SIGTERM.

---

### 5. HTTP router + middleware (`apps/api/internal/adapters/inbound/http/`)

`NewRouter` (`router.go:23`) builds a `chi` router. **Middleware stack (in order):** `RequestID` → `RealIP` → `Recoverer` → `securityHeaders(production)` → `Timeout(20s)` → `bodyLimit` (default 2 MiB) → `corsMiddleware` (if origins set) → per-IP rate limiter (if `RateLimitRPS > 0`). Then two health endpoints at the **root** (outside `/v1`): `GET /healthz` (liveness) and `GET /readyz` (calls the injected `ready`/`db.Ping`, 503 on failure).

All application routes are mounted under **`/v1`** (`router.go:64`), which also serves `GET /v1/version`. Each handler implements `RouteRegistrar.Register(router)` and is registered into the `/v1` group.

**Security middleware** (`security.go`):
- `securityHeaders` — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict `Referrer-Policy`, COOP `same-origin`, CORP `same-site`, a locked-down `Permissions-Policy`, a JSON-API `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'`, and HSTS (unconditional in production, otherwise only over TLS / `X-Forwarded-Proto: https`).
- `bodyLimit` — wraps the body in `http.MaxBytesReader` (default `2<<20`).
- `corsMiddleware` — go-chi `cors` with the allow-list, methods GET/POST/PUT/PATCH/DELETE/OPTIONS, headers Authorization + Content-Type, `AllowCredentials: false`, 300s max-age. CORS only *grants* to listed browser origins; it never blocks server-to-server SSR traffic.
- `ipRateLimiter` — a per-client-IP token bucket (`rate.Limit(rps)`, burst `rps*2`) with a background cleanup loop evicting buckets idle >3 min; over-limit returns `429 {"error":"rate_limited"}` + `Retry-After: 1`.

**Auth middleware** (`auth/middleware.go`): `Authenticator.Middleware` (`middleware.go:46`) extracts the `Bearer` token, calls `verifier.VerifyAccessToken`, and attaches a `Principal{BusinessID, UserID, Role}` to the context. **The tenant scope always comes from the verified token's business, never a client claim** (`Principal.TenantScope()`, `middleware.go:21`). Missing/invalid tokens → 401.

**Route groups** — each handler splits **public** routes (registered directly) from **protected** routes (inside `router.Group` with `protected.Use(authenticator.Middleware)`):
- **Public / unauthenticated**: `POST /admin/auth/{login,refresh,logout}`, `GET /branding`; `POST /auth/business/{register,login,refresh,logout,password-reset/request,password-reset/confirm,mfa/verify,otp/request,otp/verify,register/otp/request}`, `GET /plans`, `GET /auth/business/handle-availability`; the whole public storefront (`GET /public/shops`, `/public/stores/{handle}`, `/public/stores/{handle}/search`, `/public/designs/{handle}`, `/public/collections/{handle}`, `POST …/waitlist`); checkout (`POST /public/stores/{handle}/{orders,cart-orders,custom-orders,bookings}`, `GET …/delivery-zones`); `GET /public/orders/{id}` (order tracking); `GET /public/stores/{handle}/availability`; growth public endpoints (`/public/affiliates/{code}/clicks`, `/public/sponsored`, `/public/referrals/{code}`); `POST /public/ai-search`; `POST /marketing/waitlist`; customer-auth OTP endpoints; and the two webhooks: `POST /webhooks/paystack`, `GET|POST /webhooks/whatsapp`.
- **Protected (business `authenticator`)**: catalogue (`/collections`, `/designs`, `/size-bands`, `/store-settings`, `/promotions`, waitlist review, prices), `/businesses/me`, orders (`/orders`, `/orders/custom`, advance/agreed-total/balance), payments/money (`/payments/checkout`, `/money/takings`, `/money/summary`, `/businesses/me/verify`), availability/booking/delivery/measurement/notification/media, AI assist + AI Assistant add-on (`/ai/assist`, `/addons/ai_assistant/*`), and business account management under `/auth/business/*` (users, MFA, password, owner-transfer, identity-verification, subscription authorization links).
- **Protected (admin `adminAuthenticator`)**: the large `/admin/*` surface (settings, business verifications, platform metrics, money rails, subscriptions, plans, promotions, ad campaigns, affiliates, referral programmes, risk reviews, support tickets, businesses/customers listings) plus `GET /admin/waitlist`.
- **Customer / AI-search**: verified via `jwtIssuer` as a `CustomerTokenVerifier` (customer session tokens), not the business authenticator.

---

### 6. Deployment topology

**`render.yaml` (backend on Render):**
- **`xtiitch-db`** — Postgres, `basic-256mb` persistent plan, region oregon, database `xtiitch`, user `xtiitch`.
- **`xtiitch-redis`** — Key Value (Redis), free 25 MB, `maxmemoryPolicy: noeviction` (don't drop queued jobs), internal-only (`ipAllowList: []`). Backs the BullMQ queue.
- **`xtiitch-api`** — Go web service, `free` plan, `rootDir: apps/api`, `healthCheckPath: /healthz`.
  - `buildCommand`: `go build -o xtiitch-api ./cmd/api && GOBIN="$PWD" go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`.
  - `startCommand`: `./migrate -path ../../infra/migrations -database "$DATABASE_URL" up && API_HTTP_ADDR=":$PORT" ./xtiitch-api` — **migrations run on API boot** via the golang-migrate CLI, then the API serves on `$PORT`.
  - Env: `APP_ENV=production`, `DATABASE_URL` (fromDatabase), `REDIS_URL` (fromService), `WORKER_QUEUE_NAME=xtiitch.outbox`, generated `JWT_SIGNING_KEY` + `MFA_ENCRYPTION_KEY`, CORS/base-URL values (`https://xtiitch.com,https://*.xtiitch.com`, `business.xtiitch.com`, `store.xtiitch.com`), Resend + marketing settings, and admin bootstrap. **`sync: false` secrets** (Render prompts, never stored in git): `ADMIN_BOOTSTRAP_PASSWORD`, `PAYSTACK_SECRET_KEY`/`PAYSTACK_PUBLIC_KEY`/`PAYSTACK_WEBHOOK_SECRET`, `CLOUDINARY_URL`, `RESEND_API_KEY`, and optional `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`WHATSAPP_*`. `generateValue: true` mints the JWT + MFA keys once.
- **`xtiitch-worker`** — Node BullMQ worker, `starter` plan (Render has no free worker tier), `NODE_VERSION=26`. `buildCommand`: `pnpm install --frozen-lockfile`; `startCommand`: `pnpm --filter @xtiitch/worker exec tsx src/index.ts`. Env: `DATABASE_URL`, `REDIS_URL`, `WORKER_QUEUE_NAME=xtiitch.outbox`, `NOTIFICATION_TRANSPORT=whatsapp_cloud`, `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` (secrets), `WHATSAPP_API_VERSION=v21.0`.

**Vercel (not in `render.yaml`):** the four SSR web apps — `@xtiitch/marketing`, `@xtiitch/storefront`, `@xtiitch/dashboard`, `@xtiitch/admin` (all **React Router v7** SSR, `react-router build`) — deploy **separately on Vercel**, at `xtiitch.com`, `store.xtiitch.com`, `business.xtiitch.com`, `admin.xtiitch.com` (with per-shop `<handle>.xtiitch.com` storefronts). Each points its `XTIITCH_API_URL` at the Render API. `@xtiitch/mobile` is an Expo app. The API's `CORS_ALLOWED_ORIGINS`, `BUSINESS_DASHBOARD_BASE_URL`, and `STOREFRONT_BASE_URL` must be set to the real Vercel/custom-domain URLs once the frontends are live.

**The worker (`apps/worker/src/`)** runs three concerns off one BullMQ queue (`config.ts` `loadConfig`, `index.ts`):
1. **Outbox drain** (`outbox.ts`, job `drain-notification-outbox`, repeats every `OUTBOX_POLL_INTERVAL_MS`=15s): `PostgresOutboxStore.claimDueMessages` claims due `outbound_messages` with `FOR UPDATE SKIP LOCKED` under an RLS **transport bypass**, marks `sending`, sends via the selected transport, then `markSent`/`markFailed` (exponential backoff to a max, dead-letters after `OUTBOX_MAX_ATTEMPTS`=5).
2. **Notification transports** (`senders.ts`, `createNotificationSender`): `disabled`, `log`, `http` (relay), or `whatsapp_cloud` (Meta Graph API `graph.facebook.com/{version}/{phoneNumberId}/messages`, recipient normalized to Ghana E.164). Production refuses to start on `log`/`disabled` or the default local DB (`validateProductionWorkerConfig`).
3. **Subscription billing sweep** (`billing.ts`, job `run-subscription-billing-sweep`, repeats hourly): a single SQL CTE fails overdue `issued` invoices, moves subscriptions to `past_due`/`grace_period` (grace after 2 failures), records events, and eventually cancels + downgrades to the free plan. Returns a summary logged by the worker.

The worker connects to Postgres as `xtiitch_app` (default URL) and flips `xtiitch.bypass='on'` for its cross-tenant drains/sweeps. It schedules a repeatable job plus a one-off `-startup` job for each enabled concern, listens for `failed` queue events, and shuts down gracefully on SIGINT/SIGTERM.

**Local dev (`docker-compose.yml`):** `postgres:16-alpine` (db/user/pass `xtiitch`, port 5432), `redis:7-alpine` (port 6379, appendonly), plus a SonarQube stack (`sonarqube:lts-community` + its own Postgres) for code quality on port 9000.

---

### 7. Testing strategy

Two tiers:

- **Unit tests** — `*_test.go` across `application/*` and adapters, run with the standard `go test`. Services take injected ports (`Clock`, `IDs`, repos, providers), so `platform/ids/static.go` and fake providers make behaviour deterministic. Worker unit tests (`apps/worker/src/*.test.ts`) run via `node --import tsx --test`.
- **Postgres integration tests** — `apps/api/internal/adapters/outbound/postgres/*_integration_test.go` (payment, balance, booking, custom-order, money, delivery, catalogue, auth, admin-auth, affiliate, storefront). They run against a **real, migrated Postgres connected as the non-superuser `xtiitch_app` role** — the only way to prove both money-correctness and tenant-safety with RLS actually enforced. `openIntegrationPool(t)` (`payment_repository_integration_test.go:79`) reads **`XTIITCH_TEST_DATABASE_URL`** and **`t.Skip`s the test when it's unset**, so a plain `go test` without a database is green. The helper `inBypass` (`:98`) opens a transaction with `set_config('xtiitch.bypass','on',true)` to seed fixtures and to make deliberate cross-tenant assertions (per the doc rule: every critical feature includes at least one cross-tenant access attempt).

To run integration tests, point `XTIITCH_TEST_DATABASE_URL` at a migrated DB using the `xtiitch_app` role, e.g. `postgres://xtiitch_app:xtiitch_app@localhost:5440/xtiitch?sslmode=disable`, then `go test ./...` in `apps/api`. Repo-level scripts (`package.json`): `pnpm test` (recursive), `pnpm lint`, `pnpm quality` (test + Sonar), plus smoke scripts `pnpm smoke:paystack` / `pnpm smoke:whatsapp` and `pnpm launch:check` (launch-gate validation).


## API — Identity, Auth & Money

> The Xtiitch Go API's identity-and-money half: business dashboard auth, the admin console, customer sign-in, Paystack split payments, delivery/fulfilment, and the marketing waitlist — all layered domain → application → adapters, mounted under `/v1`.

All routes below hang off the `/v1` mount established in `apps/api/internal/adapters/inbound/http/router.go:60`; each subsystem's `Register(chi.Router)` receives that `/v1` sub-router, so a path shown as `/auth/business/login` is served at `/v1/auth/business/login`. Every service is a pure application struct wired with ports interfaces (defined in `apps/api/internal/application/ports/`); the outbound Postgres adapters enforce tenancy through row-level security (RLS) with a narrow, deliberate bypass for genuinely cross-tenant credential lookups.

### Cross-cutting: tenancy, tokens & crypto

Shared primitives the identity/money subsystems all lean on.

**Domain types**
- `common.ID` — opaque string id with `IsZero`/`String` — `apps/api/internal/domain/common/id.go:3`.
- `common.TenantScope` — `{BusinessID}`; the tenant a request is bound to — `apps/api/internal/domain/common/tenant.go:3`.
- `common.Money` — `{Currency, MinorUnit}`, GHS pesewas; `NewGHSMoney` rejects negatives, `Add` rejects currency mismatch — `apps/api/internal/domain/common/money.go:12`; `CurrencyGHS = "GHS"` at `:5`.

**RLS mechanism** (`apps/api/internal/adapters/outbound/postgres/tenant.go`)
- `setTenantScope(ctx, tx, scope)` — binds a tx to one business via `select set_config('xtiitch.current_business_id', …, true)` so RLS scopes every subsequent query — `:12`.
- `setTenantBypass(ctx, tx)` — sets `xtiitch.bypass='on'`; used ONLY for cross-tenant credential lookups where the tenant is not yet known (login-by-handle, refresh-by-token-hash, webhook-by-provider-reference, global customer identity) — `:26`.
- `clearTenantBypass(ctx, tx)` — turns bypass back off; a cross-tenant lookup must narrow to a single tenant before writing, since the policy is `bypass='on' OR business_id=…` — `:36`. **Invariant:** a query that neither sets scope nor bypass fails closed.

**JWT tokens** (`apps/api/internal/adapters/outbound/auth/jwt.go`, HS256, all carry `iss`/`aud`/`exp` required on verify)
- `JWTIssuer` + `NewJWTIssuer(signingKey, issuer, audience)` — refuses empty signing key (`ErrMissingJWTSigningKey`) — `:20`, `:26`.
- `IssueAccessToken` — business session token, `typ:"access"`, claims `business_id`,`role`,`sub` — `:38`; verified by `VerifyAccessToken` which rejects any `typ != "access"` — `:131`.
- `IssueAdminAccessToken` — `typ:"admin_access"`, `scope:"admin"` — `:56`; `VerifyAdminAccessToken` rejects wrong typ/scope and invalid `admindomain.Role` — `:163`.
- `IssueMFAChallengeToken` / `VerifyMFAChallengeToken` — `typ:"mfa_challenge"`; grants nothing but a redeemable second-factor challenge — `:78`, `:99`.
- `IssueCustomerAccessToken` / `VerifyCustomerAccessToken` — `typ:"customer_access"`, `scope:"customer"`, claim `phone` — `:199`, `:217`. **Invariant:** the four token scopes (access / admin_access / mfa_challenge / customer_access) are mutually non-interchangeable — verify rejects a token of the wrong `typ`.

**Password & OTP crypto**
- `BcryptPasswordHasher` — `Hash`/`Compare` — `apps/api/internal/adapters/outbound/auth/bcrypt.go:5`.
- `RefreshTokenIssuer` — `NewRefreshToken` (random) + `HashRefreshToken` (only the hash is stored) — `apps/api/internal/adapters/outbound/auth/refresh.go:10`.
- `CustomerOTPGenerator` — `NewCode`/`HashCode` — `apps/api/internal/adapters/outbound/auth/customer_otp.go:18`; delivery variants: `LoggingOTPDelivery` (dev), `WhatsAppOTPDelivery`, `EmailOTPDelivery` — `:37`, `:54`, `:74`.
- `TOTPManager` — RFC 6238 TOTP with stdlib only; AES-256-GCM secret-at-rest encryption; single-use backup codes — `apps/api/internal/adapters/outbound/auth/totp.go:25`. `VerifyCode` accepts `now±skew` steps but only steps strictly greater than `afterStep` (replay guard), constant-time compare — `:92`; `EncryptSecret`/`DecryptSecret` AES-GCM with prefixed nonce — `:181`,`:198`; `HashBackupCode` SHA-256 over normalised code — `:173`.

---

### Business auth

Everything a garment business's dashboard users do to authenticate and manage their account: register a store (with an optional WhatsApp identity), log in by password or WhatsApp one-time code, rotate JWT sessions via refresh-token rotation, reset/change passwords, run opt-in TOTP MFA, manage staff users, transfer ownership, activate paid-plan recurring billing through Paystack, and submit a Ghana Card for identity verification. The service (`authapp.Service`) is a pure struct with optional dependency sets (MFA, WhatsApp OTP) that self-disable when unwired.

**Domain types**
- `authdomain` error sentinels — `ErrInvalidCredentials`, `ErrInvalidInput`, `ErrForbidden`, `ErrResetCodeInvalid` (one opaque error for wrong/expired/used/too-many reset codes), MFA errors `ErrMFAAlreadyEnabled`/`ErrMFANotEnrolled`/`ErrMFANotEnabled`/`ErrInvalidMFACode` — `apps/api/internal/domain/auth/errors.go:5`.
- `business.VerificationStatus` (`unverified`/`pending`/`verified`/`rejected`) + `Valid()` — `apps/api/internal/domain/business/business.go:5`,`:23`.
- `business.OperationalStatus` (`active`/`suspended`) + `Valid()` — `:6`,`:32`.
- `business.UserRole` (`owner`/`admin`/`staff`) — `:7`,`:18`.
- `business.Business` struct (ID/Name/Handle/PlanID/VerificationStatus/DefaultDeposit) — `:41`; `business.User` — `:50`.
- `business.ErrHandleTaken` (handle globally unique) / `business.ErrUserEmailTaken` — `apps/api/internal/domain/business/errors.go:8`,`:12`.

**Service constants** (`apps/api/internal/application/auth/service.go:22`)
- `minPasswordLength=8`, `maxPasswordLength=72` (bcrypt truncation guard), `accessTokenTTL=60m`, `refreshTokenTTL=30d`, `mfaChallengeTTL=5m`, `mfaMaxFailedAttempts=5`, `mfaLockoutDuration=15m`, `passwordResetTTL=15m`, `maxPasswordResetTries=5`, `ownerTransferConfirmation="TRANSFER OWNER"` — `:23`–`:44`.
- `handlePattern` `^[a-z0-9][a-z0-9-]*[a-z0-9]$` — `:47`; `reservedHandles` (www/app/admin/api/store/... /xtiitch) — `:53`.
- `ghanaCardPattern` `^GHA-[0-9]{9}-[0-9]$` — `:474`.
- WhatsApp OTP: `businessOTPTTL=5m`, `maxBusinessOTPAttempts=5` — `apps/api/internal/application/auth/whatsapp_otp.go:14`; error sentinels `ErrWhatsAppOTPUnavailable`/`ErrInvalidPhone`/`ErrInvalidCode`/`ErrCodeExpired`/`ErrTooManyAttempts` — `:19`.

**Service** (`authapp.Service`, `apps/api/internal/application/auth/service.go`)
- `NewService(Dependencies) Service` — wires businesses, payments, sessions, passwords, access/refresh tokens, emails, resets, dashboardURL, ids, clock, and optional MFA + WhatsApp-OTP sets — `:108`.
- `mfaEnabled()` / `whatsAppOTPEnabled()` — report whether the optional dependency set is fully wired — `:132`, `:138`.
- `RegisterBusiness(ctx, RegisterBusinessCommand) (AuthResult, error)` — normalises input, hashes password, optionally verifies a WhatsApp OTP to attach a verified WhatsApp identity, creates business+owner, issues a session — `:180`.
- `CheckHandleAvailability(ctx, raw) (HandleAvailability, error)` — same normalise/format/reserved/uniqueness rules as registration, no mutation, safe unauthenticated; reason ∈ invalid/reserved/taken — `:251`.
- `ListPublicPlans(ctx) ([]ports.PublicPlanRecord, error)` — active plan catalogue for the signup picker — `:271`.
- `InitializeSubscriptionAuthorization(ctx, cmd) (SubscriptionAuthorizationLink, error)` — starts a Paystack recurring-billing authorization for the tenant's paid plan; free plans need none — `:306`.
- `VerifySubscriptionAuthorization(ctx, cmd) (SubscriptionAuthorizationResult, error)` — confirms the authorization, flips subscription to recurring, and charges the first period **idempotently** via a deterministic activation ref — `:348`.
- `SubmitIdentityVerification(ctx, SubmitIdentityVerificationCommand) error` — validates a canonical Ghana Card PIN + photo URL and records it as `pending` for operator review; owner/admin only — `:452`.
- `LoginBusiness(ctx, LoginBusinessCommand) (AuthResult, error)` — handle+email+password login; does equalising hash work on miss (anti-enumeration); returns an MFA challenge instead of a session when the account has MFA enabled — `:476`.
- `RefreshSession(ctx, RefreshSessionCommand) (AuthResult, error)` — validates a refresh token, **revokes it, and issues a fresh pair** (rotation → single-use) — `:541`.
- `Logout(ctx, LogoutCommand) error` — revokes the session behind a refresh token; idempotent, never reveals existence — `:574`.
- `ListBusinessUsers` / `CreateBusinessUser` / `UpdateBusinessUser` / `ResetBusinessUserPassword` — staff management, all gated by `authorizeBusinessUserManagement` (owner/admin) — `:593`,`:610`,`:649`,`:677`. Create emails a best-effort invite (`sendBusinessUserInvite`, no temp password ever mailed — `:949`).
- `ChangeOwnPassword(ctx, ChangeOwnPasswordCommand) error` — self-service; confirms current password; works for owner too (scoped to caller's own id) — `:708`.
- `RequestPasswordReset(ctx, rawEmail) error` — emails a one-time code; **always returns nil** whether or not the email maps to an account — `:747`. `ConfirmPasswordReset(ctx, email, code, newPassword) error` — validates code (attempt-capped), sets password, consumes challenge — `:792`. Helpers `generateResetCode` (6-digit) / `hashResetCode` (SHA-256) — `:827`,`:835`.
- `TransferBusinessOwner(ctx, cmd) (ports.TransferBusinessOwnerResult, error)` — owner-only, requires exact `"TRANSFER OWNER"` confirmation and distinct new owner — `:848`.
- `issueSession(ctx, issueSessionInput) (AuthResult, error)` — mints access token + random refresh token, stores only the refresh hash + UA/IP, returns the pair — `:997`.
- MFA (opt-in TOTP): `GetMFAStatus` — `:1059`; `StartMFAEnrollment` (rotates a pending secret, returns provisioning URI, does not enable) — `:1080`; `ActivateMFA` (verifies first code, enables, returns one-time backup codes) — `:1118`; `DisableMFA` (needs a valid code/backup code) — `:1162`; `VerifyMFALogin` (redeems challenge token + factor for a session, re-checks user still active) — `:1198`; `verifyMFAFactor` (TOTP-with-replay-guard OR consume-backup-code, per-account lockout after 5 fails) — `:1240`; `businessUserActive` / `mfaAccountName` helpers — `:1279`,`:1294`.
- Helpers: `normalizeRegistration` — `:877`, `normalizeBusinessUserCreation` — `:912`, `authorizeBusinessUserManagement` (owner/admin) — `:933`, `isManageableBusinessUserRole` (admin/staff) — `:945`, `normalizeEmail` (net/mail) — `:976`, `normalizeHandle` — `:985`.

**WhatsApp OTP sign-in** (`apps/api/internal/application/auth/whatsapp_otp.go`)
- `RequestSignInOTP(ctx, handle, rawWhatsApp) error` — sends a code to the owner of a store handle; opaque (only sends on a real active-owner match) — `:32`.
- `RequestRegistrationOTP(ctx, rawWhatsApp) error` — sends a code to verify a number a signup form collected (pre-account) — `:51`.
- `VerifySignInOTP(ctx, VerifySignInOTPCommand) (AuthResult, error)` — verifies code then issues session for the store owner; **WhatsApp OTP replaces the password as first factor but does NOT bypass MFA** — an MFA-enrolled account still returns a challenge — `:75`.
- `deliverBusinessOTP` (mint/hash/store/send) — `:131`; `verifyBusinessOTP` (attempt-cap, hash compare, consume) — `:150`; `normalizeGhanaPhone` → canonical `233XXXXXXXXX` — `:175`.

**Ports** (interfaces the service depends on, `apps/api/internal/application/ports/ports.go`)
- `BusinessIdentityRepository` — `CreateBusinessWithOwner`, `HandleExists` (cross-tenant, bypass), `ListActivePlans`, `GetBusinessSubscription`, `ActivateRecurringBilling`, `PrepareSubscriptionActivationCharge` (deterministic idempotent ref), `RecordSubscriptionActivationPayment` (idempotent on ref), `SubmitIdentityDocument`, `FindBusinessUserByHandleAndEmail`, `FindBusinessUserCredentialsByID`, `ListBusinessUsers`, `CreateBusinessUser`, `UpdateBusinessUser`, `UpdateBusinessUserPassword`, `UpdateOwnPassword`, `TransferBusinessOwner` — `:15`.
- `PasswordResetRepository` — all cross-tenant/bypass: `FindBusinessUserByEmail`, `CreatePasswordResetChallenge`, `LatestActivePasswordResetChallenge`, `IncrementPasswordResetAttempts`, `ConsumePasswordResetChallenge`, `SetBusinessUserPasswordByID` — `:59`.
- `BusinessWhatsAppAuthRepository` — `FindBusinessUserByHandleAndWhatsApp`, `CreateSignInOTPChallenge`, `LatestActiveSignInOTPChallenge`, `IncrementSignInOTPAttempts`, `ConsumeSignInOTPChallenge` — `:187`.
- `AuthSessionRepository` — `Create`, `FindByRefreshTokenHash` (cross-tenant, bypass), `Revoke` (tenant-scoped) — `:254`.
- `PasswordHasher` `:296`, `TokenIssuer`/`TokenVerifier` `:301`/`:305`, `RefreshTokenIssuer` `:323`, `MFAChallengeIssuer`/`MFAChallengeVerifier` `:338`/`:342`, `MFASecrets` (TOTP crypto: GenerateSecret/ProvisioningURI/VerifyCode/GenerateBackupCodes/HashBackupCode/Encrypt/DecryptSecret) `:349`, `MFARepository` (Get/Upsert/Enable/ConsumeBackupCode/MarkVerified/RegisterFailedAttempt/Delete, all tenant-scoped) `:362`, `EmailSender` `:622`, `Clock` `:288`, `IDGenerator` `:292`, `PaymentProvider` (for subscription authorization) `:409`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/auth/handler.go`, registered at `Register` `:58`; `authError` maps domain errors → status at `:922`)

| Method | Path | Handler | file:line |
|---|---|---|---|
| POST | `/auth/business/register` | `registerBusiness` | handler.go:59 (fn `:205`) |
| POST | `/auth/business/login` | `loginBusiness` | handler.go:60 (fn `:429`) |
| POST | `/auth/business/password-reset/request` | `requestPasswordReset` | handler.go:63 (fn `:237`) |
| POST | `/auth/business/password-reset/confirm` | `confirmPasswordReset` | handler.go:64 (fn `:258`) |
| POST | `/auth/business/refresh` | `refreshSession` | handler.go:65 (fn `:523`) |
| POST | `/auth/business/logout` | `logout` | handler.go:66 (fn `:544`) |
| POST | `/auth/business/mfa/verify` | `verifyMFALogin` | handler.go:69 (fn `:861`) |
| POST | `/auth/business/otp/request` | `requestSignInOTP` | handler.go:72 (fn `:463`) |
| POST | `/auth/business/otp/verify` | `verifySignInOTP` | handler.go:73 (fn `:495`) |
| POST | `/auth/business/register/otp/request` | `requestRegistrationOTP` | handler.go:74 (fn `:479`) |
| GET | `/plans` | `listPlans` | handler.go:76 (fn `:281`) |
| GET | `/auth/business/handle-availability` | `checkHandleAvailability` | handler.go:78 (fn `:301`) |
| GET | `/auth/business/me` | `me` *(protected)* | handler.go:82 (fn `:559`) |
| POST | `/auth/business/subscription/authorization-link` | `initializeSubscriptionAuthorization` *(protected)* | handler.go:83 (fn `:327`) |
| POST | `/auth/business/subscription/authorization-verifications` | `verifySubscriptionAuthorization` *(protected)* | handler.go:84 (fn `:370`) |
| POST | `/auth/business/identity-verification` | `submitIdentityVerification` *(protected)* | handler.go:85 (fn `:405`) |
| GET | `/auth/business/users` | `listBusinessUsers` *(protected)* | handler.go:86 (fn `:573`) |
| POST | `/auth/business/users` | `createBusinessUser` *(protected)* | handler.go:87 (fn `:597`) |
| PATCH | `/auth/business/users/{id}` | `updateBusinessUser` *(protected)* | handler.go:88 (fn `:627`) |
| POST | `/auth/business/users/{id}/password` | `resetBusinessUserPassword` *(protected)* | handler.go:89 (fn `:657`) |
| POST | `/auth/business/password` | `changeOwnPassword` *(protected)* | handler.go:92 (fn `:685`) |
| POST | `/auth/business/owner-transfer` | `transferBusinessOwner` *(protected)* | handler.go:93 (fn `:713`) |
| GET | `/auth/business/mfa` | `mfaStatus` *(protected)* | handler.go:94 (fn `:775`) |
| POST | `/auth/business/mfa/setup` | `startMFAEnrollment` *(protected)* | handler.go:95 (fn `:796`) |
| POST | `/auth/business/mfa/activate` | `activateMFA` *(protected)* | handler.go:96 (fn `:816`) |
| POST | `/auth/business/mfa/disable` | `disableMFA` *(protected)* | handler.go:97 (fn `:839`) |

The `protected` group (`:80`) applies `Authenticator.Middleware` (`apps/api/internal/adapters/inbound/http/auth/middleware.go:46`), which verifies the bearer access token and attaches a server-derived `Principal{BusinessID,UserID,Role}` — the tenant scope is the token's business, never a client claim (`middleware.go:15`, `TenantScope()` `:21`).

**Notable logic / invariants**
- **Refresh-token rotation:** every refresh revokes the presented session and issues a new pair, so a stolen-then-used refresh token is single-use (`service.go:541`); only the SHA-256 refresh hash is stored (`refresh.go:25`).
- **MFA is never bypassed:** both password login (`service.go:496`) and WhatsApp-OTP login (`whatsapp_otp.go:94`) short-circuit to a challenge token when MFA is enabled; a full session only issues after `VerifyMFALogin` re-checks the user is still active (`service.go:1215`). TOTP replay is blocked by the strictly-greater-than-`afterStep` guard (`totp.go:104`); 5 bad factors → 15-minute lockout (`service.go:1271`).
- **Opacity / anti-enumeration:** login does equalising bcrypt work on a miss (`service.go:487`); password-reset request always returns nil (`service.go:747`); WhatsApp sign-in OTP only sends on a real match (`whatsapp_otp.go:41`); one opaque `ErrResetCodeInvalid` covers all reset-code failure modes.
- **Idempotent first subscription charge:** `PrepareSubscriptionActivationCharge` returns a deterministic ref + should-charge flag so a repeated verify reuses the ref (Paystack dedupes, paid-invoice insert no-ops); status only reads `active` when a paid invoice exists (`service.go:383`–`:429`).
- **Ghana Card:** submission validated to canonical `GHA-#########-#` with an http(s) photo URL ≤2048 chars, owner/admin only, moves the business to `pending` (`service.go:452`).
- **Cross-tenant bypass** is used by the outbound `BusinessIdentityRepository` for exactly the tenant-unknown lookups: handle-uniqueness (`business_identity_repository.go:293`,`:300`), login-by-handle+email (`:602`,`:611`), WhatsApp handle+number (`:653`,`:660`), and the entire password-reset + sign-in-OTP challenge stores; `AuthSessionRepository.FindByRefreshTokenHash` bypasses too (`auth_session_repository.go:60`).

---

### adminauth

The Xtiitch operations console: password login for platform staff, role-and-permission RBAC, business-verification decisions (approve/reject/hold on Ghana Card submissions), a launch-readiness gate report, and the platform's back-office surface — subscriptions/billing, plans, promotions, ad campaigns, affiliates/referrals, money-rail ops (replay/reversal/settlement holds), risk reviews, support tickets, customer data-protection (export/erasure), audit log, and platform settings. It is single-tenant-agnostic: admin tables are not tenant-scoped, and every cross-tenant read/write goes through the RLS bypass. `adminauth.Service` and its handler are the two largest files in the API (~6.3k and ~5.1k lines).

**Domain types** (`apps/api/internal/domain/admin/`)
- `admin.Role` (`owner`/`operator`/`support`) + `Valid()` + `Permissions()` (baseline per-role set) — `admin.go:3`,`:37`,`:46`; constants `admin.go:10`–`:12`.
- `admin.Permission` — 13 capability grants (`manage_admin_users`, `manage_roles`, `manage_settings`, `review_businesses`, `manage_money_rails`, `manage_subscriptions`, `manage_plans`, `manage_promotions`, `manage_ads`, `manage_growth`, `manage_risk`, `manage_support`, `view_audit`) + `Valid()` — `admin.go:5`,`:16`–`:28`,`:87`.
- `admin.AuditSeverity` (`info`/`warning`/`critical`) + `Valid()` — `admin.go:7`,`:32`–`:34`,`:96`.
- Catalog helpers `RoleCatalog()` `:105`, `PermissionCatalog()` `:109`.
- `admin.ErrUserEmailTaken` — `errors.go:5`. (Auth-flow errors `ErrForbidden`/`ErrInvalidInput`/`ErrInvalidCredentials` are reused from `domain/auth`.)

**Service constants** (`apps/api/internal/application/adminauth/service.go`)
- `minPasswordLength=8`/`maxPasswordLength=72` `:21`; `accessTokenTTL=15m` `:23`; `refreshTokenTTL=30d` `:24`; `customerErasureConfirmation="ERASE CUSTOMER DATA"` `:1149`; `brandingUploadFolder="xtiitch/branding"` `:4032`; verification-decision values `approved`/`rejected`/`held` `:130`–`:132`.

**Service** (`adminauth.Service`, `NewService` returns a value; all methods `func (s Service)`) — struct `:27`, deps `:47`, ctor `:65`.
- Auth/sessions: `WhatsAppEnabled()` `:86`; `BootstrapAdmin` (idempotent bootstrap owner) `:873`; `Login` (verify → session → audit) `:893`; `Refresh` (rotate refresh token) `:940`; `Logout` `:967`; `Me` (rejects inactive) `:996`.
- Users/roles: `ListUsers` `:1012`; `ListRolePermissions` (live DB grants) `:4053`; `UpdateRolePermissions` (perm `manage_roles`) `:4062`; `CreateUser` (perm `manage_admin_users`) `:4109`; `UpdateUser` (self-lockout guard) `:4159`.
- Audit: `ListAuditEvents` `:1020`.
- Business verification: `ListBusinessVerifications` (perm `review_businesses`) `:1034`; `DecideBusinessVerification` (approve/reject/hold + audit) `:1048`; `ListBusinesses` `:1103`; `UpdateBusinessStatus` (suspend/reactivate) `:3761`.
- Customers / Act 843 data protection: `ListCustomers` `:1114`; `ExportCustomerData` (read-only subject access) `:1133`; `EraseCustomerData` (destructive; perm `manage_risk` + typed confirmation + critical audit) `:1162`.
- Metrics/ops: `GetPlatformMetrics` `:1199`; `GetMoneyRails` `:1210`; `GetOperationsHealth` `:1221`; `GetAdminNotifications` `:1578`; `GetAdminReports` `:1627`.
- Launch readiness: `GetLaunchReadiness` (perm `manage_settings`; tallies ready/watch/blocked) `:1652`; checks builder `launchReadinessChecks` `:4767`.
- Subscriptions/billing: `ListSubscriptions` `:1682`, `UpdateSubscription` `:1696`, `IssueSubscriptionInvoice` `:1770`, `MarkSubscriptionInvoicePaid` `:1834`, `MarkSubscriptionInvoiceFailed` `:1886`, `RunSubscriptionBillingSweep` `:1938`, `InitializeSubscriptionAuthorization` `:1995`, `VerifySubscriptionAuthorization` `:2073`, `RunSubscriptionRecurringSweep` `:2153`.
- Plans (perm `manage_plans`): `ListPlans` `:2289`, `CreatePlan` `:2303`, `UpdatePlan` `:2352`, `ArchivePlan` `:2401`.
- Promotions (`manage_promotions`): `:2449`/`:2463`/`:2506`/`:2549`. Ad campaigns (`manage_ads`): `:2596`/`:2610`/`:2653`/`:2696`/`CollectAdCampaignPayment :2743`. Affiliates+growth (`manage_growth`): `:2850`–`:3087`. Referrals: `:3134`–`:3333`.
- Money-rail ops (`manage_money_rails`): `QueueMoneyReplay` `:3390`, `ReverseMoneyPayment` `:3447`, `SetSettlementReviewHold` `:3510`. Risk (`manage_risk`): `ListRiskReviews` `:3573`, `SetRiskReviewStatus` `:3584`. Support (`manage_support`): `ListSupportTickets` `:3657`, `UpdateSupportTicket` `:3671`.
- Settings/profile/branding: `GetProfileSettings` `:3831`, `UpdateProfile` `:3845`, `UpdatePreferences` `:3890`, `GetPlatformSettings` `:3934`, `UpdatePlatformSettings` (perm `manage_settings`) `:3938`, `UpdateMarketingFlags` `:3985`, `SignBrandingUpload` (Cloudinary) `:4037`.
- Key internals: `recordAudit` `:4234`; `issueSession` `:4278`; `authorizePermission` (central RBAC gate) `:4546`; `permissionsForRole` (reads live grants, not defaults) `:4563`; `statusForBusinessVerificationDecision` `:4463`; `requiredOwnerPermissions` (owner must keep `manage_admin_users`+`manage_roles`) `:~4638`.

**Ports** (`apps/api/internal/application/ports/admin.go`)
- `AdminUserRepository` — `EnsureBootstrapUser`, `FindByEmail`, `FindByID`, `ListAdminUsers`, `CreateAdminUser`, `UpdateAdminUser`, `UpdateAdminProfile`, `ListAdminRolePermissions`, `ReplaceAdminRolePermissions`, `Get/UpdateAdminPreferences`, `Get/UpdateAdminPlatformSettings`, `UpdateAdminMarketingFlags`, `RecordLogin` — `admin.go:13`.
- `AdminAuditRepository` — `CreateAdminAuditEvent`, `ListAdminAuditEvents` — `admin.go:31`.
- `AdminBusinessRepository` — 50+ methods: verification cases + `DecideAdminBusinessVerification`, businesses/customers (`ExportAdminCustomer`/`EraseAdminCustomer`), `UpdateAdminBusinessStatus`, platform metrics/money-rails, subscriptions/invoices/sweeps, plans, promotions, ad campaigns (+payment), affiliates/attribution/payouts, referral programmes/codes/rewards, `QueueAdminMoneyReplay`/`ReverseAdminMoneyPayment`/`SetAdminSettlementReviewHold`, risk reviews, support tickets — `admin.go:36`.
- `AdminSessionRepository` — `Create`, `FindByRefreshTokenHash`, `Revoke` — `admin.go:1090`.
- `AdminTokenIssuer.IssueAdminAccessToken` `:1116` / `AdminTokenVerifier.VerifyAdminAccessToken` `:1120`; `VerifiedAdminAccessToken{Subject,Role}` `:1131`.
- Shared ports from `ports.go`: `Clock`, `IDGenerator`, `PasswordHasher`, `RefreshTokenIssuer`, `PaymentProvider`, `MediaStore`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/adminauth/handler.go`, `Register` `:110`). Routes 1–4 are public; routes 5–74 sit in a `router.Group` with `authenticator.Middleware` applied (`:118`). Middleware injects a server-derived `Principal{AdminUserID, Role}` — `apps/api/internal/adapters/inbound/http/adminauth/middleware.go:37`. All paths shown are under `/v1`. Abridged (each row cites its exact registration line):

| Method | Path | Handler | file:line |
|---|---|---|---|
| POST | `/admin/auth/login` *(public)* | `login` | handler.go:112 |
| POST | `/admin/auth/refresh` *(public)* | `refresh` | handler.go:113 |
| POST | `/admin/auth/logout` *(public)* | `logout` | handler.go:114 |
| GET | `/branding` *(public)* | `branding` | handler.go:116 |
| GET | `/admin/auth/me` | `me` | handler.go:120 |
| GET/PATCH | `/admin/settings/profile` | `profileSettings` / `updateProfile` | handler.go:121–122 |
| PATCH | `/admin/settings/preferences` | `updatePreferences` | handler.go:123 |
| GET/PATCH | `/admin/settings/platform` | `platformSettings` / `updatePlatformSettings` | handler.go:124–125 |
| POST | `/admin/platform-settings/marketing-flags` | `updateMarketingFlags` | handler.go:126 |
| POST | `/admin/settings/branding/upload-signature` | `signBrandingUpload` | handler.go:127 |
| GET | `/admin/business-verifications` | `businessVerifications` | handler.go:128 |
| POST | `/admin/business-verifications/{id}/decision` | `decideBusinessVerification` | handler.go:129 |
| GET | `/admin/platform-metrics` | `platformMetrics` | handler.go:130 |
| GET | `/admin/money-rails` | `moneyRails` | handler.go:131 |
| GET | `/admin/operations-health` | `operationsHealth` | handler.go:132 |
| GET | `/admin/notifications` | `adminNotifications` | handler.go:133 |
| GET | `/admin/reports` | `adminReports` | handler.go:134 |
| GET | `/admin/launch-readiness` | `launchReadiness` | handler.go:135 |
| GET | `/admin/subscriptions` | `subscriptions` | handler.go:136 |
| POST | `/admin/subscriptions/billing-sweeps` | `runSubscriptionBillingSweep` | handler.go:137 |
| POST | `/admin/subscriptions/recurring-charges` | `runSubscriptionRecurringSweep` | handler.go:138 |
| PATCH | `/admin/subscriptions/businesses/{id}` | `updateSubscription` | handler.go:139 |
| POST | `/admin/subscriptions/businesses/{id}/authorization-link` | `initializeSubscriptionAuthorization` | handler.go:140 |
| POST | `/admin/subscriptions/businesses/{id}/authorization-verifications` | `verifySubscriptionAuthorization` | handler.go:141 |
| POST | `/admin/subscriptions/businesses/{id}/invoices` | `issueSubscriptionInvoice` | handler.go:142 |
| POST | `/admin/subscriptions/invoices/{id}/paid` | `markSubscriptionInvoicePaid` | handler.go:143 |
| POST | `/admin/subscriptions/invoices/{id}/failed` | `markSubscriptionInvoiceFailed` | handler.go:144 |
| GET/POST | `/admin/plans` | `plans` / `createPlan` | handler.go:145–146 |
| PATCH | `/admin/plans/{id}` | `updatePlan` | handler.go:147 |
| POST | `/admin/plans/{id}/archive` | `archivePlan` | handler.go:148 |
| GET/POST | `/admin/promotions` | `promotions` / `createPromotion` | handler.go:149–150 |
| PATCH | `/admin/promotions/{id}` | `updatePromotion` | handler.go:151 |
| POST | `/admin/promotions/{id}/archive` | `archivePromotion` | handler.go:152 |
| GET/POST | `/admin/ad-campaigns` | `adCampaigns` / `createAdCampaign` | handler.go:153–154 |
| PATCH | `/admin/ad-campaigns/{id}` | `updateAdCampaign` | handler.go:155 |
| POST | `/admin/ad-campaigns/{id}/payments` | `collectAdCampaignPayment` | handler.go:156 |
| POST | `/admin/ad-campaigns/{id}/archive` | `archiveAdCampaign` | handler.go:157 |
| GET | `/admin/affiliates` | `affiliates` | handler.go:158 |
| GET | `/admin/affiliate-attribution` | `affiliateAttribution` | handler.go:159 |
| PATCH | `/admin/affiliate-conversions/{id}/status` | `updateAffiliateConversionStatus` | handler.go:160 |
| POST | `/admin/affiliates/{id}/payouts` | `createAffiliatePayout` | handler.go:161 |
| POST/PATCH | `/admin/affiliates` `/{id}` | `createAffiliate` / `updateAffiliate` | handler.go:162–163 |
| POST | `/admin/affiliates/{id}/archive` | `archiveAffiliate` | handler.go:164 |
| GET/POST | `/admin/referral-programmes` | `referralProgrammes` / `createReferralProgramme` | handler.go:165–166 |
| PATCH | `/admin/referral-programmes/{id}` | `updateReferralProgramme` | handler.go:167 |
| POST | `/admin/referral-programmes/{id}/codes` | `createReferralCode` | handler.go:168 |
| POST | `/admin/referral-programmes/{id}/archive` | `archiveReferralProgramme` | handler.go:169 |
| POST | `/admin/referral-rewards/issue` | `issueReferralRewards` | handler.go:170 |
| POST | `/admin/money-rails/replay-requests` | `queueMoneyReplay` | handler.go:171 |
| POST | `/admin/money-rails/payment-reversals` | `reverseMoneyPayment` | handler.go:172 |
| PATCH | `/admin/money-rails/businesses/{id}/settlement-hold` | `setSettlementReviewHold` | handler.go:173 |
| GET | `/admin/risk-reviews` | `riskReviews` | handler.go:174 |
| PATCH | `/admin/risk-reviews/{key}` | `updateRiskReviewStatus` | handler.go:175 |
| GET | `/admin/support-tickets` | `supportTickets` | handler.go:176 |
| PATCH | `/admin/support-tickets/{key}` | `updateSupportTicket` | handler.go:177 |
| GET | `/admin/businesses` | `businesses` | handler.go:178 |
| GET | `/admin/customers` | `customers` | handler.go:179 |
| GET | `/admin/customers/{id}/export` | `exportCustomer` | handler.go:180 |
| POST | `/admin/customers/{id}/erase` | `eraseCustomer` | handler.go:181 |
| PATCH | `/admin/businesses/{id}/status` | `updateBusinessStatus` | handler.go:182 |
| GET | `/admin/audit-events` | `auditEvents` | handler.go:183 |
| GET | `/admin/exports/{dataset}.csv` | `exportDatasetCSV` | handler.go:184 |
| GET | `/admin/roles` | `roles` | handler.go:185 |
| PATCH | `/admin/roles/{role}` | `updateRolePermissions` | handler.go:186 |
| GET/POST | `/admin/users` | `listUsers` / `createUser` | handler.go:187–188 |
| PATCH | `/admin/users/{id}` | `updateUser` | handler.go:189 |

**Notable logic / invariants**
- **RBAC is DB-driven, not code-default:** `authorizePermission` (`service.go:4546`) resolves the actor's live grants via `permissionsForRole`→`ListRolePermissions` (`:4563`,`:4053`); the domain `Role.Permissions()` set is only the seed/baseline. `ActorRole`/`ActorUserID` always come from the authenticated `Principal`, never the request body.
- **Role-grant invariants:** `normalizePermissionSet` requires all permissions valid and that an owner retains `manage_admin_users`+`manage_roles` (`requiredOwnerPermissions`), else `ErrInvalidInput`. `UpdateUser` blocks self-lockout — an actor cannot deactivate themselves or drop their own owner role (`service.go:4173`).
- **Verification decision flow:** authorize `review_businesses`, map decision→status (approved→verified, rejected→rejected, held→pending; `:4463`), persist via `DecideAdminBusinessVerification` (under bypass), and audit with severity by outcome — rejected = **critical**, held = warning, approved = info (`:4501`); operator note truncated to 600 runes.
- **Launch-readiness gate:** perm `manage_settings`; 10 checks (admin hardening / non-default JWT key, Paystack creds, Paystack sandbox smoke — stays "watch", notification transport, marketing intake, Cloudinary, Expo push, legal + growth policy human gates, SonarCloud). Counts blocked/watch/ready; config from env in `bootstrap/app.go`.
- **Session/token:** `issueSession` (`:4278`) mints a 15-minute admin JWT (`typ:"admin_access"`,`scope:"admin"`) plus a 30-day opaque refresh token stored only as a hash. `Login` (`:893`) is timing-safe (dummy hash on unknown/inactive user). `Refresh` (`:940`) rejects revoked/inactive/expired and rotates; `Logout` no-ops on unknown token. Middleware requires `Bearer` + verifies via `VerifyAdminAccessToken` (`middleware.go:37`).
- **No admin MFA:** admin login is single-factor password→session. The `MFAChallenge*` ports belong to business auth (keyed on `business.UserRole`), not adminauth; the only OTP touchpoint here is surfacing the customer WhatsApp flag via `WhatsAppEnabled()`/`/branding`.
- **Destructive-action guard:** `EraseCustomerData` needs perm `manage_risk` **and** the verbatim `"ERASE CUSTOMER DATA"` confirmation and always writes a critical audit event; the repo anonymises across tenants while retaining order/payment rows (Act 843).
- **RLS bypass everywhere:** admin tables are not tenant-scoped, so `admin_auth_repository.go` opens a tx and calls `setTenantBypass` before ~38 cross-tenant queries (e.g. `:738`,`:815`,`:875`,`:973`,`:1086`,`:1190`…); customer export/erase then `clearTenantBypass` to narrow to one tenant before writing. Plain user/session queries run directly on the pool without bypass (`EnsureBootstrapUser`, `FindByEmail`, session create/find/revoke).

---

### customerauth

The storefront shopper's identity: passwordless sign-in by WhatsApp phone OTP or email OTP, a long-lived customer session token, and the customer's cross-shop order history and editable profile. Customers are a **global** identity (no tenant), so the repository runs under the RLS bypass throughout.

**Domain types**
- `customer.Customer` — `{ID, Email, DisplayName, Phone}` — `apps/api/internal/domain/customer/customer.go:5`.
- `ports.CustomerOTPChannel` — `whatsapp` / `email` — `apps/api/internal/application/ports/customerauth.go:12`,`:14`.

**Service constants** (`apps/api/internal/application/customerauth/service.go:15`)
- `otpTTL=5m`, `maxOTPAttempts=5`, `customerTokenTTL=30d` — `:16`; error sentinels `ErrInvalidPhone`/`ErrInvalidEmail`/`ErrInvalidCode`/`ErrCodeExpired`/`ErrTooManyAttempts` — `:21`.

**Service** (`customerauth.Service`)
- `NewService(Dependencies) Service` — repo, tokens, otp, phone delivery, optional email delivery, ids, clock — `:49`.
- `RequestOTP(ctx, rawPhone) error` — issues a WhatsApp code; opaque about whether the customer exists — `:64`.
- `RequestEmailOTP(ctx, rawEmail) error` — issues an email code; if no email delivery is configured it stays opaque (returns nil) — `:88`.
- `VerifyOTP(ctx, rawPhone, code) (CustomerAuthResult, error)` — verifies phone code, upserts the customer by phone, issues token — `:125`.
- `VerifyEmailOTP(ctx, rawEmail, code) (CustomerAuthResult, error)` — verifies email code, upserts customer by email (no phone), issues token — `:144`.
- `verifyChallenge(ctx, channel, identifier, code)` — shared: resolve active challenge, attempt-cap, hash-compare, consume on match — `:164`.
- `issueCustomerToken(ctx, customerID, phone, email)` — mints the 30-day customer token — `:188`.
- `ListOrders(ctx, customerID)` — cross-shop order history — `:210`; `GetProfile` — `:215`; `UpdateProfile(ctx, customerID, displayName, email)` — phone is immutable (it's the verified login) — `:221`.
- Helpers `normalizeEmail` (net/mail + dotted-domain check) `:228`, `normalizeGhanaPhone` `:248`.

**Ports** (`apps/api/internal/application/ports/customerauth.go`)
- `CustomerAuthRepository` — `CreateOTPChallenge`, `LatestActiveOTPChallenge`, `IncrementOTPAttempts`, `ConsumeOTPChallenge`, `UpsertVerifiedCustomerByPhone`, `UpsertVerifiedCustomerByEmail`, `ListCustomerOrders` (cross-tenant), `GetCustomerProfile`, `UpdateCustomerProfile` — `:22`.
- `CustomerTokenIssuer` `:84` / `CustomerTokenVerifier` `:88`; `CustomerOTPDelivery` (`SendOTP`) `:105`; `CustomerEmailOTPDelivery` (`SendEmailOTP`) `:112`; `OTPGenerator` `:117`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/customerauth/handler.go`, `Register` `:36`; error map `customerAuthError` `:227`). The two `/customer/me`+`/customer/orders` reads and `PATCH /customer/me` verify the bearer token inside the handler via `authCustomer` (`:129`) rather than a route-group middleware.

| Method | Path | Handler | file:line |
|---|---|---|---|
| POST | `/customer/auth/request-otp` | `requestOTP` | handler.go:37 (fn `:79`) |
| POST | `/customer/auth/verify-otp` | `verifyOTP` | handler.go:38 (fn `:100`) |
| GET | `/customer/me` | `me` | handler.go:39 (fn `:143`) |
| PATCH | `/customer/me` | `updateProfile` | handler.go:40 (fn `:169`) |
| GET | `/customer/orders` | `orders` | handler.go:41 (fn `:202`) |

The request/verify handlers pick channel by the JSON `channel` field (default = WhatsApp phone; `isEmailChannel` `:68`).

**Notable logic / invariants**
- Both request endpoints always answer **202** and never reveal whether the identifier is registered (`handler.go:96`).
- Global customer identity: `CustomerAuthRepository` runs every method under the bypass (`customer_auth_repository.go:32`,`:88`,`:143`,`:169`,`:219`,`:267`); order history is deliberately cross-tenant (`ListCustomerOrders`).
- Distinct token scope: customer tokens carry `scope:"customer"`/`typ:"customer_access"` and cannot be used on business/admin surfaces (`jwt.go:217`).
- Phone is the verified login and is immutable on profile update (`service.go:221`).

---

### payments

Money movement for through-platform sales via Paystack split charges, plus off-platform ("manual") takings tracking and a per-business money summary. Xtiitch never holds funds: a charge splits at the provider between the business's subaccount and the platform commission, and a payment only advances to `succeeded` on a signed, verified, idempotent webhook.

**Domain types** (`apps/api/internal/domain/money/`)
- `money.Commission(amountMinor, basisPoints) int64` — `amount*bps/10000`, floored to whole pesewa, never rounds in the platform's favour; ≤0 inputs → 0 — `commission.go:10`.
- `money.DepositFloorMinor = 10000` (GHS 100 hard floor) + `ValidateDepositConfig` + `ResolveDeposit(designOverride, storeDefault)` — `deposit.go:8`,`:14`,`:26`.
- `money.PaymentStatus` (`initiated`/`succeeded`/`failed`/`reversed`) — `payment.go:5`.
- `money.PaymentPurpose` (`standard_full`/`deposit`/`balance`/`booking_deposit`/`cart_full`/`marketplace_split`) + `Valid()` — `payment.go:14`,`:27`.
- `money.PaymentMethod` (`momo`/`card`) + `Valid()` — `payment.go:36`,`:43`.
- `money.Payment` struct (ID/BusinessID/OrderID/Purpose/Amount/Method/ProviderReference/Status/ThroughPlatform/CommissionAmount) — `payment.go:52`.

**Service** (`paymentsapp.Service`, `apps/api/internal/application/payments/service.go`) — error sentinels `ErrBusinessNotVerified`/`ErrInvalidCharge`/`ErrInvalidSignature`/`ErrInvalidTaking` `:15`.
- `NewService(Dependencies) Service` — provider, payments repo, businesses (charge context), ids — `:36`.
- `VerifyBusiness(ctx, VerifyBusinessCommand) error` — provisions the Paystack subaccount from settlement details and marks verified; **idempotent** (already-provisioned → no-op); owner/admin only — `:55`.
- `InitiateCharge(ctx, InitiateChargeCommand) (ChargeResult, error)` — gates on verified+subaccount, computes commission (with optional bounded override 0..amount), raises a split `InitializeTransaction`, records the payment as `initiated` — `:107`.
- `HandleProviderEvent(ctx, payload, signature) error` — verifies HMAC signature over the raw body, parses the event, and confirms idempotently via the repo — `:177`.
- `ListPayments(ctx, scope)` — `:196`.
- `LogManualTaking(ctx, LogManualTakingCommand) (LogManualTakingResult, error)` — records an off-platform sale (`cash`/`momo`/`other`); **off-platform money is always fee-free** — zero commission, `not_applicable` status — `:220`.
- `ListManualTakings` `:264`; `MoneySummary(ctx, scope)` `:268`.
- `authorizeMoneyManagement(scope, role)` — owner/admin only — `:272`.

**Ports** (`apps/api/internal/application/ports/ports.go`)
- `PaymentProvider` — `CreateBusinessSubaccount`, `InitializeTransaction`, `InitializeAuthorization`, `VerifyAuthorization`, `ChargeAuthorization`, `VerifyWebhookSignature` (over raw bytes), `ParseChargeEvent` — `:409`.
- `PaymentRepository` — `Create`, `ConfirmFromProvider` (records event + advances payment in one tx → re-delivery is a no-op), `ListByBusiness`, `RecordManualTaking`, `ListManualTakings`, `MoneySummary` — `:499`.
- `BusinessChargeRepository` — `GetChargeContext` (name/verified/subaccountRef/commissionBps), `ProvisionSubaccount` — `:593`.
- `ProviderChargeEvent` carries an idempotency `Signature` (provider+type+reference) — `:489`.

**Outbound Paystack adapter** (`apps/api/internal/adapters/outbound/paystack/`)
- `Client` (live) — `NewClient(secretKey, webhookSecret)`; `CreateBusinessSubaccount` (POST `/subaccount`, sends **`settlement_bank`** — the MoMo network code MTN/VOD/ATL or a bank code — which Paystack **requires**, plus `account_number`+`percentage_charge:0`), `InitializeTransaction` (POST `/transaction/initialize`; single-store sends `subaccount`+`transaction_charge`+`bearer:"subaccount"`, **marketplace** sends a flat multi-subaccount `split` object — see P0.4 below), `InitializeAuthorization` (POST `/transaction/initialize` — a **standard checkout** priced at the first-period `amount`, returns `authorization_url` = checkout.paystack.com; replaced the old `/customer/authorization/initialize` direct-debit **mandate** link, which resolved to a dead 404 page for this merchant account), `VerifyAuthorization` (GET `/transaction/verify/{ref}` — returns `Succeeded` (data.status=="success"), `AmountMinor` (data.amount), and the reusable `authorization.{authorization_code,channel,bank,reusable}` + `customer.{code,email}`), `ChargeAuthorization` (POST `/transaction/charge_authorization` — used ONLY by the recurring renewal sweeps for period 2+, never for the first period) — `client.go`.
- `DevProvider` — used when no live secret is configured; stubs HTTP deterministically but runs **real** webhook verification + event parsing so the money path is exercised as in prod — `dev.go:14`.
- `verifyWebhookSignature(secret, payload, signature)` — HMAC-**SHA512** of the raw body keyed by the webhook secret, **constant-time** compare; empty secret/sig → false — `signature.go:18`.
- `parseChargeEvent(payload)` — `Succeeded` only for `charge.success` with data `status=="success"`; dedupe `Signature = "paystack:"+event+":"+reference` — `signature.go:42`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/payments/handler.go`, `Register` `:41`; error map `paymentError` `:293`)

| Method | Path | Handler | file:line |
|---|---|---|---|
| POST | `/webhooks/paystack` | `webhook` *(public, signature-checked)* | handler.go:42 (fn `:272`) |
| POST | `/businesses/me/verify` | `verify` *(protected)* | handler.go:46 (fn `:83`) |
| POST | `/payments/checkout` | `checkout` *(protected)* | handler.go:47 (fn `:109`) |
| GET | `/payments` | `listPayments` *(protected)* | handler.go:48 (fn `:144`) |
| POST | `/money/takings` | `logTaking` *(protected)* | handler.go:49 (fn `:187`) |
| GET | `/money/takings` | `listTakings` *(protected)* | handler.go:50 (fn `:224`) |
| GET | `/money/summary` | `moneySummary` *(protected)* | handler.go:51 (fn `:252`) |

The protected group (`:44`) reuses the business `authhttp.Authenticator`. The webhook reads the raw body (`io.LimitReader`, 1 MiB), passes it and the `x-paystack-signature` header to the service, returns **401** on bad signature and **500** (no-ack, provider retries) on any other failure (`:272`).

**Notable logic / invariants**
- **Webhook idempotency:** `ConfirmFromProvider` inserts the event into `payment_provider_events` with `on conflict (provider, event_signature) do nothing`; a re-delivery affects 0 rows → returns `AlreadyProcessed` and no state change (`payment_repository.go:64`,`:154`). The lookup-by-reference and event-record run under the RLS bypass (tenant unknown), then narrow to the matched business before mutating (`payment_repository.go:73`). Unmatched references cascade to subscription-invoice then ad-campaign reconciliation (`:90`,`:101`).
- **Double-charge backstop:** a second in-flight balance charge for an order is rejected by the partial unique index `payments_one_open_balance_idx` → `ErrPaymentInFlight` (`payment_repository.go:51`).
- **Commission is floored** so the business always nets ≥ amount − commission − provider fee (`commission.go`); the service allows a bounded per-charge override only within `0..amount` (`service.go:126`).
- **Offline takings are fee-free:** manual takings carry zero commission / `not_applicable` (`service.go:250`); `MoneySummary` net income = through-platform succeeded − platform commission + manual takings − offline commission due (`payment_repository.go:1139`).
- **Signature over raw bytes:** verification always runs on the exact bytes the provider signed (never a decoded value), with HMAC-SHA512 constant-time compare (`signature.go`).

**Payout provisioning (P0.5) & multi-store marketplace split (P0.4) — July 2026**
- **Subaccount = the merchant's MoMo.** A store is payment-ready only once it has a provisioned Paystack subaccount (`businesses.settlement_provider_subaccount`). `VerifyBusinessCommand` carries a `SettlementBank` (MoMo network) alongside the number; without the bank code Paystack rejects the subaccount (`"Bank code is required"`). The dashboard payout panel collects Network + MoMo number → `POST /businesses/me/verify {settlement_bank, settlement_account}`. `GET /businesses/me` exposes **`payout_ready`** (subaccount non-empty) so the dashboard prompts setup on the real signal, not identity verification.
- **Marketplace listing gate (P0.5):** `StorefrontRepository.ListPublicShops` lists only stores with a provisioned subaccount, so every marketplace-shoppable store can actually receive money. A store's own `<handle>.xtiitch.com` storefront is unaffected (resolved by handle, not the directory).
- **"Pay once" split (P0.4):** a unified basket across N shops settles in ONE Paystack transaction. `paymentsapp.InitiateMarketplaceCharge` builds `InitializeTransactionInput.Splits` → a flat `split` object (`type:flat`, `bearer_type:all-proportional`, `subaccounts:[{subaccount,share}]`); each shop's **net** (order total − its per-design-capped commission) settles to its own subaccount, the platform's summed commission to the main account. When `Splits` is empty the single-subaccount path is byte-for-byte unchanged (zero regression).
- **Cross-tenant settlement model:** migration `000080` adds **platform-level** (not tenant-scoped, like `payment_provider_events`) `marketplace_charges` (parent, keyed by provider reference) + `marketplace_charge_members` (one per shop: business, checkout group, anchor order, net, commission). `checkout.PlaceMarketplaceOrder` creates a per-shop group, computes each net/commission, then raises one combined charge; any failure discards every committed group (all-or-nothing). Endpoint: `POST /public/marketplace/orders` (pickup only).
- **Isolated webhook branch:** `reconcileMarketplaceChargeFromProvider` fires only when no single-store payment matches the reference; gated once by the charge's `initiated→succeeded` transition, it confirms **each shop's group under that shop's own tenant scope** and writes a per-shop `marketplace_split` money-tracker row (synthetic `<ref>::<businessID>` reference). Idempotent on re-delivery. The existing single-store settlement path is untouched.
- **Webhook secret:** Paystack signs webhooks with the **secret key**, so bootstrap defaults `PAYSTACK_WEBHOOK_SECRET` to `PAYSTACK_SECRET_KEY` when unset (`bootstrap/app.go`) — otherwise every signature check fails and nothing settles.
- **Validated live** against the Paystack test API (2026-07-11): subaccount creation, the split-object shape, a real browser payment + genuine Paystack webhook confirming both shops' groups, and idempotency. See `agent_plan.md`.

---

### delivery

The last operational leg once production is complete: arranging how a fulfilled order reaches the customer (pickup or delivery), moving that handover through its lifecycle, and configuring per-business delivery zones (named areas with a flat checkout fee). No money lives here — Xtiitch never holds funds.

**Domain types** (`apps/api/internal/domain/delivery/delivery.go`)
- `delivery.Method` (`pickup`/`delivery`) + `Valid()` — `:10`,`:18`.
- `delivery.Status` (`pending`/`dispatched`/`completed`/`cancelled`) + `Valid()` `:35`, `Terminal()` `:46`.
- `NextOnAdvance(method, from) (Status, bool)` — pickup: pending→completed; delivery: pending→dispatched→completed; `ok=false` when terminal/invalid — `:56`.
- `CanCancel(from) bool` — only pending/dispatched — `:76`.

**Service** (`deliveryapp.Service`, `apps/api/internal/application/delivery/service.go`)
- `NewService(Dependencies)` — handovers repo, zones repo, ids — `:30`.
- `ArrangeHandover(ctx, ArrangeHandoverCommand) (common.ID, error)` — method must be valid; a delivery must carry an address (`ErrInvalidHandoverState`); repo enforces order-fulfilled + one-open-handover; owner/admin/staff — `:52`.
- `ListHandovers(ctx, scope)` — the handover queue — `:82`.
- `AdvanceHandover(ctx, AdvanceHandoverCommand) error` — reads state, derives the forward step via `NextOnAdvance`, sets status guarded on the from-state; optional courier/note — `:99`.
- `CancelHandover(ctx, CancelHandoverCommand) error` — only when `CanCancel` — `:131`.
- `authorizeHandoverOperation` — owner/admin/**staff** may operate handovers — `:152`.
- Zones: `ListDeliveryZones` (all, dashboard) `:168`; `ListActiveDeliveryZones` (public storefront read, no role) `:174`; `CreateDeliveryZone` `:191`; `UpdateDeliveryZone` `:212`; `DeleteDeliveryZone` `:230`; `authorizeZoneManagement` — owner/admin **only** (staff arrange handovers but do not set fees) — `:242`.

**Ports** (`apps/api/internal/application/ports/delivery.go`)
- `DeliveryRepository` — `ArrangeHandover` (order must be fulfilled → `ErrInvalidOrderState`/`ErrNotFound`; one open handover via partial unique index → `ErrHandoverInProgress`), `ListHandovers`, `GetHandover`, `SetHandoverStatus` (optimistic guard on `From` status) — `:13`.
- `DeliveryZoneRepository` — `ListDeliveryZones`, `ListActiveDeliveryZones`, `CreateDeliveryZone` (dup name → `ErrZoneNameTaken`), `UpdateDeliveryZone`, `DeleteDeliveryZone` (FK `ON DELETE SET NULL` keeps snapshotted fees), `GetDeliveryZone` — `:65`.
- Error sentinels: `ErrHandoverInProgress` `errors.go:84`, `ErrInvalidHandoverState` `:89`, `ErrInvalidOrderState` `:23`, `ErrZoneNameTaken` `:63`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/delivery/handler.go`, `Register` `:43`; error maps `handoverError` `:302` / `zoneError` `:155`). All routes are in one protected group (`:44`) behind `authhttp.Authenticator`.

| Method | Path | Handler | file:line |
|---|---|---|---|
| POST | `/handovers` | `arrange` | handler.go:46 (fn `:180`) |
| GET | `/handovers` | `list` | handler.go:47 (fn `:219`) |
| POST | `/handovers/{id}/advance` | `advance` | handler.go:48 (fn `:256`) |
| POST | `/handovers/{id}/cancel` | `cancel` | handler.go:49 (fn `:284`) |
| GET | `/delivery-zones` | `listZones` | handler.go:50 (fn `:64`) |
| POST | `/delivery-zones` | `createZone` | handler.go:51 (fn `:88`) |
| PATCH | `/delivery-zones/{id}` | `updateZone` | handler.go:52 (fn `:114`) |
| DELETE | `/delivery-zones/{id}` | `deleteZone` | handler.go:53 (fn `:141`) |

**Notable logic / invariants**
- Handover lifecycle rules live in the pure domain (`NextOnAdvance`/`CanCancel`); the service applies them over an optimistically-guarded `SetHandoverStatus`, so a concurrent change leaves the row untouched and surfaces `ErrNotFound` (`ports/delivery.go:26`).
- Race-proofing is at the DB: one open handover per order (partial unique index → `ErrHandoverInProgress`), unique zone name per tenant (→ `ErrZoneNameTaken`).
- Role split: staff may arrange/advance/cancel handovers; only owner/admin configure zone pricing (`service.go:152` vs `:242`).
- `advance` accepts an empty body (optional dispatch courier/note) (`handler.go:264`).

---

### marketingwaitlist

Captures leads from the public marketing site (store every submission, best-effort email the team) and exposes an admin-only listing. Leads are platform-level, not tenant-scoped.

**Domain / value types**
- No dedicated domain package; the port carries the records. `ErrInvalidInput` — `apps/api/internal/application/marketingwaitlist/service.go:18`. Length caps (name/business/phone/email/city/message/source/user-agent) + `defaultLimit=500` — `:20`.

**Service** (`marketingwaitlist.Service`)
- `NewService(Dependencies)` — repo, optional emails (nil when Resend unconfigured), ids, `EmailTo`, logger — `:50`.
- `Submit(ctx, SubmitCommand) (ports.WaitlistLeadRecord, error)` — validate+normalise, store, then best-effort notify; a send failure never fails the request — `:76`.
- `notifyTeam(ctx, lead)` — emails the configured address; missing config is a silent no-op, a send error is logged not returned — `:96`.
- `ListLeads(ctx, limit)` — newest first, clamps out-of-range limit to 500; only called behind admin auth — `:131`.
- Helpers `normalizeSubmission` `:138`, `normalizeOptionalEmail` `:190`.

**Ports** (`apps/api/internal/application/ports/marketing.go`)
- `MarketingWaitlistRepository` — `CreateWaitlistLead`, `ListWaitlistLeads(limit)` — `:12`; input/record structs `:17`,`:29`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/marketing/handler.go`, `Register` `:38`)

| Method | Path | Handler | file:line |
|---|---|---|---|
| POST | `/marketing/waitlist` | `submit` *(public)* | handler.go:40 (fn `:70`) |
| GET | `/admin/waitlist` | `leads` *(admin-only)* | handler.go:45 (fn `:100`) |

The admin listing sits in a group (`:43`) behind the injected `AdminAuthenticator.Middleware` (the same admin token middleware as the rest of `/admin`); the submit endpoint is public.

**Notable logic / invariants**
- **Opaque success:** `submit` always returns **202** and never reveals whether the lead was new or a duplicate (`handler.go:96`); the stored record is discarded by the handler.
- The lead is never lost to a flaky email provider — the row is written first and email is best-effort/logged (`service.go:76`,`:96`).
- `UserAgent` is captured server-side (from `r.UserAgent()`), truncated to 1000 chars in the service (`service.go:172`).


## API — Catalogue, Orders & Fulfilment

> Scope: the merchandising-and-fulfilment half of the Xtiitch Go API — catalogue (designs, collections, size bands & charts, per-design pricing, store settings, waitlist, promotions CRUD), the order lifecycle (stages, handovers, walk-in/bespoke orders, tracking), public checkout (single / combined-cart / bespoke / home-visit booking, delivery snapshots, webhook group-confirm), availability & booking, measurements, media signing, the notification outbox, the WhatsApp ordering bot, growth (affiliate/sponsored/referral), and the two AI subsystems (marketplace search, writing assist). The API is Go hexagonal (domain → application services + ports → adapters inbound HTTP / outbound Postgres). All routes are mounted under `/v1` (`apps/api/internal/adapters/inbound/http/router.go:64`); each subsystem registrar's `Register(v1)` is invoked at `router.go:72-73`. Paths below are relative to repo root `/Users/shayford/Desktop/Dev/Projects/xtiitch`.

Cross-cutting Postgres conventions used throughout this half:
- **RLS scoping**: `setTenantScope` runs `select set_config('xtiitch.current_business_id', $1, true)` transaction-locally so row-level security confines every subsequent query to one business — `apps/api/internal/adapters/outbound/postgres/tenant.go:12`. `setTenantBypass` (`xtiitch.bypass = 'on'`) is used only for legitimately cross-tenant lookups (public store resolution, webhook lookups, marketplace reads) — `tenant.go:26`; `clearTenantBypass` narrows back once the tenant is known — `tenant.go:36`.
- **Not-found**: postgres `ErrNotFound` aliases `ports.ErrNotFound` — `apps/api/internal/adapters/outbound/postgres/business_identity_repository.go:19`; unique-violation SQLSTATE `23505` is `pgUniqueViolation` — `business_identity_repository.go:23`.
- **HTTP body hygiene**: every handler uses a shared `decodeJSON` — 1 MiB `io.LimitReader`, `DisallowUnknownFields`, single-JSON-object enforcement (e.g. `catalogue/handler.go:971`, `order/handler.go:314`, `checkout/handler.go:290`).

---

### Catalogue

The catalogue subsystem owns a business's merchandising surface: **collections**, **designs** (with a per-plan image cap), **size bands + measurement charts**, **per-design band pricing**, store **settings** (feature switches + plan-gated storefront customization), a public **design waitlist**, and **business promotion (discount code)** CRUD. It has two faces: a tenant-scoped dashboard face (owner/admin authenticated) and a public storefront face (account-free, RLS-bypassed handle resolution that then narrows to one business and returns only active items). Designs run in one of two mutually exclusive **pricing modes** — made-to-wear (priced by size bands) or customisation/bespoke (priced by a deposit override, band prices forbidden). Handles are slug + unguessable token so a shopper cannot enumerate a store's catalogue.

**Domain types** (`apps/api/internal/domain/catalogue/`)
- `Collection` — a themed grouping of designs (Name, Theme, Handle, Status, Sequence) — `catalogue.go:5`
- `Design` — a sellable design; `CustomisationAllowed` selects pricing mode, `DepositOverrideMinor` is the bespoke deposit, `Images` capped by plan — `catalogue.go:15`
- `SizeBand` — a named size (Label) with an ordered measurement `Chart` and display Sequence — `catalogue.go:29`
- `SizeChartItem` — one chart entry {Name, Value, Unit} — `catalogue.go:42`
- `SizeChartUnits` / `ValidSizeChartUnit` — allowed unit vocabulary (`cm, in, inches, mm, m, ft`) and validator — `catalogue.go:50`, `catalogue.go:53`
- `BandPrice` — a design's price for one band (SizeBandID, Label, PriceMinor, optional Chart) — `catalogue.go:62`
- `Status` — three-state lifecycle `active`/`retired`/`deleted`; `IsPublic` (only active is public), `CanRetire`/`CanRestore`/`CanDelete`, `ErrInvalidStatusTransition` — `status.go:9`, `status.go:30-36`
- `Slugify` / `NewHandleToken` / `BuildHandle` — build `slug-<10charToken>` public handles; token keeps them unguessable — `handle.go:12`, `handle.go:34`, `handle.go:49` (`handleTokenLength = 10`, `handle.go:8`)

**Service** (`catalogueapp.Service`, `apps/api/internal/application/catalogue/service.go:61`; `NewService` `:79`)
- `GetSettings` / `UpdateSettings` — read/update store feature switches; update runs a **server-side entitlement gate** (`coerceStoreCustomization`) that forces plan-ungranted customizations back to defaults before persist — `service.go:96`, `service.go:106`, `coerceStoreCustomization` `service.go:124`
- `GetStoreProfile` — the dashboard's own name/handle/verification/plan/entitlements read — `service.go:145`
- `JoinDesignWaitlist` — public: resolves store+design, enforces the `design_waitlist` plan benefit, verifies design belongs to the resolved store (tenant safety) — `service.go:162`
- `ListWaitlistEntries` / `UpdateWaitlistStatus` — dashboard waitlist log + status change (`waiting`/`notified`/`closed`) — `service.go:202`, `service.go:213`
- `CreateCollection` / `ListCollections` / `UpdateCollection` (handle immutable) / `RetireCollection` / `RestoreCollection` / `DeleteCollection` — `service.go:233`, `:253`, `:295`, `:263`, `:270`, `:277`
- `CreateDesign` / `UpdateDesign` / `ListDesigns` / `GetDesign` / `RetireDesign` / `RestoreDesign` / `DeleteDesign` — `service.go:340`, `:374`, `:395`, `:399`, `:409`, `:416`, `:423`
- `DesignCommand.validate` — title required; validates deposit via `money.ValidateDepositConfig` — `service.go:327`
- `DesignCommand.depositForMode` — **pricing-mode exclusivity at write time**: a made-to-wear design (`!CustomisationAllowed`) coerces its deposit to nil — `service.go:367`
- `CreateSizeBand` / `ListSizeBands` / `UpdateSizeBand` / `DeleteSizeBand` — chart normalized via `normalizeSizeChart` (trims, lower-cases unit, validates vocabulary) — `service.go:440`, `:463`, `:477`, `:505`; `normalizeSizeChart` `service.go:26`
- `SetDesignPrice` / `ListDesignPrices` — set/read a band price; mode conflict enforced atomically in the repo — `service.go:520`, `:533`
- `LoadStorefront` — public: resolve store, list active designs, list active collections only if `CollectionsEnabled` — `service.go:547`
- `GetStoreDesign` / `GetStoreCollection` / `ListPublicShops` / `SearchStore` — public reads — `service.go:569`, `:573`, `:578`, `:582`
- `authorizeCatalogueManagement` — owner/admin only, else `authdomain.ErrForbidden` — `service.go:591`
- Business-promotion CRUD (`apps/api/internal/application/catalogue/promotions.go`): `ListBusinessPromotions` `:37`, `CreateBusinessPromotion` `:47`, `UpdateBusinessPromotion` `:65`, `ArchiveBusinessPromotion` `:88`; `normalizeBusinessPromotionInput` validates code regex `^[A-Z0-9][A-Z0-9_-]{1,30}[A-Z0-9]$` (`promotions.go:14`), discount type (`percentage` needs value ≤10000 bps + a positive max-discount cap; `fixed` needs positive value), scope↔target coherence (store/collection/design), status (`active`/`paused`), and start<end — `promotions.go:101`

**Ports** (`apps/api/internal/application/ports/catalogue.go`)
- `StoreSettings` (feature switches + `BrandColor`/`LogoURL`/`BannerURL`/`LayoutVariant`) `:13`; `StoreSettingsRepository` (`Get`/`Update`/`GetProfile`) `:29`; `StoreProfile` (with resolved `Entitlements`) `:36`
- `CatalogueRepository` — dashboard-facing tenant-scoped store: collection CRUD+status, design CRUD+status, size-band CRUD, `SetDesignPrice`/`ListDesignPrices` — `:47`
- Inputs: `CollectionInput` `:68`, `CollectionUpdateInput` (no handle — immutable) `:80`, `DesignInput` `:88`, `SizeBandInput` `:101`, `SizeBandUpdateInput` `:111`
- `StorefrontRepository` — public store: `ResolveStore`, `ListActiveDesigns`, `GetActiveDesignByHandle`, `ListActiveCollections`, `GetActiveCollectionByHandle`, `SearchActiveDesigns`, `ListPublicShops` — `:123`
- `Storefront` (resolved public store: `DefaultDepositMinor`, `MeasurementFields`, `WaitlistEnabled`, `OnlineOrderingEnabled`, `PlanCode`) `:159`; `StorefrontDesign` `:224`; `StorefrontCollection` `:230`; `PublicShop`/`PublicShopDesign` (discovery directory) `:146`/`:137`
- `DesignWaitlistRepository` (`Join` public write / `List` / `UpdateStatus`) `:211`; `DesignWaitlistEntryInput` `:186`; `DesignWaitlistEntry` `:196`
- `PromotionRepository` (`ports/promotion.go:10`): `ListBusinessPromotions`, `CreateBusinessPromotion`, `UpdateBusinessPromotion`, `ArchiveBusinessPromotion`, `ReservePromotion`, `VoidPendingPromotionRedemptions`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/catalogue/handler.go`; public reads in `public.go`; `Register` `handler.go:32`)

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/public/shops | `publicShops` | route `handler.go:34`; fn `public.go:157` |
| GET | /v1/public/stores/{handle} | `publicStore` | route `handler.go:35`; fn `public.go:61` |
| GET | /v1/public/stores/{handle}/search | `publicSearch` | route `handler.go:36`; fn `public.go:80` |
| GET | /v1/public/designs/{handle} | `publicDesign` | route `handler.go:37`; fn `public.go:92` |
| GET | /v1/public/collections/{handle} | `publicCollection` | route `handler.go:38`; fn `public.go:104` |
| POST | /v1/public/stores/{handle}/designs/{design_handle}/waitlist | `joinWaitlist` | route `handler.go:39`; fn `handler.go:172` |
| GET | /v1/businesses/me | `getProfile` (auth) | route `handler.go:45`; fn `handler.go:96` |
| GET | /v1/store-settings | `getSettings` (auth) | route `handler.go:46`; fn `handler.go:119` |
| PATCH | /v1/store-settings | `updateSettings` (auth) | route `handler.go:47`; fn `handler.go:132` |
| GET | /v1/waitlist-entries | `listWaitlist` (auth) | route `handler.go:49`; fn `handler.go:203` |
| PATCH | /v1/waitlist-entries/{id} | `updateWaitlistStatus` (auth) | route `handler.go:50`; fn `handler.go:234` |
| POST | /v1/collections | `createCollection` (auth) | route `handler.go:52`; fn `handler.go:276` |
| GET | /v1/collections | `listCollections` (auth) | route `handler.go:53`; fn `handler.go:324` |
| PATCH | /v1/collections/{id} | `updateCollection` (auth) | route `handler.go:54`; fn `handler.go:300` |
| POST | /v1/collections/{id}/retire | `collectionAction(RetireCollection)` | route `handler.go:55`; fn `handler.go:341` |
| POST | /v1/collections/{id}/restore | `collectionAction(RestoreCollection)` | route `handler.go:56` |
| DELETE | /v1/collections/{id} | `collectionAction(DeleteCollection)` | route `handler.go:57` |
| POST | /v1/designs | `createDesign` (auth) | route `handler.go:59`; fn `handler.go:408` |
| GET | /v1/designs | `listDesigns` (auth) | route `handler.go:60`; fn `handler.go:443` |
| GET | /v1/designs/{id} | `getDesign` (auth) | route `handler.go:61`; fn `handler.go:460` |
| PATCH | /v1/designs/{id} | `updateDesign` (auth) | route `handler.go:62`; fn `handler.go:426` |
| POST | /v1/designs/{id}/retire | `designAction(RetireDesign)` | route `handler.go:63`; fn `handler.go:478` |
| POST | /v1/designs/{id}/restore | `designAction(RestoreDesign)` | route `handler.go:64` |
| DELETE | /v1/designs/{id} | `designAction(DeleteDesign)` | route `handler.go:65` |
| PUT | /v1/designs/{id}/prices/{bandId} | `setPrice` (auth) | route `handler.go:66`; fn `handler.go:615` |
| GET | /v1/designs/{id}/prices | `listPrices` (auth) | route `handler.go:67`; fn `handler.go:640` |
| POST | /v1/size-bands | `createSizeBand` (auth) | route `handler.go:69`; fn `handler.go:529` |
| GET | /v1/size-bands | `listSizeBands` (auth) | route `handler.go:70`; fn `handler.go:593` |
| PATCH | /v1/size-bands/{id} | `updateSizeBand` (auth) | route `handler.go:71`; fn `handler.go:553` |
| DELETE | /v1/size-bands/{id} | `deleteSizeBand` (auth) | route `handler.go:72`; fn `handler.go:577` |
| GET | /v1/promotions | `listPromotions` (auth) | route `handler.go:74`; fn `handler.go:655` |
| POST | /v1/promotions | `createPromotion` (auth) | route `handler.go:75`; fn `handler.go:672` |
| PATCH | /v1/promotions/{id} | `updatePromotion` (auth) | route `handler.go:76`; fn `handler.go:690` |
| POST | /v1/promotions/{id}/archive | `archivePromotion` (auth) | route `handler.go:77`; fn `handler.go:711` |

Error mapping `writeServiceError` (`handler.go:931`): `ErrForbidden`→403, `ErrInvalidInput`→400, `ErrPricingModeConflict`→409, `ErrPromotionCodeTaken`→409, `ErrPlanLimitExceeded`→409, `ErrSequenceTaken`→409, `ErrImageLimitExceeded`→409, `ErrNotFound`→404.

**Notable logic / invariants** (`apps/api/internal/adapters/outbound/postgres/catalogue_repository.go`, `storefront_repository.go`)
- **RLS + tenant tx**: every dashboard write runs in `inTenantTx` (begins tx, `setTenantScope`, rollback-unless-committed) — `catalogue_repository.go:586`. Public reads run in `StorefrontRepository.inBypassTx` (RLS bypass on) — `storefront_repository.go:25`; `ResolveStore` matches `lower(handle)` cross-tenant then everything it returns is that one business's active catalogue — `storefront_repository.go:41`.
- **Pricing-mode exclusivity (money-settlement invariant)**: `SetDesignPrice` `SELECT … FOR UPDATE` locks the design row; if `customisation_allowed` it returns `ports.ErrPricingModeConflict` — no band prices on a bespoke design — then upserts `on conflict (design_id, size_band_id)` — `catalogue_repository.go:406-434`. `UpdateDesign` mirror-enforces by deleting stale `design_prices` whenever a design is (re)set to customisation mode — `catalogue_repository.go:261-267`.
- **Image caps by plan**: `ensureImageCapacity` reads the plan code and caps images — free plan 2, any paid plan 5 — returning `ErrImageLimitExceeded`; run on both create and update — `catalogue_repository.go:495-517`, called at `:145`, `:239`.
- **Design plan-limit**: `ensureDesignCapacity` locks the business row (`for update of b`) and rejects new/reactivated active designs beyond `plan.design_limit` with `ErrPlanLimitExceeded` — `catalogue_repository.go:464-490`; also gated when restoring to active — `catalogue_repository.go:288-292`.
- **Display-order/sequence uniqueness guard**: `nextSequence` auto-numbers when the caller leaves `sequence<=0`, with a `whereExtra` predicate that must match the table's unique index — collections use `and status <> 'deleted'` (`collections_business_sequence_active_idx`), size bands unconditional (`size_bands_business_sequence_idx`) — `catalogue_repository.go:560-573`; unique-violation detectors `collectionSequenceTaken` `:576` / `sizeBandSequenceTaken` `:581` map to `ErrSequenceTaken`.
- **Size-chart storage**: chart persisted as jsonb object `{"items":[…]}`, empty stored as legacy `{}` default — `marshalSizeChart` `:532`, `unmarshalSizeChart` `:545`.
- **Size-band delete cascade**: `design_prices(size_band_id)` FK is `ON DELETE CASCADE`, so deleting a band clears its per-design prices — `catalogue_repository.go:391-395`.
- **Public directory**: `ListPublicShops` lists every `operational_status='active'` store (payment-verification NOT required to be discoverable) with a design sample — `storefront_repository.go:57-75`.
- **Entitlement coercion**: `coerceStoreCustomization` forces `BrandColor`→default, `LogoURL`/`BannerURL`→"", `LayoutVariant`→default unless the plan grants the matching `custom_*` feature — `service.go:124-143`.

---

### Order

The order subsystem owns the production lifecycle and the customer's "where is my cloth?" tracking. Orders carry a **status** (`draft→awaiting_deposit→confirmed→fulfilled`/`cancelled`), a **type** (`standard`/`custom`, derived from size mode + customisation), a **flow** (`ready_made`/`bespoke`), and a current **stage** drawn from the business's `stage_templates`; each stage is tied to a **colour** (red/yellow/green) as the customer-facing tracking signal. Orders are created three ways from this service — **walk-in standard**, **confirmed custom (come-to-shop) walk-in**, and (online ones by checkout/webhook) — and advance stage-by-stage until fulfilled, at which point the last-leg **handover** (delivery vs pickup) is auto-arranged for online orders. Bespoke orders settle money in two steps: a deposit, then a later `agreed_total` and balance charge (capped so no over-collection).

**Domain types** (`apps/api/internal/domain/order/order.go`)
- `Status` (`draft`/`awaiting_deposit`/`confirmed`/`fulfilled`/`cancelled`) — `order.go:9`
- `Type` (`standard`/`custom`); `Type.Flow()` maps standard→ready_made, custom→bespoke — `order.go:19`, `order.go:97`
- `SizeMode` (`band`/`self_measure`/`home_visit`/`come_to_shop`) with `Valid`, `IsCustomRoute`, `RouteTakesDeposit` (self-measure & home-visit only), `RouteCapturesMeasurement` (self-measure only) — `order.go:26`, `:36-68`
- `Flow` (`ready_made`/`bespoke`) — `order.go:70`
- `Colour` (`red`/`yellow`/`green`) — the tracking signal, primary data — `order.go:79`
- `Classify(mode, customised)` — standard iff `band` and not customised; custom otherwise — `order.go:89`
- `Order` — the aggregate (Type, SizeMode, Flow, Channel, Status, `AgreedTotalMinor`, `SettledMinor`, `CurrentStageID`) — `order.go:104`
- `Stage` — one production step (Name, Colour, Flow, Sequence, IsCurrent, IsComplete) — `order.go:121`
- `Tracking` — the public order view (Status, StageName, Colour, Stages, optional Handover) — `order.go:132`
- `HandoverTracking` — customer-safe last-leg status (Method, Status, recipient, Address, Courier, Note) — `order.go:145`

**Service** (`orderapp.Service`, `apps/api/internal/application/order/service.go:29`; `NewService` `:41`)
- `CreateWalkInOrder` — records an in-person standard order + returns its tracking reference; owner/admin/staff — `service.go:58`
- `CreateConfirmedCustomOrder` — in-person bespoke order confirmed at the first bespoke stage, no online payment; optional counter-captured measurements — `service.go:99`
- `ListOrders` — the dashboard/kanban order list — `service.go:127`
- `AdvanceStage` — move an order to its next stage (or mark fulfilled) and return updated tracking — `service.go:137`
- `GetTracking` — public "where is my cloth?" read keyed by order reference — `service.go:148`
- `SetAgreedTotal` — record the negotiated total for a confirmed custom order (owner/admin money role) — `service.go:163`
- `CollectBalance` — raise a balance charge (agreed total − settled) over the money rails; refuses if not a confirmed custom order, no email, no balance due, or a balance charge is already in flight (`ErrBalanceInProgress`) — `service.go:190`
- `authorizeOrderMoneyManagement` (owner/admin) `:246`; `authorizeOrderOperation` (owner/admin/staff) `:256`
- `Payments` interface (the `InitiateCharge` slice the order service needs) — `service.go:25`

**Ports** (`apps/api/internal/application/ports/order.go`)
- `OrderRepository` — `:11`: `CreateWalkInOrder` (confirms at first ready-made stage + logs stage event) `:15`; `CreateOnlineOrder` (draft; webhook confirms) `:18`; `CreateOnlineOrderGroup` (all-or-nothing combined cart) `:23`; `DiscardDraftOrderGroup` `:27`; `FindCustomerIDByPhone` (repeat-guest linking) `:30`; `DiscardDraftOrder` `:34`; `SetDraftOrderAgreedTotal` (after promo lowers charge) `:38`; `CreateCustomOrder` (draft bespoke, self-measure stores measurements; `ErrUnknownMeasurementField`) `:44`; `CreateCustomOrderConfirmed` (come-to-shop confirmed) `:48`; `DiscardCustomDraftOrder` `:52`; `ListOrders` `:53`; `AdvanceStage` `:56`; `GetTracking` (public, cross-tenant by credential) `:59`; `SetAgreedTotal` (`ErrInvalidOrderState`) `:64`; `GetOrderBilling` `:67`
- `OrderBilling` (type/status/agreed/settled/email/`BalanceInFlight`) `:71`; `OrderSummary` (kanban row incl payment status/purpose/amount) `:159`
- Input DTOs: `CreateWalkInOrderInput` `:82`; `CreateOnlineOrderInput` (with `CheckoutGroupID` + delivery snapshot) `:94`; `CreateCustomOrderInput` (`AgreedTotalMinor` set by cart; `MeasurementID`/`Measurements` for self-measure) `:116`; `CreateCustomOrderConfirmedInput` (`Channel` online/walk_in) `:139`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/order/handler.go`; `Register` `:43`; `Service` interface `:24`)

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/public/orders/{id} | `tracking` (public) | route `handler.go:44`; fn `handler.go:190` |
| POST | /v1/orders | `createWalkIn` (auth) | route `handler.go:48`; fn `handler.go:66` |
| POST | /v1/orders/custom | `createCustomWalkIn` (auth) | route `handler.go:49`; fn `handler.go:108` |
| GET | /v1/orders | `listOrders` (auth) | route `handler.go:50`; fn `handler.go:136` |
| POST | /v1/orders/{id}/advance | `advance` (auth) | route `handler.go:51`; fn `handler.go:172` |
| POST | /v1/orders/{id}/agreed-total | `setAgreedTotal` (auth) | route `handler.go:52`; fn `handler.go:203` |
| POST | /v1/orders/{id}/balance | `collectBalance` (auth) | route `handler.go:53`; fn `handler.go:230` |

Error mapping `writeServiceError` (`handler.go:293`): `ErrForbidden`→403, `ErrInvalidInput`/`ErrInvalidCharge`→400, `ErrInvalidOrderState`→409 `order_not_advanceable`, `ErrBalanceNotDue`→409, `ErrBalanceInProgress`→409, `ErrBusinessNotVerified`→409, `ErrNotFound`→404.

**Notable logic / invariants** (`apps/api/internal/adapters/outbound/postgres/order_repository.go`)
- **Walk-in confirm-at-first-stage**: `CreateWalkInOrder` upserts the customer, selects the first `stage_templates` row for `flow='ready_made'` (errors if none configured), inserts the order `status='confirmed'` at that stage, and logs a `stage_events` row — one tenant-scoped tx — `order_repository.go:51-104`. `CreateCustomOrderConfirmed` mirrors this for `flow='bespoke'` and stores counter measurements with source `'shop'` — `:433-510`.
- **Online orders are draft until paid**: `CreateOnlineOrder` inserts `status='draft'` with no stage and carries the delivery snapshot (`delivery_method/address/fee/zone`); the payment webhook confirms it — `:107-145`.
- **Stage advance / fulfilment**: `AdvanceStage` loads business/flow/status/current sequence, requires `status='confirmed'` and a valid current stage else `ErrInvalidOrderState`, then `advanceOrFulfil` — `:695-735`. `advanceOrFulfil` finds the next stage by `sequence > current`; if one exists it moves the order + logs a stage event; if none (already at last stage) it sets `status='fulfilled'`, enqueues an `order_fulfilled` notification, and calls the auto-arrange — `:737-773`.
- **Handover auto-arrange (fulfilment)**: `autoArrangeHandoverOnFulfilment` inserts a `handovers` row the moment an online order is fulfilled — method `'delivery'` when the order chose delivery (with its address) else `'pickup'`, status `'pending'`, recipient from the customer. It is a **no-op** for non-online (walk-in) orders and when an open handover already exists (`status in ('pending','dispatched')`), so it never collides with manual arrangement — `:775-804`.
- **Public tracking is credential-scoped**: `GetTracking` runs under `setTenantBypass` (keyed by the unguessable order id, cross-tenant); it derives `IsCurrent`/`IsComplete` per stage from the current sequence and appends the most-relevant handover — `order_repository.go:806+` (bypass at `:813`).
- **Combined-cart group insert (atomicity)**: `CreateOnlineOrderGroup` upserts the shared customer once and inserts every order with the same `checkout_group_id` in one tx; any error rolls the whole group back — `:152-200`.
- **Bespoke stages fail-closed**: `CreateCustomOrder` checks `exists(select 1 from stage_templates where flow='bespoke')` before creating the draft so a paid deposit never strands against a stage-less business — `:423-428`.
- **Handover status transitions** (dispatch/complete) live in the delivery repo and enqueue `handover_dispatched`/`handover_completed` notifications — `apps/api/internal/adapters/outbound/postgres/delivery_repository.go:174`.

---

### Checkout

Checkout is the public, account-free purchase surface. It resolves a store handle, gates on the store's plan (`online_ordering`), verifies the business can take payments (`Verified` + `SubaccountRef`), builds draft order(s), reserves promotion/affiliate/referral attribution, and raises a Paystack charge — the customer tracks the order by its returned reference; Xtiitch never holds funds (the charge settles to the business subaccount). Five flows: **single standard**, **combined cart** (mixed made-to-wear + bespoke, one charge), **bespoke custom** (self-measure/home-visit deposit or come-to-shop confirm), **home-visit booking** (holds a slot atomically), and a **delivery-zones** read. Every flow is **all-or-nothing / discard-on-failure**: a draft (and any freshly-created customer / held booking / pending promo reservation) is compensated away if the charge can't be raised. Combined confirmation happens in the webhook.

**Domain types / commands** (`apps/api/internal/application/checkout/service.go`)
- Sentinels: `ErrInvalidInput`, `ErrStoreNotFound`, `ErrDesignUnavailable`, `ErrBandUnavailable`, `ErrNotVerified`, `ErrOnlineOrderingOff`, `ErrInvalidSizeMode`, `ErrBespokeDisabled`, `ErrMeasurementsDisabled`, `ErrInvalidMeasurements`, `ErrPromotionUnavailable`, `ErrDeliveryUnavailable` — `service.go:19-32`
- `CartLineKind` (`made_to_wear`/`bespoke`) + `normalized()` — `service.go:296`, `:303`
- `deliveryChoice` — resolved delivery snapshot (method/address/fee/zone) — `service.go:41`
- Commands/results: `PlaceStandardOrderCommand`/`Result` `:141`/`:156`; `CartLineCommand` `:318`, `PlaceCartOrderCommand`/`Result` `:326`/`:339`; `PlaceHomeVisitBookingCommand`/`Result` `:626`/`:642`; `PlaceCustomOrderCommand`/`Result` `:788`/`:806`; `customerDetails` `:814`
- `maxCartLines = 50` — cart size bound — `service.go:36`

**Service** (`checkoutapp.Service`, `service.go:90`; `NewService` `:120`)
- `PlaceStandardOrder` — one made-to-wear order at a listed band price; resolves store→verify→priced design→draft order→reserve promo (lowers charge via `SetDraftOrderAgreedTotal`)→affiliate/referral→charge (`standard_full`); discards draft + voids promo on any failure — `service.go:168`
- `PlaceCartOrder` — validates lines (≤50, kind-specific), resolves store+verify, resolves one delivery snapshot (rides the first made-to-wear line only; requires a made-to-wear line), builds standard + custom draft inputs sharing one `groupID`, inserts the group + each custom order, then raises **one** `cart_full` charge for the total; discards the whole group on any failure — `service.go:354`
- `PlaceCustomOrder` — bespoke via one of three routes; come-to-shop → `placeComeToShop` (confirmed, no payment, no promo allowed); self-measure/home-visit → `placeDepositCustomOrder` (deposit charge `deposit`) — `service.go:825`; `placeComeToShop` `:891`; `placeDepositCustomOrder` `:909`
- `PlaceHomeVisitBooking` — resolve store→custom design (home-visit)→verify→`ResolveOpenSlot`→`holdAndCharge`: creates the draft custom order, `HoldSlot` (atomic), reserves attribution, raises the `booking_deposit`; a failed hold/charge discards the booking+order — `service.go:656`; `holdAndCharge` `:702`
- `StoreDeliveryZones` — active zones for the store's checkout; returns empty (not error) when store missing or delivery off — `service.go:557`
- Helpers: `resolveDelivery` (zone must exist, be active, delivery enabled, address present) `:52`; `resolveCustomerByPhone` (repeat-guest linking; reports freshly-created for cleanup) `:576`; `discardDraft`/`discardGroup`/`discardCustomDraft`/`discardBooking` (logged compensations) `:589`/`:546`/`:1209`/`:781`; `resolvePricedDesign` (+tenant check +`priceForBand`) `:598`/`:617`; `resolveCustomDesign` (bespoke/measurements gating +tenant check) `:871`; `cleanMeasurements` (all values non-blank) `:1220`
- Promotion/attribution: `reservePromotion` (reserve, reject discount ≤0 or ≥subtotal, compute commission) `:1054`; `voidPromotionReservation` `:1109`; `reserveAffiliateAttribution` `:1123`; `reserveReferralAttribution` `:1152`; `promotionCommissionMinor` (business/platform/split funding math) `:1183`; `normalizeCheckoutPromotionCode` `:1119`
- `Payments` / `Availability` slices — `service.go:80`, `:86`

**Ports** — consumes `StorefrontRepository`, `BusinessChargeRepository` (`GetChargeContext`), `OrderRepository`, `BookingRepository`, `PromotionRepository`, `AffiliateClickRepository`, `ReferralRepository`, `DeliveryZoneRepository`, `Availability`, `Payments`, `IDGenerator` — wired via `Dependencies` `service.go:105`. Money helpers: `money.ResolveDeposit` (`apps/api/internal/domain/money/deposit.go:26`), `money.Commission` (`commission.go:10`), `money.PaymentPurpose*` (`payment.go:17-24`), `money.PaymentMethodMomo` default (`payment.go:39`).

**HTTP routes** (`apps/api/internal/adapters/inbound/http/checkout/handler.go`; `Register` `:37`; `Service` interface `:21`) — all public

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| POST | /v1/public/stores/{handle}/orders | `placeOrder` | route `handler.go:38`; fn `handler.go:76` |
| POST | /v1/public/stores/{handle}/cart-orders | `placeCartOrder` | route `handler.go:39`; fn `handler.go:124` |
| GET | /v1/public/stores/{handle}/delivery-zones | `listDeliveryZones` | route `handler.go:40`; fn `handler.go:45` |
| POST | /v1/public/stores/{handle}/custom-orders | `placeCustomOrder` | route `handler.go:41`; fn `handler.go:176` |
| POST | /v1/public/stores/{handle}/bookings | `placeBooking` | route `handler.go:42`; fn `handler.go:221` |

Error mapping `checkoutError` (`handler.go:266`): input/band/size-mode/measurement errors→400 `invalid_order`; store/design not found→404; `ErrNotVerified`→409 `store_not_verified`; bespoke/measurements disabled→409 `store_cannot_take_order`; `ErrOnlineOrderingOff`→409; `ErrDeliveryUnavailable`→409; `ErrPromotionUnavailable`→409; `ErrSlotTaken`/`ErrNoAvailability`→409 `slot_unavailable`.

**Notable logic / invariants**
- **Store gate + settlement readiness**: every paid flow resolves the store, requires `OnlineOrderingEnabled`, then `GetChargeContext` requires `Verified && SubaccountRef != ""` else `ErrNotVerified` — e.g. `service.go:185-196`, `:395-406`, `:919-925`, `:676-692`.
- **Tenant safety on handles**: unguessable design handles are never trusted to span tenants — `resolvePricedDesign`/`resolveCustomDesign` reject designs whose `BusinessID != store.BusinessID` — `service.go:607`, `:885`.
- **Discard-on-failure (all-or-nothing)**: a committed draft with no raised charge could never be confirmed, so on charge (or promo/measurement) error the flow voids the pending promo reservation and discards the draft — plus a freshly-created customer only (`cleanupCustomerID`, existing customers are shared) — `service.go:276-283` (standard), `:530-535` (cart group), `:1003-1009` (deposit), `:767-770` (booking).
- **Combined-cart charge (money-settlement)**: cart total = Σ line prices + deposits + one delivery fee; the delivery fee + zone ride the first made-to-wear line only (`len(standardInputs)==0`), while method+address ride every standard line so each ready-made piece segments correctly at fulfilment — `service.go:451-465`, `:496`. One `cart_full` charge anchored on `orderIDs[0]` — `:522-529`.
- **Webhook group-confirm** (`apps/api/internal/adapters/outbound/postgres/payment_repository.go`): `applyPaymentSuccess` routes by purpose — `booking_deposit`→`confirmBookingOnPayment`, `balance`→`creditOrderBalance`, `cart_full`→`confirmOrderGroupOnPayment`, else `confirmOrderOnPayment` — `:643-655`. `confirmOrderGroupOnPayment` reads the anchor's `checkout_group_id` and confirms **every still-draft** member, each settled by its **own** `agreed_total_minor` (exact per-line, not the combined amount); falls back to confirming the anchor alone if no group — `:664-714`. `confirmOrderOnPayment` moves draft→confirmed at the first stage of its flow, credits settled, logs a stage event, applies pending promo/affiliate/referral, and enqueues `order_confirmed` (dedup makes a redelivered webhook a no-op) — `:809-863`.
- **Deposit-fail releases the slot**: `applyPaymentFailure` for a `booking_deposit` runs `releaseBooking` (held→cancelled, draft order→cancelled, freeing the slot) and voids pending attributions — `:716-735`, `releaseBooking` `:760-778`. `confirmBookingOnPayment` flips held→booked (guarded, idempotent) and confirms the order + enqueues `booking_confirmed` — `:737-758`.
- **Balance over-collection guard**: `creditOrderBalance` caps `settled_minor` at `least(settled + amount, agreed_total_minor)` on confirmed/fulfilled orders, so even a duplicated balance charge can never settle more than owed — `:780-799`.
- **Promotion commission funding**: `promotionCommissionMinor` computes the platform commission for a discounted order — `business`-funded keeps full commission (rejects if > payable), `platform`-funded subtracts the discount from commission (rejects if discount > commission), `split` recomputes commission on the payable — `service.go:1183-1207`.
- **Come-to-shop excludes promos**: a come-to-shop custom order takes no online payment, so passing a promo code is rejected with `ErrPromotionUnavailable` — `service.go:859-864`.

---

### Availability

Businesses define recurring home-visit windows in business-local minutes-of-day; the subsystem derives the concrete, bookable UTC slots a customer can pick. Owners/admins replace the whole window set (`DefineAvailability`); the public storefront lists open slots for a store handle; booking checkout resolves a single requested slot against current availability. Open slots = windows enumerated (`booking.EnumerateSlots`) minus slots already held/booked (`ListTakenSlots`), with a lead-time cutoff. All persistence is tenant-scoped under RLS.

**Domain types** (`apps/api/internal/domain/booking/booking.go`)
- `Window` — recurring window (Weekday, StartMinute, EndMinute, SlotMinutes, Recurrence, DayOfMonth) — `booking.go:52`; `Window.matchesDay` `booking.go:63`
- `Slot` — one bookable UTC range (Start, End) — `booking.go:75`
- `EnumerateSlots` — pure derivation of bookable slots in `[from, to)` — `booking.go:86`
- Recurrence constants `RecurrenceDaily`/`RecurrenceWeekly`/`RecurrenceMonthly`/`RecurrenceOngoing` — `booking.go:39-44`
- Tuning: `DefaultSlotMinutes=60`, `DefaultLeadMinutes=120`, `HoldTTLMinutes=30` — `booking.go:29-33`
- `WindowInput` `apps/api/internal/application/availability/service.go:47`; `DefineAvailabilityCommand` `:56`; `ports.AvailabilityWindow` (adds WindowID) `apps/api/internal/application/ports/booking.go:24`

**Service** (`availabilityapp.Service`, `service.go:25`; `NewService` `:39`, defaults `now` to `time.Now`)
- `DefineAvailability` — authorizes (owner/admin), defaults empty recurrence to weekly, validates each window, rejects overlaps, assigns IDs, calls `ReplaceWindows` — `service.go:65`
- `ListWindows` — configured windows for the dashboard — `service.go:159`
- `ListStoreAvailability` — resolves public store by handle, returns open slots in `[from,to)`; `ErrNotFound`→`ErrStoreNotFound` — `service.go:166`
- `ResolveOpenSlot` — validates a specific `slotStart` is currently open (searches a 24h window); `ErrNoAvailability` if no windows, `ErrSlotTaken` if not open — `service.go:179`
- `openSlots` — loads windows+timezone, resolves location (UTC fallback), enumerates, subtracts taken slots via a unix-second map — `service.go:199`
- `authorizeAvailabilityManagement` (owner/admin) `:119`; `windowsOverlap`/`windowDayKey` (per-day-bucket overlap detection) `:126`/`:147`; errors `ErrInvalidInput`/`ErrStoreNotFound` `:20-23`

**Ports** (`AvailabilityRepository`, `apps/api/internal/application/ports/booking.go:13`)
- `ReplaceWindows(ctx, scope, []AvailabilityWindow)` — full replace in one tx — `:16`
- `ListWindows(ctx, scope) ([]booking.Window, string, error)` — windows + timezone — `:18`
- `ListTakenSlots(ctx, scope, from, to) ([]time.Time, error)` — held/booked slot starts — `:21`
- also consumes `StorefrontRepository.ResolveStore` and `IDGenerator` via `Dependencies` (`service.go:32-37`)

**HTTP routes** (`apps/api/internal/adapters/inbound/http/availability/handler.go`; `Register` `:40`)

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/public/stores/{handle}/availability | `publicAvailability` (public) | route `handler.go:41`; fn `:50` |
| POST | /v1/availability/windows | `defineWindows` (auth) | route `handler.go:45`; fn `:90` |
| GET | /v1/availability | `listWindows` (auth) | route `handler.go:46`; fn `:124` |

Error mapping (`handler.go:159`): `ErrForbidden`→403, `ErrInvalidInput`→400, `ErrStoreNotFound`→404, else 500. Public range clamping: `from` defaults to now-UTC, `to` to `from+14d`, max `from+28d`, non-positive range→400 `invalid_range` — `handler.go:19-23, 51-59`.

**Notable logic / invariants**
- **Recurrence semantics** (`Window.matchesDay`, `booking.go:63-72`): `daily`/`ongoing` match every day; `monthly` matches when `day.Day() == DayOfMonth`; default (weekly, and empty for back-compat) matches `Weekday`. `ongoing` ≡ `daily` (just "no planned end") — `booking.go:41-43`.
- **`EnumerateSlots` math** (`booking.go:86-109`): `earliest = now + leadMinutes`; anchor to midnight of `from` in `loc`; iterate day-by-day while `day.Before(to)`; per matching window with `SlotMinutes>0`, step `minute` from `StartMinute` while `minute+SlotMinutes <= EndMinute`; `start = day+minute`, skip if `start < from`, `>= to`, or `< earliest`; emit `{Start, End}` in UTC (`End = start+SlotMinutes`). Nil `loc`→`time.UTC`.
- **Validation** (`service.go:80-99`): `StartMinute>=0`, `EndMinute>StartMinute<=1440`, `SlotMinutes∈[15,480]`; weekly requires `Weekday∈[0,6]`; monthly requires `DayOfMonth∈[1,31]`; daily/ongoing ignore both; unknown recurrence rejected. **No overlap** within a day-bucket, so each slot start belongs to exactly one window (no duplicate/ambiguous slots) — `service.go:100-102, 126-156`.
- **Timezone**: repo defaults to `Africa/Accra` and reads `store_settings.business_timezone` — `apps/api/internal/adapters/outbound/postgres/availability_repository.go:62-66`; service falls back to UTC on load error — `service.go:204-207`.
- **RLS**: every repo method opens a tx + `setTenantScope` — `availability_repository.go:21-31,51-60,100-109`. `ReplaceWindows` is delete-then-insert in one tx; `DayOfMonth<=0` stored NULL — `availability_repository.go:32-46`.
- **Taken-slot rule**: a slot counts as taken if `status='booked'`, or `status='held' AND created_at > now() - HoldTTLMinutes`; expired holds fall back out of availability — `availability_repository.go:111-119`.

---

### Booking

The booking subsystem manages a home-visit slot's lifecycle after checkout: hold, discard-on-failure, list the visit queue, cancel, reschedule. No-double-book is enforced by a partial unique index over active (held/booked) rows; stale unpaid holds past TTL are reclaimed transactionally. The application service covers list/cancel/reschedule; `HoldSlot`/`DiscardHeldBooking` are driven by the checkout flow.

**Domain types** (`apps/api/internal/domain/booking/booking.go`)
- `Status` + `StatusHeld`/`StatusBooked`/`StatusCompleted`/`StatusCancelled`/`StatusRescheduled`; `Status.Valid` — `booking.go:7`, `:9-15`, `:17`
- `HoldTTLMinutes=30` — `booking.go:32`
- `Availability` interface (reschedule dependency: `ResolveOpenSlot`) — `apps/api/internal/application/booking/service.go:18`
- `CancelBookingCommand` `:43`; `RescheduleBookingCommand` `:60`
- `ports.HoldSlotInput` `apps/api/internal/application/ports/booking.go:57`; `ports.RescheduleBookingInput` `:67`; `ports.BookingSummary` `:75`

**Service** (`bookingapp.Service`, `service.go:22`; `NewService` `:34`)
- `ListBookings` — the business's visit queue — `service.go:39`
- `CancelBooking` — authorizes, validates id, cancels + frees the slot — `service.go:50`
- `RescheduleBooking` — authorizes, re-validates the target via `Availability.ResolveOpenSlot`, applies the atomic move (new id) — `service.go:70`
- `authorizeBookingOperation` — non-zero scope + Owner/Admin/Staff — `service.go:90`

**Ports** (`BookingRepository`, `apps/api/internal/application/ports/booking.go:35`)
- `HoldSlot` (`ErrSlotTaken` on conflict) `:39`; `DiscardHeldBooking` (compensate failed deposit) `:42`; `ListBookings` `:45`; `CancelBooking` (`ErrNotFound`) `:48`; `RescheduleBooking` (`ErrSlotTaken`/`ErrNotFound`) `:54`
- Errors: `ErrNotFound` (`ports/errors.go:8`), `ErrSlotTaken` (`errors.go:74`), `ErrNoAvailability` (`errors.go:78`)

**HTTP routes** (`apps/api/internal/adapters/inbound/http/booking/handler.go`; `Register` `:36`) — all auth

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/bookings | `listBookings` | route `handler.go:39`; fn `:45` |
| POST | /v1/bookings/{id}/cancel | `cancel` | route `handler.go:40`; fn `:73` |
| POST | /v1/bookings/{id}/reschedule | `reschedule` | route `handler.go:41`; fn `:95` |

Error mapping (`handler.go:124`): `ErrInvalidInput`→400, `ErrForbidden`→403, `ErrNotFound`→404, `ErrSlotTaken`/`ErrNoAvailability`→409 `slot_unavailable`, else 500. Reschedule parses `slot_start` as RFC3339 (`handler.go:106`).

**Notable logic / invariants** (`apps/api/internal/adapters/outbound/postgres/booking_repository.go`)
- **No-double-book**: the held row *is* the reservation, enforced by partial unique index `bookings_active_slot_idx` on `(business_id, slot_start)` over held/booked rows. `HoldSlot` catches SQLSTATE `23505` with that constraint → `ErrSlotTaken` — `:57-71`; same guard on reschedule's new-slot insert — `:223-227`.
- **Stale-hold reclaim (atomic)**: `HoldSlot` first cancels the draft order of any held booking on that slot past TTL (`created_at < now() - make_interval(mins => 30)`), then cancels that held booking, then inserts the new hold — one tx — `:35-73`.
- **`DiscardHeldBooking` compensation order**: delete held booking → delete draft order → delete customer only if a non-empty id was passed (shared customers untouched) — `:87-108`.
- **Reschedule invariants**: only a `booked` (deposit-paid) visit is reschedulable (else `ErrNotFound`); carries forward `customer_id`/`order_id`/`address`/`deposit_payment_id`; frees the old slot first (`booked`→`rescheduled`) so a same-slot move doesn't self-collide, then inserts the new `booked` row — `:200-228`.
- **Cancel** flips held/booked→cancelled (dropping it from the active-slot index, freeing the slot); zero rows→`ErrNotFound` — `:170-180`.
- **RLS** via `setTenantScope` on every method (`:31, 83, 120, 166, 192`). No explicit idempotency key on cancel/reschedule — safety is the status-guarded UPDATEs + the unique index (replays are no-ops or `ErrNotFound`/`ErrSlotTaken`).
- Handlers wired in `apps/api/internal/bootstrap/app.go:306-307`.

---

### Measurement

Manages a business's custom-order measurement **template** (business-defined fields; no platform-wide sizing) and captures the **values** taken during a custom order. Owners/admins CRUD the fields; staff record a confirmed custom order's measurements when the customer is measured on a home visit or in the shop. Values are stored as a jsonb map keyed by the business's own field ids. Tenant-scoped under RLS.

**Domain types** — no dedicated domain package; shapes live in ports, constants in the service.
- `SourceVisit`/`SourceShop` (`"visit"`/`"shop"`) — the two staff capture sources — `apps/api/internal/application/measurement/service.go:22-25`
- `ErrInvalidInput`, `ErrInvalidMeasurementSource` — `service.go:17-20`

**Service** (`measurementapp.Service`, `service.go:27`; `NewService` `:37`)
- `ListFields` — template read — `service.go:41`
- `CreateField` — owner/admin; trims label, validates unit (`cm`/`in`), rejects negative sequence, mints id — `service.go:53`
- `UpdateField` — owner/admin; partial (label/unit/sequence pointers) — `service.go:81`
- `DeleteField` — owner/admin — `service.go:121`
- `RecordOrderMeasurements` — validates staff source, normalizes non-empty values, mints measurement id — `service.go:138`
- helpers `normalizeUnit` `:160`, `validUnit` `:164`, `validStaffSource` `:168`, `authorizeTemplateManagement` (owner/admin else `ErrForbidden`) `:172`, `normalizeValues` (rejects empty map/blank key or value) `:179`

**Ports** (`apps/api/internal/application/ports/measurement.go`)
- `MeasurementRepository` (`ListFields`/`CreateField`/`UpdateField`/`DeleteField`/`RecordOrderMeasurements`) `:10-16`
- `BusinessMeasurementField` `:18`; `CreateMeasurementFieldInput` `:27`; `UpdateMeasurementFieldInput` (pointer fields) `:35`; `RecordOrderMeasurementsInput` `:41`; `OrderMeasurement` (resolved `CustomerID`) `:49`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/measurement/handler.go`; `Register` `:37`) — all auth

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/measurement-fields | `listFields` | route `handler.go:40`; fn `:48` |
| POST | /v1/measurement-fields | `createField` | route `handler.go:41`; fn `:72` |
| PATCH | /v1/measurement-fields/{id} | `updateField` | route `handler.go:42`; fn `:103` |
| DELETE | /v1/measurement-fields/{id} | `deleteField` | route `handler.go:43`; fn `:129` |
| POST | /v1/orders/{id}/measurements | `recordOrderMeasurements` | route `handler.go:44`; fn `:151` |

Error mapping `writeMeasurementError` (`handler.go:198`): `ErrInvalidInput`/`ErrInvalidMeasurementSource`/`ErrUnknownMeasurementField`→400, `ErrForbidden`→403, `ErrMeasurementSequenceTaken`/`ErrInvalidOrderState`→409, `ErrNotFound`→404.

**Notable logic / invariants** (`apps/api/internal/adapters/outbound/postgres/measurement_repository.go`)
- **RLS**: every method opens a tx + `setTenantScope`; queries also carry explicit `business_id = $` predicates.
- **Upsert** of captured values: `insert … on conflict (order_id) do update …` guarded by `where order_measurements.business_id = excluded.business_id` — `:176-186` (unique index `order_measurements_order_idx`).
- **Route invariant**: `assertMeasurementRoute` (`:223`) requires the order to be `order.TypeCustom` + `order.StatusConfirmed` and the source to match `size_mode` (`visit`↔`home_visit`, `shop`↔`come_to_shop`) else `ErrInvalidOrderState`; returns `customer_id` (denormalized onto the measurement).
- **Known-field enforcement**: `assertKnownMeasurementFields` (`:248`) rejects any value key not in the business's field set (`ErrUnknownMeasurementField`).
- **Field sequence uniqueness**: `measurementSequenceTaken` (`:261`) maps a unique-violation on `measurement_fields_business_seq_idx` to `ErrMeasurementSequenceTaken`.
- Schema (`infra/migrations/000008_custom_orders.up.sql`): field unit CHECK `('cm','in')` `:11`, unique `(business_id, sequence)` `:17`; `order_measurements.source` CHECK `('self','visit','shop')` `:24` — DB permits `self` but the staff path only accepts `visit`/`shop`. Composite same-business FK `(order_id, business_id)` `:37-39`; hardened RLS on both tables `:43-57`.

---

### Media

Issues short-lived signatures for **direct browser-to-Cloudinary** uploads of design images — image bytes never transit the API; the client uploads straight to the provider then stores only the URL. Uploads are namespaced per tenant. A dev stub returns a non-functional signature when Cloudinary isn't configured.

**Domain types** — none (transfer shape is a ports struct).

**Service** (`mediaapp.Service`, `apps/api/internal/application/media/service.go`)
- `NewService` — wraps a `ports.MediaStore` — `:21`
- `SignDesignUpload` — owner/admin; folder `xtiitch/designs/<businessID>`, delegates to `store.SignUpload` — `:27`
- `defaultFolderPrefix = "xtiitch/designs"` `:15`; `SignDesignUploadCommand` `:35`; `authorizeDesignUpload` (zero scope→`ErrInvalidInput`, non-owner/admin→`ErrForbidden`) `:40`

**Ports** (`apps/api/internal/application/ports/ports.go`)
- `MediaStore.SignUpload(ctx, scope, folder) (SignedUpload, error)` — `:610-612`
- `SignedUpload` (`Signature`, `Timestamp`, `CloudName`, `APIKey`, `Folder`) — `:614-620`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/media/handler.go`; `Register` `:29`) — auth

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| POST | /v1/media/design-upload-signature | `signDesignUpload` | route `handler.go:32`; fn `:44` |

Response `signatureResponse` = `signature`/`timestamp`/`cloud_name`/`api_key`/`folder` (`handler.go:36-42, 60`). Error mapping `writeServiceError` (`:69`): `ErrInvalidInput`→400, `ErrForbidden`→403, else 500.

**Notable logic / invariants** (`apps/api/internal/adapters/outbound/cloudinary/cloudinary.go`)
- `NewClientFromURL` parses `cloudinary://<api_key>:<api_secret>@<cloud_name>`; rejects wrong scheme / missing user / missing host with `ErrInvalidCloudinaryURL` — `:33-52`.
- `SignUpload` (`:54`) signs **exactly two params**: `timestamp` (`c.now().Unix()`) and `folder` (if non-empty). No explicit expiry field — freshness is the timestamp itself (Cloudinary rejects stale/replayed timestamps server-side). The API secret is never returned to the client.
- `signParams` (`:72`) implements Cloudinary's scheme: params sorted by key, joined `key=value` with `&`, secret appended, then **SHA-1** hex (provider requirement, not a security choice — documented `:1-4`, `//nolint:gosec`).
- Dev stub (`apps/api/internal/adapters/outbound/cloudinary/dev.go`): `DevMediaStore.SignUpload` (`:18`) returns fixed `signature:"dev-unsigned"`, `cloud_name:"demo"`, `api_key:"demo"`; used when `CLOUDINARY_URL` is unset, must never run in production.
- Wiring: `mediahttp.NewHandler(...)` at `apps/api/internal/bootstrap/app.go:302`.

---

### Notification

A **transactional-outbox** system for business→customer lifecycle messages ("order confirmed", "order ready", etc.). Producers insert an intent row into `outbound_messages` **in the same DB transaction** as the state change that causes it, so a message is durable iff its state change committed, and never recorded for a change that rolled back. A separate, out-of-band transport drains the outbox and sends over WhatsApp/SMS. The application layer exposes only the **read side** — a business's notification log — there is no "send" use case in Go.

**Domain types** (`apps/api/internal/domain/notification/notification.go`)
- `Channel` + `ChannelWhatsApp`/`ChannelSMS`; `Channel.Valid` — `:11-16`, `:19`
- `Kind` + six kinds `KindOrderConfirmed`/`KindOrderFulfilled`/`KindBookingConfirmed`/`KindBalancePaid`/`KindHandoverDispatched`/`KindHandoverCompleted`; `Kind.Valid` — `:25-34`, `:37`
- `DedupKey(kind, reference)` → `"<kind>:<reference>"` — the idempotency key — `:51`

**Service** (`notifyapp.Service`, `apps/api/internal/application/notification/service.go`)
- `NewService` `:22`; `ListMessages` — the log, most-recent-first (read-only) — `:27`

**Ports** (`apps/api/internal/application/ports/notification.go`)
- `NotificationRepository.ListMessages(ctx, scope)` (read side only) — `:13-15`
- `MessageSummary` (`MessageID`/`Channel`/`Kind`/`Recipient`/`Status`/`Attempts`/`CreatedAt`) — `:18-26`
- Separate email transport port (not the outbox drainer): `EmailSender.Send` `ports.go:622-624`, `EmailMessage` `:626+`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/notification/handler.go`; `Register` `:28`) — auth

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/notifications | `list` | route `handler.go:31`; fn `:35` |

**Notable logic / invariants**
- **Transports/states**: `outbound_messages` (`infra/migrations/000012_notifications.up.sql:9`) — `channel` CHECK `('whatsapp','sms')` `:12`; `status` CHECK `('pending','sending','sent','dead')` default `pending` `:16-17`; `attempts` default 0; `available_at`/`sent_at`. Migration `000022` adds `provider_message_id`+`provider_response` for delivery tracking.
- **Idempotency**: unique index `outbound_messages_dedup_idx (business_id, dedup_key)`; every producer inserts `ON CONFLICT (business_id, dedup_key) DO NOTHING`, so a redelivered webhook or retried transaction is a no-op — a kind fires at most once per reference.
- **Transactional producers** (unexported, `apps/api/internal/adapters/outbound/postgres/outbox_repository.go`; all `channel='whatsapp'`, recipient = customer/handover phone via `coalesce`):
  - `enqueueOrderNotification` `:67` — `order_confirmed` at `payment_repository.go:863`; `order_fulfilled` at `order_repository.go:766`
  - `enqueueBookingNotification` `:81` — `booking_confirmed` at `payment_repository.go:757`
  - `enqueueBalancePaymentNotification` `:103` — `balance_paid` (dedup keyed on `paymentID`) at `payment_repository.go:798`
  - `enqueueHandoverNotification` `:123` — `handover_dispatched`/`handover_completed` at `delivery_repository.go:174`
- **Drain path** is out of band — a partial index `outbound_messages_due_idx ON (available_at) WHERE status IN ('pending','sending')` supports oldest-first claiming, but there is **no Go drainer** in this package. `email/ResendSender` (`apps/api/internal/adapters/outbound/email/resend.go:25`, `Send` `:45`) is a distinct `EmailSender` used by other flows and is not wired to the outbox — the outbox is WhatsApp-only in every enqueue path.
- **RLS**: `outbound_messages` uses the hardened bypass-OR-business_id policy; `ListMessages` (`outbox_repository.go:21`) sets tenant scope so a business sees only its own log.

---

### WhatsAppBot

The inbound WhatsApp Cloud API ordering bot — a chat-based, no-app/no-login shopping assistant. A customer messages the business's WhatsApp number; Meta forwards each message to a webhook, which normalizes it and drives a per-sender **conversation state machine**. The bot resolves a shop by handle, browses that shop's active designs, tracks an order by code, and — when the shop's plan grants `online_ordering` — places a standard order in chat and returns a Paystack link. Conversation state is persisted per sender (keyed by WhatsApp id) with a 30-minute TTL; Meta retries are deduped by message id. The engine is decoupled from the catalogue domain via a narrow `BotCatalogue` port adapting the storefront/order/checkout repositories.

**Domain types** (`apps/api/internal/application/whatsappbot/service.go`)
- `InboundMessage` — one normalized message (WaID, MessageID for dedupe, Type, Text, ContactName) — `:74`
- `conversationState` — per-sender JSON state (Step, resolved shop, `OnlineOrdering`, browse listing, in-progress order, `Turns`) — `:83`
- `listedDesign` `:99`; `orderSize` `:104`; `outcome` (reply text, next state, businessID, `clear`) `:112`
- `Service`/`Dependencies` `:40`/`:49`
- Step constants `stepAwaitingShop`/`stepMenu`/`stepBrowsing`/`stepAwaitingOrder`/`stepOrderSize`/`stepOrderName` `:31-38`; tuning `sessionTTL=30m` `:22`, `optOutKeyword="STOP"` `:24`, `maxBrowseDesigns=10` `:27`
- Port value types: `BotShop` `ports/whatsappbot.go:63`, `BotDesign` `:70`, `BotSizeBand` `:77`, `BotOrderRequest` `:83`, `BotOrderDraft` `:92`, `BotOrder` `:98`

**Service** (`apps/api/internal/application/whatsappbot/service.go`)
- `NewService` — defaults `StorefrontBase` to `https://xtiitch.com` — `:58`
- `HandleInbound` — per-message entry: ignores empty WaID, dedupes by MessageID, handles STOP opt-out, loads/seeds session, increments `Turns`, runs `advance`, persists, sends the reply — `:122`
- `persist` — deletes session on `outcome.clear`, else marshals + upserts with `ExpiresAt = now + 30m` — `:161`
- `advance` — the state-machine router (new/step-less → greet + `stepAwaitingShop`; else switch on `Step`; default resets to greeting) — `:179`
- Step handlers: `handleShopInput` `:202`, `handleMenu` `:226`, `listDesigns` `:247`, `handleBrowsing` `:278`, `designDetail` `:293`, `startOrder` (gated on `OnlineOrdering`) `:325`, `handleOrderSize` `:358`, `handleOrderName` (calls `PlaceStandardOrder`, returns Paystack URL) `:380`, `handleOrderCode`/`trackOrder` `:439`/`:443`
- helpers: `clearOrder` `:412`, `synthEmail` (`wa{digits}@whatsapp.xtiitch.com`) `:425`, `shopMenu` `:462`, `greeting` `:466`, `decodeState` `:479`, `sizeLabels` `:489`, `normalizeHandle` `:500`, `formatGHS` `:506`, `stageEmoji` `:513`, `humanizeStatus` `:526`, `now` `:530`

**Ports** (`apps/api/internal/application/ports/whatsappbot.go`)
- `WhatsAppSessionRepository` (`GetSession`/`SaveSession`/`DeleteSession`) `:16-22`
- `WhatsAppDedupeStore.MarkProcessed(ctx, messageID) (alreadySeen, err)` — atomic check-and-record `:36-39`
- `WhatsAppSender.SendText(ctx, toWaID, body)` `:44-45`
- `BotCatalogue` (`ResolveShop`/`ListDesigns`/`TrackOrder`/`PlaceStandardOrder`) `:52-60`; `ErrOrderingUnavailable` `:11`
- Adapter `botcatalogueadapter.Adapter` delegates to storefront/order repos + a `CheckoutPlacer` (checkout.Service) — `apps/api/internal/adapters/outbound/botcatalogue/catalogue.go:35` (`ResolveShop`), `:48` (`ListDesigns`), `:70` (`PlaceStandardOrder`, `momo`, maps `ErrOnlineOrderingOff`→`ErrOrderingUnavailable`), `:93` (`TrackOrder`); `CheckoutPlacer` `:21`, `New` `:31`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/whatsapp/handler.go`; `Register` `:39-42`)

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| GET | /v1/webhooks/whatsapp | `verify` (Meta subscription challenge) | route `handler.go:40`; fn `:46` |
| POST | /v1/webhooks/whatsapp | `receive` (message feed) | route `handler.go:41`; fn `:64` |

**Notable logic / invariants**
- **State machine**: 6 steps (`stepAwaitingShop → stepMenu → stepBrowsing / stepAwaitingOrder / stepOrderSize → stepOrderName`), dispatched by `advance` (`service.go:183-198`); unknown/empty step and `default` reset to greeting + `stepAwaitingShop`, so a corrupt/expired session restarts cleanly.
- **Webhook GET verify**: echoes `hub.challenge` only when `verifyToken` configured AND `hub.mode=="subscribe"` AND `hub.verify_token==verifyToken`; else 403 — `handler.go:46-59`.
- **Webhook POST signature**: raw body via `io.LimitReader(1 MiB)`; `signatureValid` HMAC-SHA256 of the raw body with the app secret vs `X-Hub-Signature-256`, constant-time `hmac.Equal`; invalid→401; dev fallback accepts when `appSecret==""` — `handler.go:71-74, 94-109`.
- **Ack semantics**: `receive` always returns 200 after dispatch, even on unmarshalable JSON or a `HandleInbound` error (logged only), so Meta won't hammer retries; dedupe makes retries safe — `handler.go:77-88`.
- **Idempotency (dedup by message id)**: `HandleInbound` calls `dedupe.MarkProcessed(MessageID)` and returns nil when already seen (`service.go:126-134`), backed by `whatsapp_inbound_messages` `insert … on conflict (message_id) do nothing` returning `RowsAffected()==0` for already-seen — atomic — `apps/api/internal/adapters/outbound/postgres/whatsapp_repository.go:108-130`.
- **Opt-out**: message equal (ci) to "STOP" deletes the session + sends confirmation — `service.go:136-141`.
- **Session TTL**: reads filter `expires_at > now()` (`whatsapp_repository.go:41`); saves set `expires_at = now+30m` (`service.go:173`); upsert by `wa_id` (`whatsapp_repository.go:76-84`).
- **Ordering invariant**: in-chat ordering refused unless `state.OnlineOrdering` (from the resolved shop's `OnlineOrderingEnabled`); the adapter reuses the storefront checkout with `momo` so bot orders match storefront orders and Xtiitch never holds funds — `service.go:326-328`, `catalogue.go:65-91`.
- **RLS**: sessions + dedupe ledger are platform-global (webhook not tenant-scoped), so every repo method runs `setTenantBypass` before its query — `whatsapp_repository.go:30,64,96,114,141`.
- **Sender transport**: `CloudSender.SendText` POSTs `graph.facebook.com/{graphVersion}/{phoneNumberID}/messages` (default `v21.0`, bearer token, 10s timeout) — `apps/api/internal/adapters/outbound/whatsapp/sender.go:25-64`; `LoggingSender` for dev `:70-81`. Selection in `bootstrap/app.go:402-425`; handler wired with verify token + app secret `:299`.

---

### Growth

The marketplace acquisition subsystem: it records affiliate-link **clicks**, serves and meters **sponsored ad placements** (homepage hero / promoted design), resolves **referral codes**, and (via ports consumed by checkout) reserves affiliate/referral commission attribution. Business promotion (discount code) CRUD lives in the catalogue app, but the promotion validity/redemption/reservation logic is in the promotion repository (below). The `growthapp.Service` is thin — validate/normalize input and delegate. One `AffiliateRepository` implements all three growth port interfaces.

**Domain types** — no `domain/growth` package; shapes are port record structs + service sentinels/validators.
- `growthapp.Service`/`Dependencies` — `apps/api/internal/application/growth/service.go:24`, `:31`
- Sentinels `ErrInvalidInput`/`ErrAffiliateNotFound`/`ErrSponsoredAdNotFound`/`ErrReferralNotFound` + `affiliateCodePattern`/`uuidPattern` — `service.go:15`
- Commands `RecordAffiliateClickCommand` `:47`, `ListSponsoredPlacementsCommand` `:90`, `RecordSponsoredAdEventCommand` `:113`, `ResolveReferralCodeCommand` `:166`
- Port records: `AffiliateClickRecord` `ports/growth.go:35`, `SponsoredPlacementRecord` `:66`, `SponsoredAdEventRecord` (`Deduped`) `:93`, `ReferralCodeRecord` `:105`, `AffiliateAttributionReservation` (`CommissionMinor`) `:52`, `ReferralAttributionReservation` `:138`; promotion records `BusinessPromotionRecord` `ports/promotion.go:19`, `BusinessPromotionInput` `:44`, `ReservePromotionInput` `:64`, `PromotionRedemption` `:76`

**Service** (`apps/api/internal/application/growth/service.go`)
- `RecordAffiliateClick` — uppercases/validates code, caps text (120/512), SHA-256 IP hash (salt `xtiitch-affiliate-click:`), requires visitor id or IP hash, `ErrNotFound`→`ErrAffiliateNotFound` — `:56`
- `ListSponsoredPlacements` — clamps limit (default 6, max 12) — `:94`
- `RecordSponsoredAdEvent` — validates campaign UUID, normalizes event to `impression`/`click`, IP hash (salt `xtiitch-sponsored-event:`), synthesizes `visitor_id="ip:"+hash[:32]` when none — `:123`
- `ResolveReferralCode` — uppercases/validates, `ErrNotFound`→`ErrReferralNotFound` — `:170`
- helpers `limitText` `:193`, `hashIPAddress` `:201`, `normalizeEventType` `:218`

**Ports** (`apps/api/internal/application/ports/growth.go`)
- `AffiliateClickRepository` (`RecordAffiliateClick`, `ReserveAffiliateAttribution`) `:10`; `SponsoredPlacementRepository` (`ListActiveSponsoredPlacements`, `RecordSponsoredAdEvent`) `:15`; `ReferralRepository` (`ResolveReferralCode`, `ReserveReferralAttribution`) `:20`
- `PromotionRepository` (`ports/promotion.go:10`) — see Catalogue. Impls: `AffiliateRepository` (all three growth ifaces) `apps/api/internal/adapters/outbound/postgres/affiliate_repository.go:20`; `PromotionRepository` `promotion_repository.go:18`. Wired `bootstrap/app.go:229-233`, handler `:305`.

**HTTP routes** (`apps/api/internal/adapters/inbound/http/growth/handler.go`) — all public

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| POST | /v1/public/affiliates/{code}/clicks | `recordAffiliateClick` (201) | route `handler.go:36`; fn `:91` |
| GET | /v1/public/sponsored | `sponsoredPlacements` | route `handler.go:37`; fn `:120` |
| POST | /v1/public/sponsored/{id}/events | `recordSponsoredEvent` (201) | route `handler.go:38`; fn `:151` |
| GET | /v1/public/referrals/{code} | `referralCode` | route `handler.go:39`; fn `:182` |

Error mapping `growthError` (`handler.go:226`): 400 `invalid_click` / 404 `*_not_found` / 500; `parseLimit` caps at 100 (`:241`); `requestIP` reads `X-Forwarded-For` first (`:282`).

**Notable logic / invariants**
- **Sponsored selection/ranking** (`affiliate_repository.go:117-173`): only `status='active'` campaigns whose window `starts_at <= now() AND ends_at > now()`, from `verified` + operationally `active` businesses; `promoted_design` campaigns require the target design still active. Ordered by placement priority (`homepage_hero`=0, `promoted_design`=1, else 2), then `updated_at desc`, then `campaign_id`; limited by the clamped limit. Image falls back from the target design's first image to the advertiser's featured active design via a lateral join.
- **Sponsored event dedup/idempotency** (`affiliate_repository.go:225-292`): a CTE re-validates the campaign is currently active, then treats an event as duplicate (`deduped=true`) if same `event_type`+`visitor_id` within the last 6 hours; else inserts (`deduped=false`) guarded by `where not exists`.
- **Promotion validity windows + selection** (`promotion_repository.go:findPromotionForCheckout:529`): matches by ci code, `status='active'`, business-owned or platform (`business_id is null`), `min_spend_minor <= subtotal`, window `(starts_at is null or <= now()) AND (ends_at is null or > now())`; scope gate `store` OR `design`↔`target_design_id` OR `collection`↔order design's collection; picks most specific with `order by (business_id is not null) desc, scope-priority desc, created_at desc limit 1 FOR UPDATE OF p` (row-locks the promotion).
- **Usage limits** (`promotionUsageAvailable:586`): global limit counts `('pending','applied')`; per-customer matches `customer_id` OR normalized email OR digit-stripped phone. Discount math (`promotionDiscount:632`): `percentage`=`subtotal*value/10000` capped at `max_discount_minor`; `fixed` capped at subtotal. Reservation rejects discount `<=0` or `>= subtotal` and inserts a `promotion_redemptions` row `status='pending'` (`:351-369`).
- **Promotion CRUD integrity**: Create/Update use a `target_ok` CTE verifying a collection/design target belongs to the tenant + is active; `funding_source` forced to `'business'`; unique violation→`ErrPromotionCodeTaken`. `VoidPendingPromotionRedemptions:388` flips pending→void per order. CRUD driven by `catalogue/promotions.go` (auth + normalize), `ReservePromotion` from checkout.
- **RLS**: promotion repo uses `setTenantScope`; affiliate/sponsored reads use `setTenantBypass` (cross-tenant marketplace data).
- **Attribution idempotency**: `ReserveAffiliateAttribution`/`ReserveReferralAttribution` upsert `on conflict (order_id) do update set updated_at=now()` (`affiliate_repository.go:406`, `:577`), keyed by order; affiliate honors a `cookie_window_days` click window (`:363`).

---

### AI Search

A cross-tenant marketplace **semantic search** with a freemium paywall. Each query is parsed into structured intent (colours/categories/occasions + hard price bounds), the cleaned style text is embedded into a vector, candidate designs are pulled and **ranked in Go** by cosine similarity blended with small per-facet lexical boosts, with price bounds as hard filters. Embeddings are produced offline by a `Backfill` job. Metering is enforced before search: anonymous (salted-IP fingerprint) 5/month, signed-in free customers 25/month, `ai_search_pro` unlimited; over-quota → HTTP 402.

**Domain types** — no `domain/` package; types in the app + ports.
- `Requester` (CustomerID xor Fingerprint) `apps/api/internal/application/aisearch/service.go:43`; `Quota` (Limit 0 = unlimited) `:49`; `SearchResult` `:120`; `SearchResponse` `:132`
- Tier constants `tierAnonymous/tierFree/tierPro` `:34`; allowances `anonFreeSearchesPerMonth=5`/`customerFreeSearchesPerMonth=25` `:28`; `defaultSearchLimit=12` `:24`; `facetBoost=0.04` `:147`; errors `ErrEmptyQuery`/`ErrQuotaExhausted` `:16`
- Port DTOs `ParsedQuery` `ports/aisearch.go:27`, `DesignEmbeddingSource` `:63`, `UpsertEmbeddingInput` `:70`, `EmbeddingCandidate` `:81`

**Service** (`apps/api/internal/application/aisearch/service.go`)
- `Backfill(ctx, batch)` — fetch designs needing (re)embedding for the current model, embed in one batch, upsert; verifies vector count == source count — `:84`
- `Search(ctx, query, limit, requester)` — trim/validate, clamp limit (≤0 or >50 → 12), enforce quota first, parse+embed, load candidates, filter by price bounds, score `cosine + facetScore`, drop `score<=0`, sort desc, truncate, return intent + quota — `:158`
- `enforceQuota` — nil usage repo ⇒ unlimited pro; resolve tier; unlimited tiers skip metering; atomic increment; `ErrQuotaExhausted` when `count > limit` — `:228`
- `resolveTier` `:259`; `monthStart` (UTC month, injected `Clock`) `:269`; `parseAndEmbed` (falls back to raw query on parser error) `:279`; ranking helpers `withinPriceBounds` `:302`, `facetScore` `:317`, `cosine` `:327`

**Ports** (`apps/api/internal/application/ports/aisearch.go`)
- `Embedder` (`Embed`/`Model`) `:12`; `QueryParser` (`Parse`) `:21`; `EmbeddingRepository` (`DesignsNeedingEmbedding`/`UpsertEmbedding`/`SearchCandidates`) `:38`; `SearchUsageRepository` (`IncrementUsage`/`CustomerIsPro`) `:53`

**HTTP routes** (`apps/api/internal/adapters/inbound/http/aisearch/handler.go`)

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| POST | /v1/public/ai-search | `search` | route `handler.go:42`; fn `:60` |

Public but optionally reads a `Bearer` customer token: `resolveRequester` prefers a verified customer token else a salted SHA-256 IP fingerprint (`handler.go:114`, `fingerprint:123`, salt = JWT key per `bootstrap/app.go:296`). `ErrEmptyQuery`→400; `ErrQuotaExhausted`→402 `search_quota_exhausted` with quota body (`handler.go:73-79`); else 500.

**Notable logic / invariants**
- **Embedders**: `DevEmbedder` = deterministic 512-dim hashed bag-of-words (FNV-1a + sign, L2-normalized), model `dev-hashing-bow-512`, key-free — `apps/api/internal/adapters/outbound/ai/embeddings.go:21`. `OpenAIEmbedder` POSTs `api.openai.com/v1/embeddings` (default `text-embedding-3-small`, 20s, count-mismatch error) — `embeddings.go:80`. Selection `bootstrap/app.go:328`.
- **Query parsing**: `HeuristicQueryParser` scans fixed Ghana/fashion vocab + two price regexes, strips price phrases, cedis→minor ×100 — `apps/api/internal/adapters/outbound/ai/query_parser.go:40`. `ClaudeQueryParser` POSTs `api.anthropic.com/v1/messages` (default `claude-haiku-4-5-20251001`, 8s, JSON-only), degrades to heuristic on any error so search never hard-fails on the LLM hop — `query_parser.go:101`.
- **Ranking is in-application, not pgvector** — cosine + facet boosts computed in Go (`service.go:192`, `cosine:327`); `SearchCandidates` returns raw vectors, no `<=>`/`<->` operator or vector index in SQL.
- **Candidate eligibility (marketplace gate)** (`apps/api/internal/adapters/outbound/postgres/embedding_repository.go:99-130`): active designs joined to businesses that are `verified`, operationally `active`, plan has `online_ordering`; price = `min(design_prices.price_minor)`, image = `images[1]`, `Searchable` = lowercased `title+description+collection`.
- **Embedding freshness** (`embedding_repository.go:DesignsNeedingEmbedding:21`): re-embed when `content_hash` null / `<> md5(content)` / `model <> $2`; `UpsertEmbedding:75` upserts `on conflict (design_id)`.
- **Metering** (`search_usage_repository.go:34-43`): `IncrementUsage` atomic upsert `on conflict (subject_kind, subject_id, period_month) do update set search_count = search_count + 1 returning search_count`; `CustomerIsPro` reads `coalesce(ai_search_pro,false)` (`:61`).
- **RLS**: all AI-search Postgres access runs under `setTenantBypass` — both ingest/search (cross-tenant marketplace) and usage tables are platform-global — `embedding_repository.go:27,81,105`; `search_usage_repository.go:29,56`.

---

### AI Assist

The business-authed writing assistant, sold as a paid add-on (`ai_assistant`) billed separately from the plan. `Assist` checks the tenant's add-on entitlement (RLS-scoped) before ever calling the model; if inactive it returns `business.ErrAddonInactive` (→402). The service also owns optimistic Paystack add-on billing (checkout init → verify+first charge → monthly renewal sweep) and an admin add-on flip.

**Domain types** — no `domain/aiassist` package; types in the app + ports.
- `Service`/`Dependencies` `apps/api/internal/application/aiassist/service.go:60`/`:70`; `PaymentAuthorizer` iface `:38`; `AddonStatusView` `:138`; `CheckoutLink` `:165`; `CheckoutResult` `:200`; `RenewalSweepResult` `:274`
- errors `ErrEmptyText`/`ErrInvalidAddon`/`ErrBillingUnavailable`/`ErrCheckoutNotConfirmed` `:15-26`; `maxAssistTextLen=4000` `:30`; `defaultAddonCurrency="GHS"` `:33`
- `AssistInput` + `AiAssistant` iface `ports/aiassist.go:8`, `:17`

**Service** (`apps/api/internal/application/aiassist/service.go`)
- `Assist` — trims/caps text (empty or >4000 → `ErrEmptyText`), gates on `HasActiveAddon(scope, AddonAIAssistant)` else `business.ErrAddonInactive`, then calls the model — `:99`
- `SetAddon` — admin flip; rejects unknown add-on — `:124`
- `AddonStatus` `:148`; `InitializeCheckout` `:173`; `VerifyCheckout` (charges first month, activates, `NextChargeAt=now+1mo`) `:209`; `RunRenewalSweep` (charges due; success extends a month, hard failure → past_due/revoke) `:285`
- helpers `addonChargeRef` (`addon-aiast-<id>`) `:331`; `chargeActivates` (success|pending) `:337`

**Ports** — `AiAssistant.Assist(ctx, AssistInput) (string, error)` (`ports/aiassist.go:17`; impl must degrade to unchanged text). Billing via `PaymentAuthorizer` (`service.go:38`, Paystack) + `ports.BusinessAddonRepository`. Assistant impl `ClaudeAssistant` `apps/api/internal/adapters/outbound/ai/assistant.go:18`.

**HTTP routes** (business `apps/api/internal/adapters/inbound/http/aiassist/handler.go` — auth; admin `admin_handler.go`)

| Method | Path | Handler | file:line |
|--------|------|---------|-----------|
| POST | /v1/ai/assist | `assist` | route `handler.go:49`; fn `:63` |
| GET | /v1/addons/ai_assistant | `addonStatus` | route `handler.go:51`; fn `:113` |
| POST | /v1/addons/ai_assistant/checkout | `addonCheckout` | route `handler.go:52`; fn `:144` |
| POST | /v1/addons/ai_assistant/verify | `addonVerify` | route `handler.go:53`; fn `:176` |
| POST | /v1/admin/businesses/{business_id}/addons | `setAddon` | route `admin_handler.go:40`; fn `:52` |
| POST | /v1/admin/addons/recurring-charges | `runRenewalSweep` | route `admin_handler.go:43`; fn `:90` |

**Notable logic / invariants**
- **Entitlement gate before spend**: `Assist` verifies the add-on tenant-scoped (RLS) before the model call; inactive→402 `addon_inactive` (`handler.go:93-99`); empty/`>4000` text→400 before the service (`handler.go:76-84`).
- **Optimistic billing**: `success` OR `pending` activates/keeps the add-on (`chargeActivates:337`); only explicit failure withholds/revokes. Xtiitch never holds funds — Paystack charges the customer directly.
- **Idempotent charge reference**: every charge uses `addon-aiast-<newID>` (`:331`); `VerifyCheckout` validates the incoming reference (non-empty, ≤160 runes, no whitespace) `:214`.
- **Renewal cadence**: `NextChargeAt = now.AddDate(0,1,0)` on verify (`:254`) and sweep (`:309`).
- **Admin authorization**: both admin routes require `PermissionReviewBusinesses` via `roleCan` (`admin_handler.go:58,96,116`); sweep invoked with `limit 0` (`:101`).
- **Model fail-safe**: `ClaudeAssistant.Assist` returns the input text unchanged when no API key or on any error/non-200 (`assistant.go:37-88`), POSTing `api.anthropic.com/v1/messages` (default `claude-haiku-4-5-20251001`, 12s); instruction map improve/rewrite/shorten/expand/friendly/fix `:91`.


## Frontends, Mobile & Shared Packages

> scope. The four React Router v7 web apps (`apps/dashboard`, `apps/storefront`, `apps/marketing`, `apps/admin`), the Expo/React Native app (`apps/mobile`), and the four shared workspace packages (`packages/*`). All paths below are relative to `/Users/shayford/Desktop/Dev/Projects/xtiitch`. Line citations point at the definition so any symbol is locatable.

### Shared conventions across all four web apps

All four web apps are **React Router v7 in framework SSR mode** with **MUI v9 + Emotion** and TypeScript under `noUncheckedIndexedAccess`. They share the same skeleton:

- **`app/routes.ts`** — flat route table via `@react-router/dev/routes` (`index`, `route`).
- **`app/root.tsx`** — `Layout` (HTML shell, `emotion-insertion-point` meta, `ThemeModeProvider`), default `App` (route-change fade + a `RouteProgressBar`), and a branded `ErrorBoundary` (404 / 502-503 / generic). The dashboard and admin shells set `<meta name="robots" content="noindex, nofollow">`; the storefront/marketing are indexable.
- **`app/theme.ts`** — `createAppTheme(mode)` builds a MUI theme (`cssVariables: true`, pill buttons `borderRadius: 999`, `--surface-rgb` var) from `@xtiitch/design-tokens` (`getXtiitchThemeColors`, `xtiitchColors`, `xtiitchFonts`). `apps/dashboard/app/theme.ts:21`.
- **`app/theme-mode.tsx`** — light/dark provider persisting to `localStorage` and syncing the `theme-color` meta; storefront/marketing add a View-Transitions circular reveal toggle.
- **`app/emotion/cache.ts`** — Emotion cache key `"xt"` anchored to the insertion-point meta; `entry.server.tsx` extracts critical CSS with `extractCriticalToChunks` and (marketing) sets a CSP.
- **API base pattern** — every server call targets the Go API at `process.env.XTIITCH_API_URL ?? "http://localhost:8080"` and hits the **`/v1`** namespace. Nothing in `app/lib/api*.ts` runs in the browser.
- **Auth/session** — httpOnly, signed cookie via `createCookieSessionStorage`; **tokens never reach browser JS**. Cookie names differ per app (`xt_dashboard`, `xt_customer` + `xt_cart`, `xt_admin`; marketing has no server session).
- **Mutations via `intent` dispatch** — a single route `action` reads `form.get("intent")` and branches. Forms carry a hidden `<input name="intent">`. Loaders fetch, actions mutate.

---

### apps/dashboard

**What it is + tech.** The business/merchant console at `business.xtiitch.com` — by far the largest surface. `app/routes/dashboard.tsx` is **16,905 lines** and contains virtually the entire authenticated experience (loader, action with 50+ intents, and ~120 components). React Router v7 SSR + MUI v9 + Emotion. Entry redirects to `/dashboard`, which bounces to `/login` when there is no session.

#### Key routes — `app/routes.ts`

| Route path | file | loader / action purpose |
|---|---|---|
| `/` (index) | `routes/home.tsx` | Redirects into `/dashboard`. |
| `/login` | `routes/login.tsx` | Password / MFA / WhatsApp-OTP sign-in (action intents `login`, `mfa`, `otp-request`, `otp-verify`). |
| `/register` | `routes/register.tsx` | 3-step signup wizard + WhatsApp owner-number verify. |
| `/forgot-password` | `routes/forgot-password.tsx` | Password reset request/confirm. |
| `/handle-check` | `routes/handle-check.ts` | **Resource route** — same-origin proxy for live store-handle availability. |
| `/business-otp` | `routes/business-otp.ts` | **Resource route** — same-origin proxy for WhatsApp "Send code" (opaque 202). |
| `/onboarding/billing` | `routes/billing-onboarding.tsx` | Ghana Card capture + Paystack recurring-authorization start. |
| `/onboarding/billing/callback` | `routes/billing-callback.tsx` | Post-Paystack return handler. |
| `/addons/ai-assistant` `/…/callback` | `routes/addons.ai-assistant*.tsx` | AI assistant add-on purchase + callback. |
| `/security` | `routes/security.tsx` | MFA enrolment / security settings. |
| `/dashboard/:section?` | `routes/dashboard.tsx` | **The console.** `:section` selects the panel. |
| `/ai/assist` | `routes/ai-assist.ts` | **Resource route** — proxies the ✨ AI writing assistant to the API with the session token. |
| `/help` | `routes/help.tsx` | Help center. |
| `*` | `routes/not-found.tsx` | 404. |

#### lib/ — API base, session, media

- **`lib/api-base.ts`** — `getApiBase()` strips trailing slashes off `XTIITCH_API_URL` (`:3`); `fetchApi(path, init)` calls `${base}/v1${path}` and, in dev only, retries the default localhost base on a network fault (`:24`). `DEFAULT_API_BASE = "http://localhost:8080"` (`:1`).
- **`lib/auth.ts`** — `apiFetch(request, path, init)` reads the session `access` token, sets `Authorization: Bearer`, and calls `fetchApi`; throws `redirect("/login")` when there is no token (`:9`), returns a synthetic 503 on API-unavailable (`:22`), and redirects+destroys the cookie on a 401 (`:28`). `logOut(request)` (`:34`).
- **`lib/session.ts`** — `createCookieSessionStorage` cookie **`xt_dashboard`** (httpOnly, lax, 30-day) holding `{ access, refresh, mfaChallenge }` (`:13`).
- **`lib/media.ts`** — `uploadImage(request, file)` reusable Cloudinary upload: asks the API for a signed payload (`POST /media/design-upload-signature`), uploads directly to Cloudinary, returns `secure_url`; returns `null` when Cloudinary is unconfigured (demo creds) (`:23`). Mirrors the private `uploadDesignImage` in `dashboard.tsx:2885`.
- **`lib/api.ts`** — typed public-catalogue helpers (mostly used for shared types).
- **`root.tsx`** — a `loader` fetches the owner-managed platform logo from `${API}/v1/branding` for the sign-in screen, failing safe to the built-in mark (`root.tsx:46`).

#### dashboard.tsx — loader, action, section model

- **`loader`** (`:950`) — reads `?orders=` filter, loads `/businesses/me` + `/auth/business/me` in parallel, decides `canManage` from role, then fans out: `/orders`, `/measurement-fields`, `/bookings`, `/handovers`, `/notifications` for everyone; and (managers only) `/designs` (+ per-design `/prices`), `/money/summary`, `/money/takings`, `/availability`, `/auth/business/users`, `/store-settings`, `/collections`, `/size-bands`, `/promotions`, `/waitlist-entries`, `/delivery-zones`. Per-resource failures degrade to defaults with `dataWarnings` rather than erroring (`loadDashboardJSON` `:927`, `readDashboardJSON` `:907`). Staff have money details stripped (`stripStaffMoneyDetails` `:2395`).
- **`action`** (`:1189`) — reads `form.get("intent")`; `logout` short-circuits (`:1193`); permission-gated intents check `canUseDashboardIntent` against the role (`:1197`, allowed sets `dashboardActionIntents` `:813`, `staffAllowedIntents` `:809`). ~50 intent branches follow. Full intent map (each with its `if (intent === …)` line): `advance` (1206), `record_measurements` (1223), `create_walk_in_order` (1251), `create_custom_walk_in_order` (1283), `set_agreed_total` (1320), `collect_balance` (1342), `log_taking` (1374), `cancel_booking` (1404), `reschedule_booking` (1423), `arrange_handover` (1449), `advance_handover` (1477), `cancel_handover` (1503), `save_availability` (1522), `create/update/delete_measurement_field` (1544/1569/1599), `save_store_settings` (1615), `create/update/delete_delivery_zone` (1661/1715), `submit_identity_verification` (1731), `update_waitlist_status` (1775), `create/update/reset_business_user` + `transfer_owner` (1793/1810/1834/1856), `create/retire/restore/update/delete_collection` (1877/1903/1939/1920), `create/update/delete_size_band` (1969/2006), `create/update/archive_promotion` (2022/2050), `upload_design_image` (2068), `update_design` (2122), `set_design_price` (2176), `create` (design, 2198), `delete_design` (2294), `retire/restore` (design, 2310). Image intents call the private `uploadDesignImage(request, file)` (`:2885`).
- **Section model** — `DashboardSection` union of 14 (`:343`): `overview, tasks, reports, orders, money, visits, handovers, catalogue, promotions, measurements, availability, settings, team, messages`. `parseDashboardSection` (`:2335`) validates against role; `dashboardPageMeta` supplies per-section eyebrow/title/icon (`:2481`). Nav data: `managementWorkspaceNav` (`:585`), `staffWorkspaceNav` (`:679`), grouped into `managementWorkspaceGroups` (Overview / Operations / Storefront / Setup / Command, `:737`) and `staffWorkspaceGroups` (`:786`).
- **Default component `Dashboard`** (`:15157`) — composes the shell: `WorkspaceRail` (`:15706`) + `WorkspaceTopBar` (`:15729`) then a `section === "…"` switch renders each panel (`:15782`–`16884`). Reports data computed via `buildRevenueBuckets` (`:3084`) and `buildStageMetrics` (`:3140`); revenue/stage charts are hand-built CSS bars (no chart library).

#### Major components / panels (dashboard.tsx)

Chrome & primitives
- `WorkspaceRail` — collapsible left nav rail (grouped sections, badges) — `:4607`.
- `WorkspaceTopBar` — top bar: store link `{handle}.xtiitch.com`, notifications `Badge`, help button, profile menu, theme toggle, logout — `:5284`.
- `WorkspaceHeader` / `HeaderSignal` / `PriorityRibbon` — section header + at-a-glance signals + urgent-action ribbon — `:5860` / `:5993` / `:6052`.
- `Panel` (`:4199`), `SectionHeader` (`:4314`), `EmptyState`/`InlineEmptyState` (`:6613`/`:9091`), `PaginationFooter` (`:4262`), `usePagedItems` hook (`:4238`), `MetricCard` (stat card, gradient + accent bar + optional href) (`:4353`), `MiniStat` (`:8960`), `ToneChip` (`:4508`), `PlanGatedControl` (upsell-gates a control by plan) (`:483`), `BillingSetupBanner` (`:4537`).

Overview / tasks / reports
- `ManagementOverviewPanel` (`:6208`), `StoreReadinessPanel` (`:6352`), `TodayFocusPanel` (`:6494`) — manager landing.
- `StaffTaskPanel` — staff "tasks" landing — `:9768`.
- `ReportsPanel` — revenue buckets, stage funnel, platform-vs-manual split, best-day, KPI tiles — `:9153`.

Orders
- `OrdersWorkspace` — table/board toggle wrapper — `:6860`.
- `OrdersTable` — MUI table; **in-table search** (`:7010`) and **channel filter** buttons All / Online / Walk-in (`channelFilter` state `:6938`, options `:7020`); row-click opens a detail drawer reusing `OrderCard` — `:6922`.
- `OrdersKanban` — status-column board (`orderBoardKey` `:6675`, `orderBoardRank` `:6682`) — `:6703`.
- `OrderCard` — full order record: stage advance, payment/balance, measurements — `:7468`; `OrderActionMenuItem` (`:7414`); `InfoStrip` (`:8017`); `CopyLinkButton` (`:8077`).
- `WalkInOrderPanel` — create walk-in / bespoke orders in person; ready-made (size-band priced) vs bespoke (measured, priced later) toggle; closes on success via `useCloseOnSuccess` — `:10386`.
- `BookingQueuePanel` — home-visit booking queue — `:14369`.

Money
- `MoneyPanel` — money summary (`through_platform`, `commission`, `manual_takings`, `offline_commission_due`, `net_income`), manual-takings log (`log_taking`), paginated takings — `:10070`. (Offline/manual takings are fee-free; commission applies only to Paystack flows.)

Handovers
- `HandoverPanel` — segmentation by fulfilment (delivery vs pickup) + status filter, paginated; surfaces fulfilled orders lacking an open handover (`fulfilledOrdersWithoutOpenHandover` `:3304`) — `:14539`.

Availability
- `AvailabilityPanel` — weekly visit-hour windows producing customer home-visit slots — `:14893`.
- `AvailabilityWindowFields` — one window row with **recurrence** select (daily/weekly/monthly/ongoing `:14995`), conditional weekday (`:15002`) / day-of-month (`:15016`) fields, slot minutes, and start/end `StyledTimeField`s — `:14948`.

Catalogue / Design Studio
- `CatalogueSetupPanel` — two-column Collections + Size-band creation (auto next-sequence) — `:12249`. `CollectionEditButton` (`:11845`).
- `SizeBandForm` — size band label/order + editable **size-chart** rows (measurement / value / unit) serialized to a hidden `chart_json` — `:11925`; `SizeBandEditButton` (`:12091`), `SizeBandDeleteButton` (`:12127`).
- `SizeBandLibraryPanel` — read-only size-band + chart chips overview (customer-facing measurements) — `:12160`.
- `DesignCard` (`:8120`), `DesignRow` (`:8455`), `DesignImagesField` (`:8256`), `DesignImageUploadPanel` (`:10904`), `ImageDropzone` (`:10701`).
- `DesignPricesSection` — per-size-band pricing grid keyed by band → `set_design_price` — `:8387`.
- `MeasurementFieldRow` — measurement-field editor row — `:8845`.

Promotions
- `PromotionPanel` (`:12646`), `PromotionCreateForm` (`:12995`), `PromotionRow` (`:13196`), `PromotionDetailForm` (`:13298`); label/tone helpers `promotionDiscountLabel`/`promotionStatusTone`/`promotionScopeLabel`/`promotionTargetLabel`/`promotionWindowLabel` (`:12580`–`:12631`).

Team / business users
- `TeamPanel` (`:13573`), `BusinessUserCreateForm` (`:13931`), `BusinessUserRow` (`:14081`), `BusinessUserDetailForm` (`:14193`), `OwnerTransferPanel` (transfer ownership) (`:13982`). Role helpers `roleLabel`/`roleTone`/`rolePermissionMessage` (`:2404`–`:2430`).

Settings / verification / delivery
- `StoreSettingsPanel` — storefront toggles (bespoke, measurements, customisation, collections, delivery, dispatch), brand colour, logo/banner (via `StorefrontImageUploadField` `:11110`), layout variant — `:11459`.
- `BusinessVerificationPanel` — **Ghana Card** KYC: status chip (verified / in-review / rejected / not-verified), submit via `submit_identity_verification` — `:11185`.
- `DeliveryZonesPanel` — delivery areas + per-zone fee shown at checkout — `:11307`.
- `NotificationPanel` — messages feed — `:15059`.

Custom date/time inputs
- `StyledTemporalField` (`:3707`), `StyledDateTimeField` (`:3779`), `StyledTimeField` (`:3991`) — bespoke MUI date/time controls with parse helpers (`normaliseDateInput` `:3534`, `composeDateTimeValue` `:3572`, etc.).

Shared hook
- **`useCloseOnSuccess(setOpen, intent, errorPresent)`** — closes a dialog/drawer once the matching `intent` submission returns idle with no error; tracks the in-flight `navigation.formData` intent — `:11819`. Used throughout the edit dialogs.

#### Auth & onboarding routes

- **`login.tsx`** — `action` (`:42`) branches on intent: `mfa` (verify second factor against the stashed `mfaChallenge`, `:49`), `otp-request` (ask API to WhatsApp a code, `:94`), `otp-verify` (redeem code → session, may re-stash an MFA challenge, `:116`), default password login. Component (`:255`) has a **method toggle** password | WhatsApp (`method` state `:268`) plus a distinct MFA form when `mfaRequired`.
- **`register.tsx`** — 3-step wizard (`step` state `:170`, `goNext`/`goBack` `:276`): **Step 1** store identity with live handle-availability (`/handle-check`, `handleStatus` `:224`), **Step 2** owner account + **WhatsApp code verify** (fetches `/business-otp` `:205`, then a code field), **Step 3** plan pick. `loader` (`:53`) loads plans; `action` (`:66`) submits registration incl. `whatsapp_number`/`whatsapp_code`.
- **`billing-onboarding.tsx`** — `loader` (`:103`) reads plan + verification status; `action` (`:131`) requires a Ghana Card on file (number + front photo, uploaded via `lib/media`) unless already verified, then `startPaystackBilling` (`:105`) gets a **standard checkout** link (priced at the first period) and redirects to Paystack; if the API returns `activated:true` (free-period/full-discount/already-paid — no checkout needed) it redirects straight to `/dashboard?billing=active`. `isIdentityOnFile` (`:42`).
- **Resource routes** — `handle-check.ts` (GET proxy → `/auth/business/handle-availability`, returns `{handle, available, reason}`) and `business-otp.ts` (POST proxy → `/auth/business[/register]/otp/request`; always resolves `{ok:true}` to keep account existence opaque). `ai-assist.ts` proxies the writing assistant with the session token.

#### Notable patterns
- Intent-dispatch is the sole mutation mechanism; permission checks gate intents by role server-side.
- Loaders degrade gracefully (`dataWarnings`) instead of failing the whole page.
- The single 17k-line file keeps all types, helpers, and components co-located; sections are pure functions of loader data + `?section`.

---

### apps/storefront

**What it is + tech.** The customer storefront / marketplace at `store.xtiitch.com` and per-store subdomains `<handle>.xtiitch.com`. React Router v7 SSR + MUI + Emotion. A store is resolved from the `Host` header (`lib/tenant.ts`); the apex renders the marketplace. Cart lives in its own cookie so no account is needed until checkout.

#### Key routes — `app/routes.ts`

| Route path | file | loader / action purpose |
|---|---|---|
| `/` (index) | `routes/home.tsx` | `loader` resolves the store from `Host` (`storeHandleFromHost`); renders `StoreView` for a store subdomain, else the `Marketplace` (shops + sponsored). |
| `/discover` | `routes/discover.tsx` | AI search (`aiSearch`) with quota meter; loader runs the query with the optional customer token. |
| `/account` | `routes/account.tsx` | Customer auth (WhatsApp/Email OTP) + profile; actions `switch`/`request`/`verify`/`update_profile`/`signout`. |
| `/store/:handle` | `routes/store.tsx` | Legacy path store page (`api.store`). |
| `/d/:handle` | `routes/design.tsx` | Design detail: size/price, add-to-cart, bespoke routes, month-grid visit calendar. |
| `/c/:handle` | `routes/collection.tsx` | Collection page. |
| `/cart` | `routes/cart.tsx` | Cart view; actions `remove`, `clear`. |
| `/checkout` | `routes/checkout.tsx` | Pickup/delivery + GPS + single-or-combined Paystack charge. |
| `/track` | `routes/track-lookup.tsx` | Order-id lookup form. |
| `/track/:orderId` | `routes/track.tsx` | Public order tracking timeline. |
| `/robots.txt` `/sitemap.xml` | `routes/robots.tsx` / `sitemap.tsx` | SEO resource routes. |
| `*` | `routes/not-found.tsx` | 404. |

#### lib/

- **`lib/api.ts`** — server-side public catalogue client. `API_BASE = XTIITCH_API_URL ?? localhost:8080` (`:4`), all calls to `/v1/public/*` via `getJSON`/`postJSON` (`:152`/`:250`). The `api` object (`:325`): `store`, `tracking`, `search`, `design`, `collection`, `referral`, `availability` (with from/to range), `shops`, `sponsored`, `recordAffiliateClick`, `placeOrder` (single), `placeCartOrder` (combined), `deliveryZones`, `placeCustomOrder` (bespoke), `placeBooking` (home visit), `joinWaitlist`. Rich types incl. `StoreSummary` (with plan gating: `waitlist_enabled`, `online_ordering_enabled`, `plan_code`), `PlaceCartOrderInput` (delivery zone/address), `CustomSizeMode` = `self_measure | home_visit | come_to_shop`.
- **`lib/cart.ts`** — cookie **`xt_cart`** (httpOnly, 7-day) holding one store's items (`:35`). `CartItem` supports `kind` (`made_to_wear`/`bespoke`), `size_mode`, and `measurements` (`:11`). `addToCart` starts a fresh cart when switching stores (`:65`); `removeFromCart`/`clearCart`/`cartTotalMinor`.
- **`lib/session.ts`** — cookie **`xt_customer`** (httpOnly, 30-day) holding `{ customerToken, customerPhone }` from phone/email OTP (`:12`); attached server-side for the larger AI-search allowance.
- **`lib/tenant.ts`** — `storeHandleFromHost(host)` resolves the store subdomain, excluding `RESERVED_SUBDOMAINS` (www/app/admin/api/store/stores/dashboard) and IP/localhost (`:18`).
- **`lib/discovery.ts`** — `aiSearch` (`:204`), customer OTP (`requestCustomerOtp` `:34`, `verifyCustomerOtp` `:58`), `whatsAppOtpEnabled` flag check (`:14`), customer profile/orders CRUD (`:114`+). All hit `${API_BASE}/v1/...`.

#### Major components / panels

- **`components/storefront.tsx`** — `XtiitchMark` (inline "ii-stitch" SVG brand mark: two bars, two dots, a seam curve) `:55`; `XtiitchPlatformLogo` (owner-managed logo from `/v1/branding`, falls back to `XtiitchMark`) `:104`; `StoreHeader` (`:211`), `StoreServiceBand` (`:548`), `CollectionStrip` (`:638`), `StoreOrderGuide` (`:772`), `StoreView` (full store page) `:923`, `MarketplaceStrip` (`:1032`) + `MarketplaceShopCard` (`:1142`), `DesignCard` (`:1253`), `DesignGrid` (`:1531`), `DesignImage` (`:1220`). Helpers `contrastText` (`:41`), `usePagedItems` (`:136`).
- **`components/marketplace.tsx`** — apex marketplace: `Marketplace` (`:291`), `FeaturedCard` (sponsored placement) `:43`, `StudioCard` (`:100`), `DesignCard` (`:184`), `EmptyState` (`:606`).

#### routes/design.tsx (2,516 lines) — the big storefront route

- **`loader`** (`:57`) — `api.design` (404 → throw), reward codes from cookies/query (`rewardCodesFromRequest` `:411`), and in parallel referral preview, home-visit `availability` (28-day range `availabilityRangeForRequest` `:88`, only when bespoke enabled), and the store page for related designs (`relatedDesignsFor` `:95`).
- **`action`** (`:128`) — intents: `add_to_cart` (`:139`; made-to-wear or self-measure bespoke deposit only — visit/shop routes are refused into cart, `:162`), `waitlist` (`:221`), `custom` (`:259`; bespoke order — `home_visit` needs a slot+address `:269`, `self_measure` needs measurements `:306`, `come_to_shop` has no payment method), plus the default `standard` place-order. Size-mode coercion `toCustomSizeMode` (`:382`), measurement collection `collectMeasurements` (`:393`), reward/attribution payloads (`:468`/`:475`).
- **Size & price** — `SizePriceList` (`:995`), `StandardOrderPanel` (made-to-wear add-to-cart / buy, `:1110`), `resolveDepositMinor` (`:651`), `Gallery` (`:526`), `DetailSignal` (`:1059`), `RewardFields` (promo/referral/affiliate cues) (`:820`).
- **Bespoke** — `BespokeOrderPanel` (`:2035`), `CustomRouteForm` (`:1872`), `customRoutes` (self-measure / home-visit / come-to-shop cards) (`:1268`), `MeasurementInputs` (`:1328`).
- **Month-grid availability calendar** — `VisitSlotFields` (`:1532`): groups slots by day (`groupVisitSlots` `:1444`), computes the earliest/latest month window and clamps paging (`monthBounds` `:1547`), renders a month grid via `buildVisitMonthWeeks` (`:1509`) where a day is selectable iff it has an open slot; a hidden `slot_start` carries the chosen slot. Day/time helpers `visitDayKey` (`:1410`), `visitMonthIndex` (`:1494`), `makeVisitDayKey` (`:1488`).
- `RelatedDesigns` (`:2124`), `WaitlistPanel` (`:2204`). Default `DesignPage` composes it all keyed off store brand colour (`:2303`).

#### routes/checkout.tsx — pickup/delivery + GPS + combined charge

- **`loader`** (`:39`) — loads the cart + delivery zones (only when the cart has a made-to-wear line).
- **`action`** (`:56`) — reads `fulfilment` (pickup/delivery), `delivery_zone_id`, `delivery_address`, and an **optional free-text `gps_location`** (GhanaPostGPS code or Maps link, `:74`) appended to the delivery address (`:86`). Validation: delivery requires a made-to-wear line + zone + address (`:75`, `:81`). **Two paths:** a lone pickup made-to-wear piece uses the proven single `api.placeOrder` (`:100`); everything else (multiple pieces, bespoke deposit, or delivery) uses **one combined `api.placeCartOrder`** — each line becomes its own order in a checkout group settled by a single Paystack webhook, with the delivery zone fee added (`:127`). On success redirects to the Paystack `authorization_url`, else to `/track/:orderId`; clears the cart cookie (`:91`).
- Component (`:163`) computes `deliveryFee`/`grandTotal`, offers delivery only when `hasMadeToWear && zones.length > 0`, and shows the GPS field only in delivery mode.

#### Customer auth — routes/account.tsx
`Step` = identify | verify (`:47`); channel WhatsApp | Email (`:48`). `action` (`:108`): `signout`, `update_profile`, `switch` (re-render on chosen channel, no JS), `request` (with a server-side WhatsApp-flag backstop that falls back to email, `:154`), `verify` (redeem OTP → set `customerToken` cookie). Uses `components/otp-code-input.tsx`.

---

### apps/marketing

**What it is + tech.** The public marketing site at the apex (`xtiitch.com`). React Router v7 SSR + MUI + Emotion. Mostly static content pages plus a launch-gated directory and a waitlist. No server session — the only persistence is `localStorage` (theme + an anonymous sponsored `visitorId`).

#### Key routes — `app/routes.ts:3`

| Route path | file | loader / action |
|---|---|---|
| `/` | `routes/home.tsx` | `loader` returns sponsored/featured via `loadSponsoredOrFeatured(4)` (`:105`); `action` handles the `sponsored_event` beacon intent (`:109`). |
| `/discover` | `routes/discover.tsx` | `loader` gates on `requireMarketingFlag("discover")`, loads shops + sponsored (`:30`). |
| `/shops` | `routes/shops.tsx` | Gated; shops + non-design sponsored (`:31`). |
| `/designs` | `routes/designs.tsx` | Gated; flattened designs + promoted-design sponsored (`:29`). |
| `/features` `/growth` `/how-it-works` `/pricing` `/for-customers` `/security` `/faq` `/privacy` `/terms` `/payment-policy` | `routes/*.tsx` | Static (meta only). |
| `/contact` | `routes/contact.tsx` | The de-facto **waitlist** route — `action` submits a waitlist lead (`:26`). No dedicated `waitlist.tsx` exists. |
| `/robots.txt` `/sitemap.xml` | `routes/robots.tsx` / `sitemap.tsx` | Plaintext / XML resource routes. |
| `*` | `routes/not-found.tsx` | Throws 404 → root `ErrorBoundary`. |

#### root.tsx, content, SEO
- **`root.tsx`** — `loader` (`:111`) fetches `${API}/v1/branding` and returns `{ brandLogoUrl, signupUrl, marketplaceUrl, marketingFlags }`; fails safe (empty logo, all flags hidden). **Marketing feature flags** `browse_store, discover, create_store, pricing` default **false** (`DEFAULT_MARKETING_FLAGS` `:80`, strict `=== true` coercion `:87`); `useMarketingFlags()` (`:143`). Injects Organization + WebSite JSON-LD (`STRUCTURED_DATA` `:151`). `SIGNUP_URL = {XTIITCH_DASHBOARD_URL}/register`, `MARKETPLACE_URL` from `XTIITCH_STOREFRONT_BASE_URL` (`:50`/`:57`).
- **`content.ts`** — single source of marketing copy: `site`, `navLinks`, `features`, `steps`, `bespokeStages` (red/yellow/green track), `plans` (Free/Starter/Growth/Studio in GHS), `pricingNotes`, `trustPoints`, `growthProgrammes`+`growthGuardrails`, `customerPoints`, `faqs`, `measurementRoutes`.
- **`components/seo.ts`** — `pageMeta({title, description, path, rootTitle})` (`:15`) returns title/description/canonical + full Open Graph + Twitter `summary_large_image`. **OG image is a single STATIC file** `${BASE_URL}/og.png` (1200×630, `:25`) — no satori/@vercel/og; no dynamic OG route. `BASE_URL = "https://xtiitch.com"`.

#### Major components
- **`components/layout.tsx`** — `XtiitchMark` (ii-stitch SVG brand mark) `:44`; `Logo` (owner logo from root loader, else mark + wordmark) `:69`; grouped mega-nav (`navGroups` `:154`, `MegaMenu` `:347`, `MegaItem` `:231`, `MobileNav` `:521`); `Header` (sticky AppBar; flag-gates the Discover group and "Browse the store" button) `:561`; `Footer` (link columns, "never holds your money" copy) `:873`.
- **`components/ui.tsx`** — shared kit: `Eyebrow` (`:85`), `Section` (`:120`), `SectionHeading` (`:167`), `CtaRow` (`:210`), `PageHero` (`:245`), `FeatureGrid` (`:385`), `StepList` (`:511`), `MeasurementRouteGrid` (`:610`), `ProductPreview` (`:725`), `PlanCards` (monthly/yearly toggle, gated by `pricing` flag) (`:1068`), `FaqList` (`:1290`), `PolicySectionList` (`:1368`), `TrustGrid` (`:1457`), `CtaBand` (`:1549`), `TrackingPreview` (`:1730`).
- **`components/waitlist-form.tsx`** — `WaitlistForm({source})` (`:60`) uses `useFetcher`, a hidden `source`, a visually-hidden honeypot `website` field (`:151`), and a `consent` checkbox.
- **`components/directory.tsx`** — `ShopCard` (`:85`), `DesignCard` (`:186`), `SponsoredRail` (`:236`).
- **`components/pagination.tsx`** — `PaginatedGrid<T>` client-side pagination (`:8`).

#### lib/
- **`lib/directory.ts`** — `loadPublicShops()` → `GET /v1/public/shops` mapping snake→camel (`:51`), `flattenDesigns`, `formatGHS`, `marketplaceHref`/`storefrontHref` (`{handle}` template) (`:106`/`:115`).
- **`lib/waitlist.ts`** — Zod `waitlistSchema` (incl. honeypot) (`:8`), `parseWaitlist(FormData)` (`:47`), `submitWaitlistLead` → `POST /v1/marketing/waitlist` (`:75`).
- **`lib/launch-gate.ts`** — `requireMarketingFlag(flag)` server-side gate: fetches `/v1/branding`, `throw redirect("/")` when the flag is not `=== true` (`:15`).
- **`lib/sponsored.ts`** — `loadSponsoredPlacements(limit)` → `/v1/public/sponsored` (`:45`), `loadSponsoredOrFeatured` fallback to featured verified shops (`:66`), `recordSponsoredEvent` → `/v1/public/sponsored/{id}/events` forwarding client IP/UA (`:104`).

#### Notable patterns
- Only the home route uses intent dispatch (`sponsored_event`, POSTed via `navigator.sendBeacon` `home.tsx:976`); the waitlist action is plain form-based.
- Everything behind the "Discover"/"pricing"/"browse store" flags is hidden by default until the API's branding flags flip them on.
- `entry.server.tsx` sets a full CSP (allowing Emotion inline styles + Google Fonts).

---

### apps/admin

**What it is + tech.** The platform-owner console (`admin.xtiitch.com`). React Router v7 SSR + MUI + Emotion. `app/routes/admin.tsx` is the single ~20,183-line console (mirrors the dashboard pattern). Never indexed.

#### Key routes — `app/routes.ts:3`

| Route path | file | loader / action |
|---|---|---|
| `/` | `routes/home.tsx` | `loader` redirects to `/admin`. |
| `/login` | `routes/login.tsx` | Email/password sign-in (no MFA); dedicated form, not intent-dispatch. |
| `/admin` | `routes/admin.tsx` | **The console.** Loader fans out ~25 API calls; single intent-dispatch action. |
| `/admin/customers/:id/export` | `routes/customer-export.tsx` | Resource route: streams the Act-843 subject-access JSON export. |
| `/help` | `routes/help.tsx` | Static operator guide (TTS "Listen"). |
| `*` | `routes/not-found.tsx` | 404 → root boundary. |

#### lib/
- **`lib/api.ts`** — `adminApiBase` = `XTIITCH_API_URL ?? localhost:8080` (`:4`); all calls to `${base}/v1${path}` via `requestJSON`/`requestText` (`:1435`/`:1466`). **Stateless** — the `accessToken` is passed per call as a `Bearer` header (token lives in the cookie). `AdminApiError { status, code }` (`:1420`); network fault → 503 `admin_api_unavailable`. Exports `PLAN_BENEFITS` (`:357`) and the large `adminApi` object (`:2190`) with ~90 methods spanning auth/session, profile/platform-settings/branding, metrics/health/notifications/reports/launch-readiness/money-rails, subscriptions + invoices + billing sweeps + Paystack authorization, plans, promotions, ads, affiliates + payouts, referral programmes + codes + rewards, money ops (replay/reversal/settlement-hold), risk/support/audit, verification decisions, businesses/customers (+ erase), and access control (roles/permissions/users).
- **`lib/session.ts`** — cookie **`xt_admin`** (httpOnly, lax, 12-hour) holding admin identity + `accessToken`/`refreshToken`/expiries (`:18`). `requireAdminContext` validates via `adminApi.me`, auto-refreshes on failure, else redirects to `/login` (`:43`); `setAdminSession`, `logOut`.

#### routes/login.tsx
`loader` (`:42`) redirects to `/admin` if already signed in; `action` (`:60`) does `adminApi.login` and maps `invalid_credentials`/`admin_api_unavailable` to friendly errors. Single email/password step; no MFA, no intent dispatch.

#### routes/admin.tsx — the console (20,183 lines)
- **Section model** — `Section` union of 22 (`:166`); `sectionFromParam` deep-links `?section=` (`:192`); `navItems` (`:316`); `adminNavGroups` — **Growth** (subscriptions, promotions, ads, affiliates, referrals), **Access** (users, roles, verification, businesses, customers), **Operations** (money, risk, support, settings, waitlist, audit), **Command** (notifications, reports, exports, health, readiness), Overview pinned (`:466`).
- **`loader`** (`:675`) — `requireAdminContext` then fans out via `loadAdminResource` (per-resource graceful fallback + `*Error` string, `:591`): profile/platform settings, roles catalog, users, verification cases, businesses, customers, platform metrics, operations health, notifications, reports, launch readiness, money rails, subscriptions, plans, promotions, ad campaigns, affiliates + attribution, referral programmes, risk reviews, support tickets, audit events, waitlist leads. `shouldRevalidate` skips refetch on same-path section switches (`:574`).
- **`action`** (`:924`) — `intent = form.get("intent")` (`:926`) then a linear `if` chain returning `AdminActionFeedback {section, severity, message, detail?, href?}` (`:226`). Intents include: `logout` (927), `admin-export:download` (931, returns CSV), `admin-user:create|update` (945), `admin-profile:update` / `admin-preferences:update` / `admin-platform-settings:update` (987; does brand-logo upload + marketing flags), `admin-marketing-flags:update` (1065), `admin-verification:decide` (1088), `admin-business-status:update` (1120), `admin-customer:erase` (1152), `money:webhook-replay|payment-reversal|settlement-hold` (1176), `admin-subscription:update` (1234), subscription billing/recurring sweeps (1268), authorization init/verify (1308), invoice issue/paid/failed (1353), plan create/update/archive (1411), promotion CRUD (1488), ad-campaign CRUD (1563) + payment collect (1626), affiliate CRUD (1652) + conversion (1722) + payout (1749), referral code create (1775) + rewards issue (1803) + programme CRUD (1826), risk-review update (1901), support-ticket update (1929), role-permissions update (1958). `uploadBrandLogo` (Cloudinary) at `:892`.
- **Panels / sections** (each a `*Section` component wired in the switch at `:18709`):
  - `VerificationCard` — **Ghana Card / KYC review** (ID photo thumbnail `:3434`, `idCardNumber` `:3465`, approve/reject/hold → `admin-verification:decide`) `:3346`.
  - `BusinessTable`/`BusinessRow`/`BusinessInspector` — tenant directory + suspend/reactivate (`:4077`/`:4218`/`:4376`).
  - `CustomerDirectoryPanel` + `CustomerInspector` (export/erase) (`:3637`/`:3910`).
  - `SubscriptionsSection` — **plans management + subscription billing** (plan CRUD, invoices, sweeps, Paystack authorization links) `:8374`; `PlanBenefitsField` (`:7546`), `PlanStatTile` (`:10145`).
  - `PromotionsSection` (`:10176`), `AdsSection` (`:11186`), `AffiliatesSection` (`:12217`), `ReferralsSection` (`:13359`).
  - `RolePermissionsSection` + `RolePermissionMatrix` (`:14451`/`:14400`), `AdminUsersSection` (`:14914`).
  - `SettingsSection` — **platform settings + logo upload + marketing flags + profile/preferences** `:15486`.
  - `LaunchReadinessSection` — **launch gates** mapping checks to target sections, ready/watch/blocked stat cards `:7180`.
  - `NotificationsSection` (`:4672`), `ReportsSection` (`:5153`), `ExportsSection` (CSV snapshots `:5752`), `HealthSection` (`:6714`), `WaitlistSection` (`:16197`), `OverviewSection` (landing stat cards + trends `:17604`).
  - Chrome: **`AdminRail`** left nav (collapsible, widths 296/88) `:16302`; `AdminTopBar` (search/help/theme/notifications/logout) `:16922`; `HelpDrawer` from `help-center.tsx`.
  - Primitives: `Panel` (`:3107`), `MetricCard` (`:3209`), `RiskChip`/`StatusChip` (`:3310`/`:3326`), `usePagedItems` (`:3138`).
- **Default `AdminDashboard`** (`:18274`) — destructures all loader data, derives `section` (URL → action-feedback → overview), and renders the rail + top bar + section switch (`:18709`–`19994`).

#### customer-export.tsx & help
`customer-export.tsx` (`:1`) — `requireAdminContext`, fetches `${adminApiBase}/v1/admin/customers/:id/export` with the Bearer token, streams JSON as an attachment (Data Protection Act 843). `lib/help-content.ts` supplies `HELP_GUIDES` keyed by section + TTS builders; `help-center.tsx` exports `SpeakButton`, `HelpGuideCard`, `HelpDrawer`.

---

### apps/mobile

**What it is + tech.** Expo/React Native app (`@xtiitch/mobile`, private). Expo 56, React Native 0.86, React 19, **expo-router** 56, `@react-native-async-storage/async-storage`, `expo-notifications`. `main: "expo-router/entry"`. Two surfaces: customer + business.

#### Structure
- **`app/_layout.tsx`** — `RootLayout` (`:10`) wraps `SafeAreaProvider` → `BrandingProvider` → `ThemeModeProvider`; `ThemedStack` (`:23`) is the expo-router `Stack` with a wine header, centered `HeaderLogo` title (`:38`), `ThemeToggle` right (`:40`), registering 9 screens.
- **Screens** (one line each):
  - `app/index.tsx` `HomeScreen` (`:25`) — customer landing; featured studios (`api.sponsored`), open-store-by-handle / track-by-id inputs, CTA into the business console; footer shows `apiBaseUrl()`.
  - `app/store/[handle].tsx` `StoreScreen` (`:30`) — storefront + in-store search (`api.store`/`api.search`), design grid.
  - `app/design/[handle].tsx` `DesignScreen` (`:35`) — design detail + checkout (size band, reward codes, momo/card, `api.placeOrder` → Paystack `authorization_url`), `OrderConfirmation` (`:349`).
  - `app/track/[id].tsx` `TrackScreen` (`:15`) — public tracking (`api.tracking`) + `StageTimeline`.
  - `app/business/login.tsx` `BusinessLoginScreen` (`:17`) — studio sign-in (`login()`), redirects to `/business` if a session exists.
  - `app/business/index.tsx` `BusinessDashboardScreen` (`:24`) — session-guarded KPI tiles + recent orders (`businessApi.orders`/`me`), new-walk-in CTA.
  - `app/business/orders.tsx` `BusinessOrdersScreen` (`:30`) — orders list with All/Open/Completed tabs, pull-to-refresh.
  - `app/business/order/[id].tsx` `OrderDetailScreen` (`:32`) — order detail: adjust agreed total, collect balance (Paystack), advance stage, `StageTimeline`.
  - `app/business/new-order.tsx` `NewOrderScreen` (`:22`) — create walk-in order (`businessApi.createWalkIn`).
- **`src/ui.tsx`** — `XtiitchMark` (`:24`, the ii-stitch mark built from `View`s, no SVG), `HeaderLogo` (`:52`, operator `logoUrl` else `XtiitchMark`), `CenterState` (`:67`), `SkeletonBlock`/`SkeletonStack` (`:97`/`:121`), `LoadingButtonLabel` (`:138`), `ImageTile` (`:210`), `OrderRow` (`:235`), `StageTimeline` (`:279`).
- **`src/branding.tsx`** — `BrandingProvider` (`:22`) + `useBranding` (`:47`) fetch `${apiBaseUrl()}/branding` once at launch, expose `{ logoUrl }`.
- **`src/auth.ts`** — business session in **AsyncStorage** key `"xtiitch.business.session.v1"` (`:12`) + in-memory cache (secure-store noted as a follow-up `:5`). `BusinessSession` (`:14`), `loadSession` (`:36`), `login` (`:70`, `POST /auth/business/login`), `logout` (`:95`), `refresh` (`:111`), `authedFetch` (`:138`, attaches `Bearer`, refreshes once on 401 then retries else clears + throws `SessionExpiredError`).
- **`src/api.ts`** — public catalogue client; `apiBaseUrl()` (`:136`) resolves from `EXPO_PUBLIC_XTIITCH_API_URL`/`XTIITCH_API_URL` (must include `/v1`); `api` object (`:170`) `store`/`search`/`design`/`sponsored`/`tracking`/`placeOrder`; `formatGHS` (`:219`).
- **`src/businessApi.ts`** — authenticated client via `authedFetch`; `businessApi` (`:81`) `me`, `orders`, `advanceOrder`, `setAgreedTotal`, `collectBalance` (Paystack), `designs`, `sizeBands`, `createWalkIn`; `request<T>` maps `SessionExpiredError` → `{ ok:false, expired:true }` (`:34`).
- **`src/surfaces.mjs`** — `mobileSurfaces` (`:1`) customer + business surface definitions; `resolveApiBaseUrl(env)` (`:73`) normalizes the base URL (default `http://localhost:8080`). Unit-tested by `test/surfaces.test.mjs`.
- **`src/theme.ts` / `src/theme-mode.tsx`** — brand palette (light/dark), `spacing`/`radius`/`swatches`; mode persisted to AsyncStorage `"xtiitch.theme-mode"` with an animated cross-fade; `ThemeToggle` uses Ionicons.

---

### packages/

Four private workspace packages (`@xtiitch/*`), all `"type": "module"`, consumed in-repo.

- **`@xtiitch/design-tokens`** (`packages/design-tokens/src/index.ts`) — the shared design system, served **from source** (`exports.` → `./src/index.ts`). Exports `xtiitchColors` (`:5` — wine `#800020` / deepWine / wineTint / ink / cream, neutrals graphite/mauve/line/gold, functional order-status success/warning/danger/info, with legacy aliases like `burgundy`), `XtiitchThemeMode` (`:36`), `xtiitchFonts` (`:56` — Fraunces display + Outfit body stacks + a Google Fonts `href`), `xtiitchThemeColors` light/dark maps (`:63`), `getXtiitchThemeColors(mode)` (`:124`), `xtiitchRadii` (`:128`), `xtiitchSpacing` (`:138`), `xtiitchTypography` (`:147`). Every web app's `theme.ts` builds its MUI theme from this.
- **`@xtiitch/contracts`** (`packages/contracts/`) — the API contract seeds. `openapi/xtiitch.v1.openapi.json` is the primary v1 REST contract (OpenAPI 3.1.0, "Xtiitch API" v0.1.0, servers `api.xtiitch.com` + `localhost:8080`, ~56 paths, 10 tags: Health, Business auth, Business dashboard, Public storefront, Payments, Growth, Admin auth, Admin operations, Admin growth, Webhooks). `proto/README.md` (gRPC reserved for internal boundaries) and `graphql/README.md` (reserved for composed read models) are stubs. Tested via `test/openapi.test.mjs`.
- **`@xtiitch/schemas`** (`packages/schemas/src/index.ts`) — Zod validation primitives shared across services (served from built `./dist`): `ghsMinorUnitsSchema` (`:3`, int ≥0 GHS pesewas), `tenantScopedIdSchema` (`:9`, UUID), `storeHandleSchema` (`:11`, lowercase slug 3–64 chars, regex `^[a-z0-9][a-z0-9-]*[a-z0-9]$`). Depends on `zod`.
- **`@xtiitch/api-client`** (`packages/api-client/src/index.ts`) — a thin typed client scaffold: `XtiitchApiClientOptions { baseUrl, getAccessToken? }` (`:1`) and class `XtiitchApiClient` with a single `health()` method hitting `/healthz` (`:6`). Currently minimal — the web apps and mobile use their own `lib/api*.ts` clients rather than this package.


---

## Xtiitch — Adversarial Security Assessment

**Scope:** Go API (chi, pgx, JWT), Postgres RLS, Paystack, WhatsApp/TOTP auth, React Router SSR frontends.
**Method:** Read the code and hunted for a way in — forge tokens, cross tenants, underpay, hijack accounts, brute-force, inject. Assumed a skilled human or a capable AI agent as the adversary.
**Repo:** `/Users/shayford/Desktop/Dev/Projects/xtiitch`

### One-line verdict

> **No easy break-in.** The security-critical paths (auth, JWT, RLS multi-tenancy, payment integrity, injection) are genuinely well-built and defense-in-depth; the residual risk is operational (plaintext prod secrets in the working tree, config gated on `APP_ENV`) and abuse/DoS (spoofable rate-limit key, no login lockout, uncapped OTP sends) — not a direct data-theft or underpay hole.

### Findings by severity

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 7 |
| Low | 6 |
| Info | 3 |
| **Total** | **16** |

---

### Category verdicts at a glance

| # | Category | Verdict |
|---|---|---|
| 1 | Authentication (bcrypt / JWT / refresh / timing) | **Solid** |
| 2 | MFA / TOTP | **Solid** |
| 3 | OTP (WhatsApp + business sign-in) | **Solid** (send-side rate limiting is the gap) |
| 4 | Multi-tenant isolation / RLS | **Solid** |
| 5 | Payments / webhooks / amount tampering | **Solid** |
| 6 | Authorization / RBAC / mass-assignment | **Solid** |
| 7 | Injection (SQL) | **Solid** |
| 8 | Secrets handling (git) | **Solid in git; Weak on local disk** |
| 9 | Transport / CORS / cookies | **Adequate** (API solid; frontends missing CSP/HSTS) |
| 10 | Rate limiting / DoS | **Adequate** (limiter bypassable; no lockout) |
| 11 | Media upload (Cloudinary) | **Adequate** (signed + auth-gated; no type/size cap) |
| 12 | Inbound WhatsApp webhook | **Solid** (fail-open only when unconfigured) |

---

### 1. Authentication — Solid

**Controls (evidence):**
- **JWT algorithm pinned.** Every verify path pins HS256 via `jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()})` and requires `exp`, `iss`, `aud`: `apps/api/internal/adapters/outbound/auth/jwt.go:104-108, 136-139, 168-171, 222-225`. This closes the classic `alg:none` / RS→HS confusion attack.
- **Token-type confusion blocked.** Each verifier checks a `typ` claim (`access` / `admin_access` / `customer_access` / `mfa_challenge`) and admin additionally checks `scope=="admin"` and `role.Valid()`: `jwt.go:145-147, 177-189, 231-235`. An MFA-challenge token cannot be replayed as an access token.
- **Empty signing key rejected at construction:** `jwt.go:26-29`.
- **bcrypt** for passwords, cost defaulting to `bcrypt.DefaultCost` (10): `apps/api/internal/adapters/outbound/auth/bcrypt.go:9-14`. Password length bounded 8–72 to avoid silent bcrypt truncation: `apps/api/internal/application/auth/service.go:23-27, 891`.
- **Refresh tokens:** 256-bit `crypto/rand`, base64url, stored only as SHA-256 hash: `apps/api/internal/adapters/outbound/auth/refresh.go:16-28`. **Rotation is single-use:** on refresh the presented session is revoked before a new pair is issued, and revoked/expired/inactive sessions are rejected: `service.go:541-566`. Logout is idempotent and never reveals token existence: `service.go:574-586`.
- **Login enumeration/timing equalisation:** on unknown/inactive user the code still performs a bcrypt hash and returns the identical `ErrInvalidCredentials`: `service.go:483-491`.
- **Self-service password reset** is opaque (always returns nil), code is 6-digit `crypto/rand`, hashed, 15-min TTL, capped at 5 tries: `service.go:747-833`.
- **Principal is derived server-side** from the verified token (business id + role come from claims, never from a client field): `apps/api/internal/adapters/inbound/http/auth/middleware.go:13-23, 46-66`.

**Findings:**
- **L4 (Low) — bcrypt cost is DefaultCost (10).** `bootstrap/app.go:120,163` calls `NewBcryptPasswordHasher(0)` → cost 10. Fine today but on the low end. *Fix:* set cost 12 via config.
- **L5 (Low) — no refresh-token reuse detection / family revocation.** `RefreshSession` (`service.go:547-553`) rejects an already-revoked token but does not revoke the whole session family on reuse, so a stolen-then-rotated token theft is contained to one use but not actively detected. *Fix:* on presentation of a known-but-revoked refresh hash, revoke all sessions for that user and alert.
- **I3 (Info) — customer JWT is 30-day, stateless, non-revocable.** `customerauth/service.go:18`, `jwt.go:199-215`. Acceptable for a low-privilege shopper token but there is no server-side revocation. *Fix:* shorten TTL or add a customer session/refresh table if customer-account abuse becomes a concern.

### 2. MFA / TOTP — Solid

**Controls:**
- **Secrets encrypted at rest** with AES-256-GCM (random nonce prefixed); key = SHA-256 of the key material: `apps/api/internal/adapters/outbound/auth/totp.go:45-58, 181-216`. Secret is 160-bit `crypto/rand`: `totp.go:64-70`.
- **Replay guard:** `VerifyCode` only accepts a step strictly greater than the last-used step and compares constant-time (`subtle.ConstantTimeCompare`): `totp.go:92-112`; the used step is persisted via `MarkVerified`: `service.go:1252-1256`. Drift window is ±1 step.
- **Verification lockout:** 5 consecutive failures → 15-min lockout, enforced before consuming a code: `service.go:39-40, 1240-1275`.
- **Backup codes:** 10 single-use codes, unbiased rejection-sampling RNG, hashed SHA-256, consumed on use: `totp.go:133-177`, `service.go:1142-1159, 1259-1269`.
- **Challenge-token flow is correct:** password stage mints a 5-min `mfa_challenge` token that grants nothing on its own; only `VerifyMFALogin` redeems it, and it re-confirms the user is still active during the window: `service.go:496-521, 1198-1234`.

No findings. This is a careful, standards-correct implementation.

### 3. OTP (WhatsApp customer + business sign-in) — Solid (send-side is the gap)

**Controls:**
- **Attempt caps:** `maxOTPAttempts = 5` (customer) `customerauth/service.go:17,173`; `maxBusinessOTPAttempts = 5` (business) `auth/whatsapp_otp.go:16,159`. Wrong code increments; match consumes the challenge.
- **Code entropy:** `crypto/rand.Int(…, 1_000_000)` → uniform 6-digit, no modulo bias: `apps/api/internal/adapters/outbound/auth/customer_otp.go:22-28`.
- **Expiry:** 5-min TTL on both: `customerauth/service.go:16`, `whatsapp_otp.go:15`. Codes stored only as SHA-256 hashes.
- **Enumeration opacity:** request endpoints always return 202/nil regardless of whether the identifier is registered: `customerauth/handler.go:96-98`, `whatsapp_otp.go:40-45`.
- **⭐ A valid OTP does NOT bypass MFA.** `VerifySignInOTP` replaces the *password* as the first factor but, if the account is MFA-enrolled, still returns an MFA challenge exactly like password login: `whatsapp_otp.go:71-119`. This is the correct, security-conscious design.

**Finding:**
- **M4 (Medium) — OTP request endpoints have no per-recipient cooldown.** `RequestOTP`/`RequestEmailOTP`/`RequestSignInOTP` mint and send a fresh code on every call with no throttle beyond the (bypassable, see M2) global limiter. *Exploit:* WhatsApp/SMS/email cost abuse and message-bombing a victim's number; also lets an attacker churn many concurrent challenges. Guessing itself stays bounded (5 tries × 10⁻⁶ per challenge), so this is an abuse/cost DoS, not an account-takeover. *Fix:* per-identifier cooldown (e.g. 1 send / 30–60 s, N/hour) and cap concurrent active challenges.

### 4. Multi-tenant isolation / RLS — Solid

This is the strongest part of the system and is enforced in the database, not just the app.

**Controls (evidence):**
- **App DB role is non-privileged:** `CREATE ROLE xtiitch_app LOGIN … NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE` — `infra/migrations/000004_rls_app_role.up.sql`. Migrations run as the owner; the API connects as this role, so RLS is actually enforced against it. Config comment confirms the split: `platform/config/config.go:95-97`.
- **RLS ENABLE + FORCE on all 23 tenant tables.** 16 use literal `FORCE ROW LEVEL SECURITY`; the other 7 (`businesses, store_settings, business_users, customer_businesses, auth_sessions, payments, manual_takings`) are forced in a `format()` loop in `000004_rls_app_role.up.sql`. Verified set-equality of ENABLE vs FORCE — **no ENABLE-without-FORCE table exists**.
- **Fail-closed policy:** `USING (current_setting('xtiitch.bypass',true)='on' OR business_id = NULLIF(current_setting('xtiitch.current_business_id',true),'')::uuid)` with a matching `WITH CHECK` (blocks cross-tenant inserts/updates too). A query that sets neither scope nor bypass matches zero rows rather than leaking — `000004_rls_app_role.up.sql`.
- **Scope helper is parameterised and transaction-local:** `set_config('xtiitch.current_business_id', $1, true)` — `apps/api/internal/adapters/outbound/postgres/tenant.go:12-15`. `setTenantBypass`/`clearTenantBypass` are documented for the "handful of legitimately cross-tenant credential lookups only" and narrow back to a scope before writing: `tenant.go:21-39`.
- **Authenticated tenant scope comes from the token,** never a client claim: `middleware.go:21-23`, and it flows into `principal.TenantScope()` on every handler.
- **Handles/IDs can't span tenants:** public checkout resolves a design by its (unguessable) handle then explicitly rejects a cross-tenant match — `checkoutapp/service.go:606-609, 885-887` (`if design.Design.BusinessID != businessID { return ErrDesignUnavailable }`).
- **Customer endpoints are keyed to the token's customer id, never a path/body id** (no IDOR): `customerauth/handler.go:143-207`.

**Per-query missing-scope sweep (did myself):** Enumerated every repository method under `adapters/outbound/postgres` that runs a query in a transaction; after accounting for both the `setTenantScope`/`setTenantBypass` helpers **and** inline `set_config('xtiitch.…')` SQL (14 inline scope + 6 inline bypass), the only method that touches a table in a transaction without setting either is `AdminAuthRepository.ReplaceAdminRolePermissions` — and its table (`admin_role_permissions`) is a **global admin table with no `business_id`/RLS policy**, gated at the app layer by `PermissionManageRoles`. Direct `pool.Query`/`QueryRow` calls outside a scoped tx hit only genuinely-global tables (`customers`, `plans`, `marketing_waitlist`, `admin_*`) — e.g. `order_repository.go:35` `FindCustomerIDByPhone` (customers are platform-wide by design) and `business_identity_repository.go:319` handle-uniqueness/`plans`. **No cross-tenant leak / IDOR found.** `setTenantBypass` usage is concentrated in `admin_auth_repository.go` (49 — RBAC-gated platform console) and identity/customer/webhook credential lookups (login-by-handle, refresh-by-hash, webhook-by-reference), all legitimate.

No findings.

### 5. Payments / webhooks / amount tampering — Solid

**Controls:**
- **Webhook signature is HMAC-SHA512 over the raw body, hex, constant-time**, and **rejects empty secret or empty signature**: `apps/api/internal/adapters/outbound/paystack/signature.go:18-28`. The handler reads the raw body via `LimitReader` and passes it un-re-serialised so the HMAC matches: `payments/handler.go:272-291`.
- **Idempotency / replay-proof:** confirmation inserts an event row `on conflict (provider, event_signature) do nothing`; a re-delivery is a no-op that returns `AlreadyProcessed`: `postgres/payment_repository.go:64-124` (`recordProviderEvent`). Dedup signature = `paystack:<event>:<reference>` — `signature.go:56`.
- **⭐ No client-supplied amount on public checkout.** Every guest flow re-prices server-side: `resolvePricedDesign`/`priceForBand` read the design's listed band price from the DB, deposits come from `money.ResolveDeposit`, delivery fee from the resolved zone (`zone.FeeMinor`), cart total is summed server-side: `checkoutapp/service.go:198, 598-624, 477, 496, 927`. A tampered cart/price cannot underpay. Promotion discounts are validated (`0 < discount < subtotal`) and commission is recomputed server-side: `service.go:1084-1107, 1183-1207`.
- **Commission computed server-side**; the only override path is bounded to `[0, amount]`: `payments/service.go:125-131`. The authenticated `/payments/checkout` endpoint *does* accept an `amount_minor` (`payments/handler.go:59-64`), but that is a **merchant charging their own customer** (gated by the money-management role, scoped to their own subaccount) — commission scales with it, so there is no platform-underpay incentive.
- **Subscription first-charge is idempotent** via a deterministic per-period ref + a paid-invoice guard: `auth/service.go:383-429`.
- **Offline/manual takings are correctly fee-free** (commission applies only to Paystack rails): `payments/service.go:220-262`.

**Finding:**
- **L1 (Low) — webhook confirmation does not cross-check the paid amount.** `HandleProviderEvent` forwards only `Succeeded`/type/reference to `ConfirmFromProvider`; the event's `data.amount` (parsed at `signature.go:55`) is never compared to the recorded payment's `amount_minor`: `payments/service.go:177-194`, `payment_repository.go` `applyConfirmation`. Because Paystack fixes the amount at initialise-time and a valid signature is required, a customer cannot pay less through the normal flow — this is defense-in-depth only. *Fix:* assert `event.AmountMinor == payment.amountMinor` before marking succeeded, and log/quarantine mismatches.

### 6. Authorization / RBAC / mass-assignment — Solid

**Controls:**
- **Protected routes sit behind the authenticator.** Business handlers register mutating routes inside `router.Group{ protected.Use(handler.authenticator.Middleware) … }` (e.g. `catalogue/handler.go:42-65`, `payments/handler.go:44-52`). Only `/public/*` routes are unauthenticated by design (guest checkout, affiliate/referral, delivery zones, AI search) — `checkout/handler.go:38-42`, `growth/handler.go:36-39`.
- **Owner/admin actions are gated server-side, not just in the UI.** Owner transfer requires `ActorRole == Owner` **and** the literal confirmation phrase `"TRANSFER OWNER"`: `auth/service.go:848-866`. Business-user management requires owner/admin: `service.go:933-943`. Money management requires owner/admin: `payments/service.go:272-280`.
- **Admin console uses permission-based RBAC bound to the token.** Every admin handler passes `principal.Role` (from the verified admin token) into `ActorRole` (dozens of sites in `adminauth/handler.go`), and each service action calls `authorizePermission(ctx, role, <Permission>)` which loads the role→permission set and denies with `ErrForbidden` otherwise: `adminauth/service.go:4546-4571`. Verification decisions require `PermissionReviewBusinesses` (`service.go:1048-1060`); subscriptions/plans/promotions/ads/admin-users each require their own permission.
- **Mass-assignment defended:** every JSON decoder uses `DisallowUnknownFields()` + a single-object guard + a `LimitReader`: `payments/handler.go:306-319`, `customerauth/handler.go:254-265`, `aisearch/handler.go:162-173` (pattern repeated across handlers).

No findings.

### 7. Injection — Solid

Delegated a full SQL-injection sweep of `adapters/outbound/postgres` and `db/`: **every query is parameterised with `$1,$2,…` (pgx)**; there is **no user input concatenated/`fmt.Sprintf`'d into SQL**. Dynamic fragments (any `format(%I …)` in migrations, and the handful of Go-side dynamic bits) use only whitelisted constants/enums — e.g. pagination limits are clamped integers bound as parameters, sort/filter inputs map to fixed column whitelists, not raw strings. No dynamic table/column name is taken from request input. No findings.

### 8. Secrets handling — Solid in git, Weak on local disk

**Positive (verified):** `.gitignore` covers `.env`, `*.env`, `credentials.txt`, `*.credentials.txt`, `prod.credentials.txt`, and the confidential PDFs (`.gitignore:1-40`). `git ls-files` confirms **none** of `credentials.txt`, `prod.credentials.txt`, `production.env`, `.env`, `.env.sonar.local` is tracked. A full-history scan (`git grep` across all revs) found **no** real secret ever committed — only the test placeholder `sk_live_example` in `app_test.go` and `sk_test_`/`sk_live_` *prefix string checks* in `scripts/paystack-smoke.mjs`. No secrets in client bundles (see §9). This is exactly right.

**Finding:**
- **M1 (Medium) — live production secrets sit in plaintext in the working tree.** `production.env`, `.env`, `credentials.txt`, `prod.credentials.txt` (all untracked) contain real values for `JWT_SIGNING_KEY`, `MFA_ENCRYPTION_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`, `CLOUDINARY_URL`, `DATABASE_URL`, `ADMIN_BOOTSTRAP_PASSWORD`, etc. (confirmed by key inspection; values not reproduced here). **This is the single most realistic "break-in" for a capable AI agent or anyone with filesystem read access to this directory: it bypasses every code-level control above by reading the keys directly** (forge any JWT, decrypt any TOTP secret, forge Paystack webhooks, connect to prod DB). Git hygiene is good, but non-git distribution (a tarball, a backup, a shared drive, an agent sandbox) leaks everything. *Fix:* do not keep live prod secrets in the repo working tree at all — source them from the secret manager (Render already uses `generateValue`/`sync:false`), and if a local copy must exist, keep it outside the repo and rotate the currently-on-disk keys since they have been sitting in a working directory.

### 9. Transport / CORS / headers — Adequate (API solid; frontends thin)

**Controls (from delegated frontend + API sweep):**
- **CORS is an explicit allow-list, not a wildcard**, and credentials are not combined with `*`. Prod origins are `https://xtiitch.com,https://*.xtiitch.com` (go-chi one-label wildcard): `render.yaml`, `platform/config/config.go:90-93`.
- **API sets a full security-header suite** including a strict CSP and HSTS on API responses (router `SecurityOptions`, `Production` flag from `bootstrap/app.go:286-291`).
- **Session cookies are httpOnly + Secure(prod) + SameSite + signed**; tokens are **not** kept in `localStorage` (so XSS cannot read the session) — confirmed in the SSR apps.

**Findings:**
- **M5 (Medium) — frontend SSR apps fall back to a hardcoded dev `SESSION_SECRET` with no production boot guard.** If an app is deployed without the env var set, the cookie-signing secret is a known constant → forgeable session cookies. The API has an equivalent guard (`validateProductionConfig`); the frontends do not. *Fix:* fail startup when `NODE_ENV=production` and `SESSION_SECRET` is unset/default.
- **M6 (Medium) — no Content-Security-Policy on storefront/dashboard/admin.** Increases XSS blast radius (session theft is mitigated by httpOnly cookies, but CSRF-adjacent and data-exfil risks remain). *Fix:* add a CSP (and `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`) to the frontend responses.
- **L3 (Low) — no in-app HSTS on the frontends** (API sets it). *Fix:* set `Strict-Transport-Security` at the frontend edge/app.

### 10. Rate limiting / DoS — Adequate

**Controls:** global token-bucket limiter (~100 rps/burst 200 per client, `RATE_LIMIT_RPS` config `config.go:94`); JSON bodies capped by `LimitReader` (~1–2 MiB) everywhere + `DisallowUnknownFields`; pagination limits clamped; **cart lines capped at 50** (`checkoutapp/service.go:36, 359`).

**Findings:**
- **M2 (Medium) — the rate-limit key is spoofable.** The limiter keys on the client IP after `middleware.RealIP` rewrites it from `X-Forwarded-For`/`X-Real-IP` with no trusted-proxy allow-list, so a client can rotate the header to get a fresh bucket per request and defeat the limiter. This also amplifies M3/M4. *Fix:* only honour forwarded-for from known proxy IPs (or use the platform's real connecting IP), and rate-limit auth/OTP endpoints on a key the client can't rotate.
- **M3 (Medium) — no per-account lockout on password login.** `LoginBusiness` equalises timing and relies on bcrypt cost + the (bypassable) global limiter, but has no failed-attempt counter/lockout: `auth/service.go:476-530`. Combined with M2, online password brute-force is feasible. *Fix:* add per-account/per-IP failed-login backoff + lockout (mirroring the MFA and reset lockouts that already exist).

### 11. Media upload (Cloudinary) — Adequate

**Controls (from delegated sweep):** uploads are **signed server-side** with the Cloudinary secret (not unsigned), the signing endpoint is **behind the authenticator and tenant-scoped**, and there is **no SSRF** (the server does not fetch a user-supplied URL). The dev store issues unsigned signatures but is fenced off in production by `validateProductionConfig` (`bootstrap/app.go:482-484`).

**Finding:**
- **M7 (Medium) — the upload signature covers only `timestamp`+`folder`; no file-type or size restriction is enforced.** An authenticated owner/admin can upload arbitrary file types/sizes to the account's Cloudinary. Impact is limited (requires a valid business session, and it's the merchant's own asset space), so this is quota/cost abuse and malicious-file-hosting rather than a tenant break. *Fix:* include `allowed_formats`/`resource_type`/max-size constraints in the signed params and validate server-side.

### 12. Inbound WhatsApp webhook — Solid

**Controls:** POST verifies `X-Hub-Signature-256` = HMAC-SHA256 of the raw body with the app secret, constant-time (`hmac.Equal`): `apps/api/internal/adapters/inbound/http/whatsapp/handler.go:91-109`. Body is `LimitReader`-bounded; inbound is deduped. `validateProductionConfig` requires `WHATSAPP_APP_SECRET` whenever the bot is enabled (`bootstrap/app.go:493-495`).

**Findings:**
- **L2 (Low) — signature check fails OPEN when `appSecret` is empty** (`handler.go:95-97` returns `true`). Prod-gated by the config guard, but if the bot were enabled without a secret (or `APP_ENV≠production`), forged inbound POSTs would be processed. *Fix:* fail closed (reject) when no secret is configured while the route is mounted.
- **I1 (Info) — GET verify-token comparison is non-constant-time** (`token != handler.verifyToken`, `handler.go:52`). Low-value token; a timing side-channel is largely theoretical. *Fix:* `hmac.Equal`/`subtle.ConstantTimeCompare`.

### Cross-cutting

- **L6 (Low) — the API's entire production hardening is gated on `APP_ENV=="production"`.** `validateProductionConfig` (`bootstrap/app.go:462-501`) is excellent — it refuses to boot with the default JWT key, missing MFA key, dev Paystack/Cloudinary, `sslmode=disable`, or an unsigned WhatsApp bot — **but only when the env string matches exactly.** A deploy with `APP_ENV` unset/misspelt silently runs with forgeable JWTs and fake payment confirmations. `render.yaml` does set `APP_ENV=production`, so this is a config-discipline risk. *Fix:* default to the hardened posture unless `APP_ENV` is explicitly a known dev value (fail-safe rather than fail-open).
- **I2 (Info) — AI-search reuses the JWT signing key as a fingerprint salt** (`aisearch/handler.go:32-38,131`). It's one-way (SHA-256) and never leaves the server, so impact is negligible, but cross-purpose key reuse is poor hygiene. *Fix:* a dedicated salt env var.

---

### Overall verdict — "Could a skilled attacker or capable AI get in easily?"

**No, not through the code.** The paths an attacker would actually try are closed:

- **Forge a session** → HS256 pinned + strong generated prod key + boot guard rejects the default. Not without the key.
- **Read another tenant's data / IDOR** → non-superuser DB role with `NOBYPASSRLS`, FORCE RLS on all 23 tenant tables, fail-closed policy, no missing-scope query, request ids constrained by RLS or token. Not without the DB credential.
- **Underpay** → public checkout re-prices entirely server-side; no client amount is trusted. Not through tampering.
- **Fake a payment confirmation** → HMAC-SHA512 required, empty-secret rejected, idempotent. Not without the webhook secret.
- **Bypass MFA** → OTP does not skip the second factor; challenge tokens are typ-scoped; TOTP has a replay guard and lockout. Not by design.
- **SQL injection / privilege escalation / mass-assignment** → parameterised queries, server-side RBAC bound to the token, `DisallowUnknownFields`. No foothold.

**The realistic ways in are operational, not cryptographic:** (1) the live production secrets sitting in plaintext in the working tree (M1) — the path of least resistance for a filesystem-capable agent, which bypasses everything above; (2) a misconfigured `APP_ENV` turning off the hardening (L6); (3) abuse/DoS via the spoofable rate-limit key + no login lockout + uncapped OTP sends (M2/M3/M4). None of these is a direct data-theft or underpay defect in the code — they are handling/configuration and anti-abuse gaps.

### Prioritised remediation

1. **M1 — Get live prod secrets out of the working tree and rotate the on-disk keys.** Highest real-world impact; they defeat every code control if read.
2. **M2 — Fix the spoofable rate-limit key** (trusted-proxy allow-list) and **M3 — add password-login lockout/backoff.** Together they close online brute-force.
3. **M4 — Add per-recipient OTP send cooldowns** (WhatsApp/SMS/email cost + bombing).
4. **M5 — Add a production boot guard for the frontends' `SESSION_SECRET`** (mirror the API's `validateProductionConfig`).
5. **M6 — Add CSP (+ related headers) to storefront/dashboard/admin.**
6. **M7 — Constrain Cloudinary signed uploads** (type/size/resource_type).
7. **L6 — Make the API hardening fail-safe** rather than fail-open on `APP_ENV`.
8. **L1 — Cross-check the webhook paid amount; L2 — fail closed on missing WhatsApp secret; L3 — frontend HSTS; L4 — bcrypt cost 12; L5 — refresh-reuse detection.**
9. **I1/I2/I3 — constant-time verify-token compare; dedicated fingerprint salt; consider shorter/revocable customer tokens.**
