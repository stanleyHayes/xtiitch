# Xtiitch — Architecture Guide

> Read this to understand the whole system: what each part does, how the parts
> talk to each other, and where to find the code for any given concern. If you
> are new to the repo, read §1–§4 top to bottom; after that use §9 ("Where do I
> find…") as an index.
>
> Companion docs: [FEATURES.md](FEATURES.md) (what the product does),
> [agent_plan.md](agent_plan.md) (status & roadmap).

Last updated: 2026-06-20.

---

## 1. The big picture

Xtiitch is a **multi-tenant SaaS** for fashion businesses in Ghana. One Go API
backs five front-end surfaces and a background worker, all in a single pnpm +
Turbo monorepo. PostgreSQL is the system of record; row-level security keeps
tenants isolated. Paystack moves money directly between customers and businesses
— **the platform never holds funds**.

```
                         ┌───────────────────────────────────────────┐
   Customers ───────────▶│  apps/storefront   (<shop>.xtiitch.com)   │
                         │  apps/mobile (customer lane)              │
                         └───────────────┬───────────────────────────┘
   Businesses ──────────▶ apps/dashboard │  apps/mobile (business lane)
   Public ──────────────▶ apps/marketing │
   Operators ───────────▶ apps/admin     │
                                         ▼
                         ┌───────────────────────────────────────────┐
                         │  apps/api  (Go, chi)   all routes under /v1│
                         │  hexagonal: domain / application / adapters│
                         └───┬───────────────┬───────────────┬───────┘
                             │               │               │
                   PostgreSQL (RLS)      Paystack         Cloudinary
                             │           Resend (email)   Expo (push)
                             ▼               ▲
                     infra/migrations    apps/worker  ◀── outbox table
                     (Goose)             (BullMQ: billing + notifications)
```

---

## 2. Monorepo layout

```
xtiitch/
├── apps/
│   ├── api/         Go REST API — the single backend (chi, pgx, JWT)
│   ├── marketing/   Public site               (React Router v7 + MUI, SSR)
│   ├── storefront/  Per-shop customer store    (React Router v7 + MUI, SSR)
│   ├── dashboard/   Business owner/staff app    (React Router v7 + MUI, SSR)
│   ├── admin/       Platform operator console   (React Router v7 + MUI, SSR)
│   ├── mobile/      Expo / React Native (customer + business lanes)
│   └── worker/      TypeScript + BullMQ background jobs
├── packages/
│   ├── api-client/    Typed API client used by the web apps
│   ├── design-tokens/ Shared MUI theme tokens (brand palette, type)
│   ├── schemas/       Shared Zod schemas
│   ├── contracts/     Cross-package contract tests
│   └── config/        Shared config
├── infra/migrations/  Plain-SQL Goose migrations (numbered 000001…)
├── scripts/           Local tooling, incl. seed-demo*.sql
└── docs/              ADRs and design notes
```

Tooling: **pnpm** workspaces + **Turbo** for task orchestration. `pnpm run check`
runs typecheck/tests across every app (Go `go test/vet`, web `react-router
typegen && tsc`, worker/mobile `tsx --test`).

---

## 3. The API (`apps/api`) — hexagonal architecture

The API follows **ports & adapters (hexagonal)**. Dependencies point inward:
adapters depend on the application layer, which depends on the domain. The domain
depends on nothing.

```
internal/
├── domain/        Pure business types & rules. No I/O, no framework.
│   ├── auth/        sessions, credential errors
│   ├── business/    business, user roles, plan FEATURES.go (entitlements)
│   ├── catalogue/   designs, collections, size bands, pricing
│   ├── order/       order lifecycle, flows, size modes, stages, colours
│   ├── booking/     appointments & availability
│   ├── delivery/    handovers (pickup/delivery)
│   ├── money/       payment, commission, deposit value types
│   ├── customer/    end-customer identity
│   ├── notification/message entities
│   ├── admin/       admin roles & 13 granular permissions
│   └── common/      ID (UUID), TenantScope, Money
│
├── application/   Use-case services. Orchestrate domain + ports. One pkg/area.
│   ├── auth/ adminauth/ catalogue/ order/ checkout/ booking/ availability/
│   │   measurement/ delivery/ payments/ growth/ notification/
│   └── ports/     ← THE INTERFACES. Repositories, token issuers, payment
│                    provider, media store, email/push senders, clock, ids.
│
└── adapters/
    ├── inbound/http/   chi handlers — one package per route group. Each turns
    │                   HTTP ⇄ application commands. Mounts under /v1 (router.go).
    │                   security.go = headers, rate-limit, CORS, body cap, timeout.
    └── outbound/       Implementations of the ports:
        ├── postgres/   pgx repositories, hand-written tenant-scoped SQL + RLS
        ├── paystack/   payment provider (authorization_url, subaccounts, webhook)
        ├── cloudinary/ signed direct-upload
        ├── email/      Resend sender
        ├── expo/       push sender
        └── auth/       bcrypt, JWT issue/verify, refresh-token hashing
```

Wiring happens in **`internal/bootstrap/app.go`**: it loads config, builds the
pgx pool, constructs every adapter, injects them into the application services,
and registers the HTTP handlers. `internal/platform/config/config.go` reads all
env vars. Start: `cmd/api`.

### Request lifecycle (business request)
1. Request hits `chi` router (`router.go`), passes `security.go` middleware.
2. For protected routes, `auth/middleware.go` verifies the bearer JWT and builds
   a `Principal{BusinessID, UserID, Role}` placed on the context. **The tenant is
   derived from the verified token, never from a client field.**
3. The handler decodes JSON into an application **command** and calls the service.
4. The service runs domain logic and calls **ports** (interfaces) — it never sees
   SQL or HTTP.
5. The postgres adapter opens a transaction, sets the tenant scope
   (`select set_config('xtiitch.current_business_id', …)`), runs the query under
   RLS, and returns domain types.
6. The handler maps the result (or a typed domain error) to an HTTP response.

---

## 4. Data & multi-tenancy

- **PostgreSQL** is the system of record. Access is via **pgx/v5**; repositories
  in `adapters/outbound/postgres` hold hand-written SQL (there is an `sqlc.yaml`
  and `db/query` for query tooling). Money is always **integer minor units**
  (pesewas); IDs are UUIDs.
- **Row-level security (RLS)** is the tenancy backbone. Tenant-scoped tables carry
  `business_id` and an RLS policy of the form `bypass = 'on' OR business_id =
  current_setting('xtiitch.current_business_id')`. Every tenant query runs inside
  a transaction that first sets that setting (`tenant.go`: `setTenantScope`).
  A handful of inherently cross-tenant lookups (login by handle, refresh by token
  hash, webhook by provider ref) use `setTenantBypass` and then immediately narrow
  to one tenant. A query that sets neither **fails closed**.
- **Migrations** live in `infra/migrations/` as plain up/down SQL, run with
  **Goose** (`pnpm --filter @xtiitch/api migrate:up`). They are numbered
  `000001…`; the demo Postgres has no migration tracker, so apply by hand with
  `docker exec -i xtiitch-demo-pg psql -U xtiitch -d xtiitch < <file>`.
- **The app connects as a non-superuser role** (`xtiitch_app`) so RLS is enforced;
  migrations run separately as the owner.

---

## 5. Authentication & authorization

- **Business auth** (`application/auth`, `adapters/outbound/auth`): bcrypt password
  check → a short-lived **JWT access token** (15 min, `typ:"access"`) plus an
  opaque **refresh token** (30 days, stored only as a SHA-256 hash in
  `auth_sessions`). Refresh **rotates** — using a refresh token revokes it and
  issues a new pair, so a stolen token is single-use.
- **Admin auth** is a parallel system (`admin_users` / `admin_sessions`) with its
  own token scope (`typ:"admin_access"`, `scope:"admin"`) and 13 granular
  permissions. Business and admin tokens are not interchangeable.
- **Roles**: business users are `owner` / `admin` / `staff`; the dashboard gates
  team management and owner transfer accordingly.

---

## 6. Payments & the money model

`adapters/outbound/paystack` + `application/payments`.

- **Onboarding**: a business verifies a settlement account → the API creates a
  Paystack **subaccount**; its reference is stored on the business.
- **Charging**: checkout calls Paystack `transaction/initialize` with the
  business's subaccount and a `transaction_charge` (Xtiitch commission), then
  redirects the customer to Paystack's **`authorization_url`** (hosted page; card
  details never reach Xtiitch). The public key is not used client-side.
