# Xtiitch — Feature Catalogue

> _Fashion, in good order._
>
> Xtiitch is a multi-tenant operating system for fashion businesses in Ghana:
> tailors, designers and boutiques run their whole shop — storefront, orders,
> measurements, payments and growth — from one place, while customers discover
> shops and track their pieces.
>
> This document is the single source of truth for **what the product does**. It
> is organised by who uses each feature. For _how the system is built_, see
> [architecture.md](architecture.md). For _what is built vs. planned_, see
> [agent_plan.md](agent_plan.md).

Last updated: 2026-06-20.

---

## 1. Who uses Xtiitch

| Surface | App | Who | Where |
|---|---|---|---|
| **Marketing site** | `apps/marketing` | The public, prospective businesses | xtiitch.com |
| **Storefront** | `apps/storefront` | Shoppers / customers | `<shop>.xtiitch.com` |
| **Business dashboard** | `apps/dashboard` | Shop owners, admins, staff | app.xtiitch.com |
| **Admin console** | `apps/admin` | Xtiitch platform operators | admin.xtiitch.com |
| **Mobile app** | `apps/mobile` | Customers _and_ shop staff (two lanes) | iOS / Android |
| **API** | `apps/api` | All of the above | api.xtiitch.com (`/v1`) |

The money principle that shapes everything: **Xtiitch never holds funds.** Every
customer payment settles directly into the business's own Paystack subaccount;
the platform only takes a transparent commission at the point of charge.

---

## 2. Customer features (Storefront + Mobile customer lane)

### Discovery
- **Shop directory** — browse every verified, active shop on the platform.
- **Storefront** — each shop has its own branded store at `<handle>.xtiitch.com`
  with its designs, collections and story.
- **Collections** — designs grouped by theme/season.
- **Design detail** — image gallery, description, price by size, and (where the
  shop allows) customisation.
- **In-store search** — search a shop's designs by title/description.
- **Sponsored placements** — paid featured shops and designs surface in
  discovery (clearly an upgrade, see §5).

### Buying
- **Standard orders** — pick a size band and order a ready-made piece.
- **Bespoke / custom orders** with three measurement routes:
  - **Self-measure** — fill in the shop's measurement fields at checkout.
  - **Home visit** — book an appointment for the tailor to measure you.
  - **Come to shop** — arrange to be measured in person.
- **Deposits & balances** — pay a deposit online to confirm a bespoke order, the
  balance later once the piece is ready.
- **Hosted, secure payment** — checkout is a Paystack-hosted page (card or mobile
  money); card details never touch Xtiitch.
- **Promo codes** — apply discount codes at checkout (fixed or percentage, with
  spend/usage rules).
- **Referrals** — arrive via a referral code and unlock the configured reward.

### After buying
- **Order tracking** — a public tracking link shows the order's stage with a
  simple red → yellow → green colour so customers always know where their piece
  is, no login required.
- **Design waitlist** — if a piece isn't available, join its waitlist and get
  told when the shop reopens it (a paid feature for the shop — see §5).
- **Delivery or pickup** — receive the finished piece by delivery or collect it,
  with status tracking.
- **Notifications** — order, payment and appointment updates by email and push.

---

## 3. Business features (Dashboard + Mobile business lane)

### Storefront management
- **Catalogue** — create collections and designs, upload images (direct to
  Cloudinary, never through our servers), set status (active/retired).
- **Pricing** — price each design per size band; set a deposit for bespoke work.
- **Size bands** — define the fit options customers choose from.
- **Storefront customisation** (plan-gated, see §5): brand accent colour, custom
  logo, custom hero banner, and layout variant (standard / spotlight / minimal).
- **Store settings** — toggle the capabilities a shop offers: bespoke,
  measurements, customisation, collections, delivery, dispatch.

### Orders & production
- **Order intake** — orders arrive from the storefront, or staff create walk-in
  orders directly.
- **Kanban stages** — each shop defines its own production stages per flow
  (ready-made vs bespoke); orders advance stage by stage.
- **Order lifecycle** — draft → awaiting deposit → confirmed → fulfilled (or
  cancelled), with a clean orders table, row actions and a detail drawer.
- **Measurements** — define custom measurement fields; capture self-measure
  submissions or record measurements during a home visit/shop visit.
- **Agreed total & balance** — set the final price for bespoke work and collect
  the outstanding balance online.

### Appointments & fulfilment
- **Availability windows** — publish the slots you offer for home visits.
- **Bookings** — manage, reschedule and cancel measurement appointments.
- **Handovers** — arrange pickup or delivery, advance to dispatched/completed.

### Money
- **Through-platform income** — every online payment, settled to your own
  subaccount, with the platform commission shown transparently.
- **Manual takings** — log cash / offline sales so your books are complete.
- **Money summary** — through-platform total, commission, manual takings and net
  income at a glance.