- **Settlement**: Paystack pays the business's subaccount directly. **Xtiitch
  never holds funds** and there is no wallet/escrow.
- **Webhooks**: `POST /v1/webhooks/paystack` is **HMAC-SHA512 verified over the
  raw body** using the Paystack secret key, and is **idempotent** — a re-delivered
  event is recorded once and is otherwise a no-op.
- **Commission** is per-plan basis points; the money summary separates
  through-platform income, commission, and manually-logged offline takings.

---

## 7. Background work (`apps/worker`)

A TypeScript **BullMQ** worker handles anything that must not block a request or
must retry reliably:
- **`billing.ts`** — subscription billing cycles, invoice generation, recurring
  charge sweeps.
- **`outbox.ts` + `senders.ts`** — the **outbox pattern**: the API writes
  notifications to a DB table inside the same transaction as the change; the
  worker polls, batches by channel, and sends via **Resend** (email) / **Expo**
  (push), marking delivered and retrying on failure.

---

## 8. The front-end surfaces

All four web apps share a stack: **React Router v7 (framework mode, SSR)** +
**MUI v9** + **Emotion**, with a shared **dark/light theme** (`theme.ts` +
`theme-mode.tsx` per app; tokens in `packages/design-tokens`). Brand: Wine /
Cream / Ink palette, Inter Tight type, the ii-stitch mark.

| App | Key routes | Notes |
|---|---|---|
| **marketing** | `/`, `/features`, `/pricing`, `/how-it-works`, `/growth`, `/discover`, `/shops`, `/designs`, `/privacy`, `/terms`, `/security`, `/payment-policy`, `/faq`, `/contact` | SSR; Ghana-aligned legal pages |
| **storefront** | `/` (shop), `/design`, `/collection`, `/track` | Multi-tenant by subdomain; public, mostly unauthenticated |
| **dashboard** | `/login`, `/dashboard` | The business cockpit: orders table, catalogue, money, settings, billing, team, branding |
| **admin** | `/login`, `/admin` | Operator console; URL-addressable sections via `?section=` |

Front-end gotchas worth knowing (they have bitten us):
- **No top-level `process.env` in client-bundled modules** — it crashes hydration
  ("process is not defined") and the page silently won't become interactive.
  Guard with `typeof process !== "undefined" ? process.env.X : undefined`.
- **Route loading** uses a thin top progress bar shown only on
  `navigation.state === "loading"` (not on every form submit).
- The linter strips unused imports — add the consuming component before its import.

**Mobile** (`apps/mobile`, Expo Router) has two lanes from one binary: a
**customer lane** (discover, store, design, track) and a **business lane** (login,
orders kanban, order detail, new walk-in order, record measurements).

---

## 9. Where do I find…？

| I want to… | Look in |
|---|---|
| Add/observe an HTTP endpoint | `apps/api/internal/adapters/inbound/http/<area>/handler.go`, mounted in `router.go` |
| Change business logic for a feature | `apps/api/internal/application/<area>/service.go` |
| Add a repository method / new query | define the interface in `application/ports/ports.go`, implement in `adapters/outbound/postgres` |
| Change tenant isolation / RLS | `adapters/outbound/postgres/tenant.go` + the table's migration policy |
| Add a config / env var | `internal/platform/config/config.go` (+ `.env.example`) |
| Add a DB table/column | new `infra/migrations/0000NN_*.{up,down}.sql` (Goose) |
| Change plan features / entitlements | `apps/api/internal/domain/business/features.go` + `apps/admin` plan editor + `migrations/000038` |
| Touch payments | `adapters/outbound/paystack` + `application/payments` |
| Send email/push or add a job | `apps/worker/src/*` + the outbox write in the API |
| Edit the brand theme | `packages/design-tokens` + each app's `app/theme.ts` |
| Wire a new adapter into the app | `apps/api/internal/bootstrap/app.go` |
| Seed local demo data / logins | `scripts/seed-demo-full.sql` → `credentials.txt` |
| Run the API locally | demo stack on Docker; API on `:8085`, all routes under `/v1` |

---

## 10. Local development quick start

```sh
pnpm install
# Demo Postgres + Redis run in Docker (xtiitch-demo-pg on :5450).
# Apply migrations (demo DB has no tracker — apply by hand or use goose):
docker exec -i xtiitch-demo-pg psql -U xtiitch -d xtiitch < infra/migrations/000001_foundation.up.sql   # …etc
# Seed rich demo data + logins:
docker exec -i xtiitch-demo-pg psql -U xtiitch -d xtiitch < scripts/seed-demo-full.sql
# Run everything:
pnpm dev            # turbo runs the web apps + watches
# API on :8085, marketing :3000, storefront/dashboard :3100/:3101, admin :3403.
pnpm run check      # typecheck + tests across the monorepo
```

Demo logins are in `credentials.txt` (git-ignored). Never commit secrets — `.env`
is git-ignored and holds the only real keys.