- **Payment history** — every charge with its status and reference.

### Team & account
- **Team members** — invite owner / admin / staff users with role-based access.
- **Owner transfer** — hand ownership to another admin with an explicit
  confirmation step.
- **Self-service billing** — see all plans, your current subscription and switch
  plan or billing cycle (monthly / yearly) yourself.

### Growth (for the business)
- **Promotions** — create discount codes scoped to all products, a collection or
  a single design, with spend minimums, caps and usage limits.
- **Design waitlists** — capture demand for sold-out / pre-release pieces.

---

## 4. Platform / Admin features (Admin console)

- **Business verification** — review and approve/reject shops (KYC-style gate
  before a shop can take money).
- **Business status** — activate, suspend or deactivate shops.
- **Plans & packages** — create and edit plans, set monthly/yearly pricing,
  commission (basis points), design limits, and toggle each feature entitlement.
- **Subscriptions** — issue invoices, mark paid/failed, and run recurring billing
  sweeps; MRR and revenue overview.
- **Promotions** — platform-wide, cross-shop discount campaigns.
- **Sponsored ads** — create and price featured placements; track impressions and
  clicks; inline create form inside the ads section.
- **Affiliates** — affiliate codes, click tracking, conversion attribution and
  payout batches.
- **Referrals** — referral programmes and reward execution.
- **Risk & money controls** — flag businesses for review and hold settlements.
- **Support tickets** — manage business/customer support cases.
- **Audit log** — every operator action is recorded (who, what, when).
- **Directory data** — businesses and customers as scannable MUI tables.

---

## 5. Plans & feature entitlements

Plans live in the database (`plans` table) and are fully editable by admins. The
feature gate is the plan's `features` JSON; the business's chosen customisation is
only honoured when its plan grants the matching feature.

| Feature code | Free | Standard | Growth |
|---|:---:|:---:|:---:|
| Storefront, catalogue, orders, payments | ✅ | ✅ | ✅ |
| `custom_brand_color` (accent colour) | — | ✅ | ✅ |
| `custom_logo` | — | — | ✅ |
| `custom_banner` | — | — | ✅ |
| `custom_layout` (spotlight / minimal) | — | — | ✅ |
| `design_waitlist` | — | — | ✅ |
| Pricing | Free | ₵50/mo · ₵600/yr | ₵120/mo · ₵1,440/yr |

> Pricing reflects the seeded demo plans (minor units in the DB: standard
> 5000/60000, growth 12000/144000 pesewas). Admins can re-map any feature to any
> plan at any time — the table above is the seeded default, not a hard rule.

Commission (per-transaction basis points) and `design_limit` are also per-plan and
admin-controlled.

---

## 6. Cross-cutting platform qualities

- **Multi-tenant isolation** — PostgreSQL row-level security forces every
  tenant-scoped query to a single business; a shop can never see another's data.
- **Security hardening** — security headers (CSP, HSTS, frame/content-type),
  per-IP rate limiting, request size limits and timeouts, strict CORS allow-list.
- **Auth** — bcrypt passwords, short-lived JWT access tokens with rotating
  refresh tokens; admin auth is a separate token scope.
- **Webhooks** — Paystack webhooks are HMAC-verified over the raw body and are
  idempotent (a re-delivered event is a no-op).
- **Reliable notifications** — an outbox + background worker delivers email
  (Resend) and push (Expo) without blocking requests.
- **Ghana compliance** — privacy policy and terms aligned to the Data Protection
  Act (Act 843) and Electronic Transactions Act (Act 772).
- **Light & dark mode** across every web surface.

---

## 7. Feature → code map (quick reference)

| Feature area | API (Go) | Web |
|---|---|---|
| Auth & team | `internal/.../http/auth`, `application/auth` | `dashboard` login/settings |
| Catalogue & storefront | `http/catalogue`, `application/catalogue` | `storefront`, `dashboard` |
| Orders & stages | `http/order`, `application/order` | `dashboard` orders table |
| Checkout (customer) | `http/checkout` | `storefront` design/checkout |
| Measurements | `http/measurement` | `dashboard`, `storefront` |
| Bookings & availability | `http/booking`, `http/availability` | `dashboard`, `storefront` |
| Delivery / handover | `http/delivery` | `dashboard` |
| Payments & money | `http/payments`, `application/payments` | `dashboard` money |
| Growth (ads/affiliate/referral) | `http/growth`, `application/adminauth` | `admin`, `marketing/growth` |
| Plans & entitlements | `domain/business/features.go` | `admin` plan editor |
| Admin console | `http/adminauth`, `application/adminauth` | `admin` |
| Notifications | `http/notification` + `apps/worker` | all |

See [architecture.md](architecture.md) for the full layout and request flows.
