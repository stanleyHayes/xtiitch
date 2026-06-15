# Xtiitch Agent Plan

Last updated: 2026-06-15 08:33 GMT

This document is the build guide and living work ledger for Xtiitch. Every agent working in this repository must read this file before making changes, update the status sections as work moves, and leave the repo in a verifiable state after each feature.

## Source Documents

- `Xtiitch-Product-Definition.pdf`
- `Xtiitch-Technical-Specification.pdf`

The PDFs are the product and technical source of truth. This plan records implementation decisions, working conventions, and progress. If this plan conflicts with the PDFs, stop and reconcile the conflict before coding.

## Current Work

- No active marketing feature is in progress after the business workflow section redesign.
- Next recommended feature: review and finish the separate auth-session refresh/logout/middleware work that is currently open in the worktree, then commit it as its own API slice.
- Push of local commits is pending until the project owner adds a Git remote.

## Completed

- Reviewed the root product definition and technical specification.
- Confirmed v1 scope: per-business platform, not the phase-two general store.
- Confirmed selected stack and libraries from the project owner.
- Confirmed initial brand colors:
  - Main brand: `#800020`
  - Primary type: `#15111a`
  - Warm background: `#faf6f2`
- Created the initial `agent_plan.md` from the product and technical specification.
- Captured the selected stack, architecture, dependency-injection strategy, milestone sequence, and agent workflow.
- Initialized Git in the project folder.
- Created the first local commit: `docs: add xtiitch agent build plan`.
- Added the requirement for a public marketing website as a first-class app.
- Added design, quality, compliance, scalability, and marketing planning docs.
- Added strict linting and SonarQube quality-gate planning.
- Scaffolded the pnpm monorepo with `apps/api`, `apps/marketing`, `apps/web`, `apps/mobile`, `apps/worker`, and shared packages.
- Added exact current npm package versions for the scaffolded JavaScript/TypeScript packages.
- Added Go API shell using Chi, hexagonal folders, constructor DI, health routes, config, logging, domain primitives, and application ports.
- Added SQL migration baseline for plans, businesses, store settings, business users, global customers, tenant-scoped customer relationships, indexes, and RLS policies.
- Chose Goose for SQL migrations through `go run github.com/pressly/goose/v3/cmd/goose@latest`.
- Added Docker Compose for local PostgreSQL and Redis.
- Added design tokens package with the Xtiitch color palette and starter scale.
- Added BullMQ worker shell.
- Added GitHub Actions check workflow with conditional SonarQube scan.
- Verified `pnpm check`, `pnpm test`, and direct Go coverage tests pass locally.
- Created local foundation commit: `chore: initialize xtiitch monorepo foundation`.
- Added business auth and tenant onboarding application service with constructor-injected ports.
- Added bcrypt password hashing, HS256 custom JWT issuing, random refresh-token generation, and hashed refresh-session persistence.
- Added business owner registration and business login HTTP endpoints under `/v1/auth/business`.
- Added tenant-aware Postgres repositories for business identity creation, credential lookup, and auth-session storage.
- Added `auth_sessions` migration with tenant RLS policy and indexes.
- Added Auth API documentation and auth-boundary notes in the tenant isolation guide.
- Added API tests for registration/login use cases, HTTP auth handlers, request decoding, and JWT claims.
- Added a bounded API race coverage command with `-timeout=45s` so CI and local quality gates fail loudly instead of hanging.
- Verified `pnpm check` and `pnpm test` pass locally after the auth slice.
- Completed the public marketing website shell with React Router SSR, MUI theme, navigation, footer, SEO metadata, sitemap, favicon, and Vercel-ready build scripts.
- Added a polished image-led home hero using the Xtiitch brand palette and a generated Ghanaian fashion atelier asset saved under `apps/marketing/public/images`.
- Added marketing pages for Home, Features, How it works, Pricing, For customers, Security, FAQ, Contact, Privacy, and Terms.
- Added a product-preview band showing the storefront/dashboard/order workflow without claiming unsupported features beyond the v1 scope.
- Added waitlist lead capture with server-side Zod validation, consent checkbox, anti-spam honeypot, webhook or Resend delivery support, and honest no-sink error behavior.
- Added marketing waitlist tests with Node test runner through `tsx`.
- Fixed marketing SSR so responses emit a single `<!DOCTYPE html>`.
- Verified the marketing route returns `200`, waitlist no-sink behavior is explicit, and desktop screenshot captures show the first viewport and next band.
- Verified `pnpm check`, `pnpm test`, and `pnpm --filter @xtiitch/marketing build` pass locally after the marketing slice.
- Redesigned the home page `What businesses get` section so it no longer squeezes a dashboard mock into the layout; it now presents an editorial atelier image, business workflow steps, storefront/order/customer signals, and customer-facing status chips.
- Verified the redesigned marketing section in desktop and mobile Chrome screenshots.
- Redesigned the shared marketing navbar and footer with stronger brand presence, active navigation states, a polished mobile drawer, footer proof points, route groups, and a footer CTA panel.
- Verified the redesigned navbar, mobile drawer, desktop footer, and mobile footer in Chrome screenshots.

## Opened / Pending

- No remote is configured yet. Pushes must wait until the project owner adds the remote.
- Resolve one stack tension before frontend implementation: MUI and React Router are web-first, while Expo/React Native is native-first. The working resolution below is dedicated web plus dedicated mobile, sharing contracts, schemas, design tokens, and feature logic.
- Decide exact subscription-billing mechanics in Paystack: recurring authorization, invoice/payment-link billing, manual fallback, or a combination.
- Define refund and cancellation policy before live payments.
- Confirm whether GraphQL is required for v1 client screens or should start as a documented/read-model surface after REST is stable.
- Current latest Expo package graph has a peer warning: Expo 56 expects `react-native-worklets` `^0.7.4 || ^0.8.0`, while latest Reanimated pulls the 0.9 line. Keep visible until Expo or Reanimated aligns, or deliberately switch to Expo-compatible package versions.
- SonarQube scan is configured but not executed locally because `SONAR_HOST_URL` and `SONAR_TOKEN` are not configured yet.
- Non-API app tests are placeholder scripts until their app shells and first real flows are implemented.
- Add Postgres integration tests for auth repositories, migrations, and RLS tenant isolation before auth is considered production-ready.
- Configure either `MARKETING_WAITLIST_WEBHOOK_URL` or `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `MARKETING_WAITLIST_EMAIL_TO` before public waitlist launch.
- Final privacy, terms, refund, cancellation, subscription renewal, and chargeback language must receive legal review before public launch.
- React Router build emits v8 future-flag warnings. Keep visible until the team deliberately opts into the v8 behavior changes.
- Auth-session refresh/logout/middleware changes are open in the worktree and should be reviewed, documented, and committed separately from the marketing slice.

## Product Boundary

Build version one only:

- Public marketing website for acquisition, pricing, product education, trust, and business signup/waitlist conversion.
- Per-business online storefront.
- Business dashboard.
- Global customer identity with tenant-scoped relationships and orders.
- Catalogue, collections, designs, images, sizes, measurements, customisation, delivery, bookings, order stages, tracking, notifications, payments, subscriptions, money tracker, walk-in logging, and analytics.
- Paystack checkout, payment links, subaccounts/splits, and webhook confirmation.

Do not build in v1:

- General cross-business marketplace.
- POS and inventory.
- Escrow, wallet, pooled balance, or platform-held funds.
- Full accounting, invoicing, expenses, or profit-and-loss.
- Lending, insights products, or group services.
- Cross-tenant browse/search except the explicitly deferred phase-two read path.

## Selected Stack

### Monorepo

- Package manager: `pnpm`.
- Monorepo tooling: Turborepo or plain `pnpm` workspaces at first; add Turborepo once multiple apps need cached pipelines.
- Package version policy: use exact latest stable package versions when added. If latest creates a known peer/platform conflict, prefer the latest compatible stable version and record the exception here.
- Suggested root layout:

```text
apps/
  api/                 Go backend
  marketing/           Public acquisition site with React Router and MUI
  web/                 React Router framework app with MUI
  mobile/              Expo + React Native + Expo Router
  worker/              Node.js BullMQ workers
packages/
  contracts/           OpenAPI, GraphQL schema, protobuf, generated clients
  design-tokens/       Brand colors, typography scale, spacing, radii
  schemas/             Shared TypeScript Zod schemas where useful
  api-client/          Generated/handwritten REST and GraphQL clients
  config/              Shared lint, tsconfig, formatting presets
infra/
  docker/              Local Postgres, Redis, supporting services
  migrations/          SQL migrations
  render/              Backend deployment notes/config
  vercel/              Frontend deployment notes/config
docs/
  adr/                 Architecture decision records
  api/                 Contract docs
  architecture/        Scalability and system design guidance
  compliance/          Ghana legal/compliance engineering checklist
  design/              Style and design guide
  marketing/           Public website plan and messaging strategy
  quality/             SonarQube and quality-gate guidance
  runbooks/            Operational docs
  security/            Threat model, tenant isolation notes
scripts/
```

### Frontend

- Marketing web: React Router framework mode, MUI, shared design tokens, Vercel deployment.
- Product web: React Router framework mode, MUI, React Hook Form, Zod.
- Mobile: Expo, React Native, Expo Router, Expo Notifications.
- Shared: API clients, Zod schemas where practical, design tokens, constants, feature copy, validation rules that are safe to share.
- Important: all business rules still live behind the backend contract. Clients validate for user experience only.

### Backend

- Language: Go.
- HTTP framework: prefer `chi` or `gin`; choose `chi` if simplicity and standard-library feel matter more, `gin` if middleware/ecosystem speed matters more.
- REST: primary public/client command and resource API.
- GraphQL: optional client query/read-model surface, implemented with `gqlgen` only when it reduces frontend query sprawl. It must call application services and must not own business rules.
- gRPC: internal service contract for background services and future service extraction. Start with protobuf contracts in `packages/contracts/proto`; expose gRPC only where it creates real value.
- Database: PostgreSQL.
- SQL: direct SQL using SQL migrations plus `pgx`/`pgxpool`; use `sqlc` for type-safe generated Go access while keeping SQL files explicit and reviewable.
- Migrations: Goose via `go run github.com/pressly/goose/v3/cmd/goose@latest`.
- Auth: custom JWT with refresh-token/session records.
- Dependency injection: constructor injection by default; use Google Wire if wiring grows large enough to justify compile-time generation. Avoid hidden service locators.
- Background jobs: BullMQ + Redis in a Node worker app. The Go API should publish jobs through a narrow queue port/adapter or an internal worker bridge.
- Payments: Paystack subaccounts, splits, payment links, mobile money, cards, and verified webhooks.
- Media: Cloudinary.
- Email: Resend.
- Push: Expo Notifications.
- Hosting: Render for backend services; Vercel for web frontend. Mobile ships through Expo/EAS.

### Brand Tokens

Use these tokens from the beginning:

```ts
export const xtiitchColors = {
  burgundy: "#800020",
  ink: "#15111a",
  cream: "#faf6f2",
};
```

Frontend UI should feel warm, professional, and operational. This is a fashion-business operating system, not a generic SaaS landing page. The dashboard should be efficient and calm; storefronts should let each business brand itself while still feeling trustworthy.

## Architecture Standard

Use hexagonal architecture. The domain and application layers must not import adapters.

### Backend Layers

```text
cmd/api/                    Process entrypoint
internal/bootstrap/         Config, DI wiring, server startup
internal/domain/            Entities, value objects, invariants, domain errors
internal/application/       Use cases, commands, queries, ports
internal/adapters/inbound/  HTTP REST, GraphQL, gRPC, webhook handlers
internal/adapters/outbound/ Postgres, Paystack, Cloudinary, Redis/BullMQ bridge, Resend, Expo Push
internal/platform/          Logging, tracing, config, clock, ids, transactions
```

### Dependency Direction

- `domain` imports nothing project-specific.
- `application` imports `domain` and defines ports/interfaces.
- `inbound adapters` translate transport input into application commands/queries.
- `outbound adapters` implement application ports.
- `bootstrap` wires concrete adapters into application services.
- Tests can use in-memory or fake port implementations.

### Required Ports

Define narrow ports before adapters:

- `TenantAuthorizer`
- `BusinessRepository`
- `CustomerRepository`
- `CatalogueRepository`
- `OrderRepository`
- `PaymentRepository`
- `LedgerRepository`
- `BookingRepository`
- `NotificationRepository`
- `AnalyticsRepository`
- `TransactionManager`
- `PasswordHasher`
- `TokenIssuer`
- `IDGenerator`
- `Clock`
- `PaymentProvider`
- `MediaStore`
- `EmailSender`
- `PushSender`
- `JobQueue`

Ports should be use-case-shaped, not generic database wrappers.

## Tenant Isolation Recommendation

Use defense in depth:

- Every tenant-scoped table has `business_id`.
- Every repository method for tenant-scoped data requires a server-derived tenant scope argument.
- Every tenant-scoped SQL query filters by `business_id`.
- PostgreSQL Row Level Security should be enabled for tenant-scoped tables once the migration baseline exists.
- Database sessions/transactions set the current tenant context before touching tenant-scoped rows.
- Public storefront scope comes from resolved store handle, not from client authority.
- Direct-reference reads outside scope return not found.
- Client-facing IDs must be non-sequential and unguessable.
- Cache keys and job payloads include tenant scope.
- Tests must include deliberate cross-tenant access attempts for every critical repository/use case.

This is one of the highest-risk parts of the system. Treat a tenant leak as a release-blocking defect.

## Domain Model Guide

Start with these aggregates and entities:

- Business: tenant root, store handle, verification status, settlement data, plan, default deposit.
- Store settings: toggles for bespoke, measurements, customisation, collections, delivery, dispatch, branding.
- Business user: owner/admin/staff, bound to one business.
- Customer: global identity.
- Customer-business relationship: tenant-scoped visibility of a customer through orders.
- Collection: optional themed catalogue grouping.
- Design: catalogue item, order type, status, images, pricing, deposit override, customisation options.
- Measurement field and size band: business-defined sizing.
- Design pricing by band.
- Order: standard/custom lifecycle, stage status, payment state, delivery, booking, measurements.
- Measurement: tenant-scoped measurement values for a customer/order.
- Availability and booking: home-visit slots and state.
- Stage template and stage event.
- Delivery zone.
- Plan: global subscription package.
- Payment: provider payment, split, commission, status, idempotency.
- Manual taking: off-platform cash/direct mobile money record.
- Notification.
- Analytics event.

Represent money as exact minor units in GHS pesewas. Never use floats for money. Store timestamps in UTC and render in the business local time.

## API Contract Strategy

### REST

REST is the primary v1 contract for clients:

- `/auth`
- `/businesses`
- `/store-settings`
- `/catalogue`
- `/public/stores/{handle}`
- `/orders`
- `/measurements`
- `/bookings`
- `/payments`
- `/money-tracker`
- `/notifications`
- `/analytics`
- `/subscriptions`
- `/webhooks/paystack`

Document REST with OpenAPI. Generate TypeScript clients where possible.

### GraphQL

GraphQL may expose composed read models for dashboard and storefront screens:

- No business rules.
- No mutation until there is a clear benefit over REST commands.
- Must enforce the same tenant scope and pagination rules.
- Must not introduce cross-tenant reads in v1.

### gRPC

Use protobuf contracts for internal boundaries:

- Notification dispatch.
- Job processing.
- Payment reconciliation.
- Future service extraction.

Do not split the backend into many deployable services early just because gRPC exists. Keep the deployable shape simple until there is pressure to separate.

## Security And Data Protection

- Card data never touches Xtiitch. Paystack owns card collection.
- Store settlement and identity details encrypted/protected at rest.
- JWT access tokens are short-lived.
- Refresh tokens are stored as hashed session records and can be revoked.
- Use role checks for owner/admin/staff actions.
- Avoid exposing global customer data to businesses except through tenant-scoped orders.
- Webhooks must verify Paystack signatures.
- Money and state-changing endpoints require idempotency keys where retries are possible.
- Audit money-state changes, verification changes, order-stage changes, role changes, and settlement changes.

## Testing Standard

Coverage must focus on critical behavior:

- Tenant isolation and direct-reference protection.
- Auth, role authorization, JWT expiry/refresh/revocation.
- Paystack webhook verification and idempotency.
- Payment split/commission calculations.
- Deposit rules and GHS minor-unit arithmetic.
- Order state machine transitions.
- Booking slot concurrency.
- Subscription package changes and billing events.
- Notification enqueueing and failure isolation.
- Public storefront visibility rules.
- Repository integration tests against Postgres.
- End-to-end smoke flows for the main journeys.

Minimum practical test stack:

- Go unit tests for domain/application.
- Go integration tests with test Postgres/Redis.
- Contract tests for REST/OpenAPI and webhook payloads.
- Frontend component/form tests for critical flows.
- Playwright smoke tests for web once screens exist.
- Expo/manual smoke checklist for mobile until automated mobile E2E is added.
- Marketing pages must include responsive checks, accessibility checks, SEO metadata checks, and claim/compliance review before launch.

## Milestone Plan

### Milestone 0: Repository Foundation

Done when:

- Monorepo is initialized.
- Git is initialized.
- Root README, agent plan, editor config, formatting, linting, basic CI scripts, Docker Compose, and environment templates exist.
- Design tokens package contains the Xtiitch palette.
- Architecture, quality, design, compliance, marketing, and ADR docs exist.

Suggested commit:

```text
chore: initialize xtiitch monorepo foundation
```

### Milestone 0.5: Marketing Website

Scope:

- Public marketing app in `apps/marketing`.
- Home, features, how it works, pricing, customer education, trust/security, FAQ, and contact/waitlist pages.
- Messaging grounded in the product docs and Ghanaian fashion-business reality.
- SEO metadata and Open Graph basics.
- Lead capture path that can later connect to onboarding.
- Clear compliance-safe claims about payments, privacy, refunds, and subscriptions.

Done when:

- A fashion business owner can understand the product and join/request access from the first visit.
- Customers can understand why an Xtiitch tracking/payment link is trustworthy.
- Pricing and package information are clear.
- The site passes responsive, accessibility, lint, test, and SonarQube checks.

Suggested commit:

```text
feat(marketing): add public acquisition website
```

### Milestone 1: Backend Foundation And Money Rails

Scope:

- Go API skeleton with hexagonal folders.
- DI bootstrap.
- Config, logger, error model, request IDs.
- PostgreSQL migrations.
- Auth and custom JWT.
- Business onboarding.
- Tenant isolation baseline.
- Paystack subaccount provisioning.
- Paystack split payment test flow.
- Webhook verification and idempotency.

Done when:

- A verified business can receive a test payment through Paystack with the platform commission split.
- Webhook confirmation advances the correct payment/order record exactly once.
- Deliberate cross-tenant reads/writes fail.

Suggested commit:

```text
feat(api): add tenant foundation and paystack money rails
```

### Milestone 2: Catalogue And Storefront

Scope:

- Business store settings.
- Collections.
- Designs.
- Cloudinary uploads.
- Size bands and design pricing.
- Public storefront by handle.
- Shareable design and collection links.
- Single-tenant search.
- Web storefront screens.

Done when:

- A business can build a public store with images, designs, collections, size bands, and prices.
- Public visitors can browse without an account.
- Retired/deleted visibility rules hold.

Suggested commit:

```text
feat(catalogue): add tenant storefront and design management
```

### Milestone 3: Ordering, Stages, And Tracking

Scope:

- Standard order journey.
- Custom order journey.
- Measurement routes.
- Deposit rules.
- Stage templates and stage events.
- Customer light account.
- Customer tracking view.
- WhatsApp handoff for custom balance discussion.

Done when:

- Standard order pays in full and is confirmed.
- Custom measurement/customisation paths collect deposit when required.
- Come-to-shop measurement path skips deposit.
- Customer sees the simple red/yellow/green tracking state.

Suggested commit:

```text
feat(orders): implement order journeys and customer tracking
```

### Milestone 4: Money Tracker And Manual Takings

Scope:

- Automatic through-platform takings from succeeded payments.
- Manual cash/direct mobile-money takings.
- Daily, weekly, and monthly summaries.
- Split between Xtiitch payments and off-platform takings.

Done when:

- Business sees honest takings without treating it as full accounting.
- Commission applies only to through-platform payments.

Suggested commit:

```text
feat(ledger): add money tracker and manual takings
```

### Milestone 5: Bookings And Home-Visit Calendar

Scope:

- Weekly availability.
- Slot generation.
- Home-visit booking with deposit confirmation.
- Business reschedule/cancel.
- Slot reopening.
- Concurrency protection.

Done when:

- A home visit reserves a slot only after the correct payment path.
- Double booking is prevented.
- Customer cannot self-cancel paid visit; they can call the business.

Suggested commit:

```text
feat(bookings): add home visit calendar and slot controls
```

### Milestone 6: Delivery And Dispatch

Scope:

- Delivery zones.
- Fees.
- Dispatch settings.
- Pickup vs dispatch at checkout.
- Manual arrangement when no rate matches.

Done when:

- Matching zone adds the fee automatically.
- Pickup has no fee.
- Delivery never blocks order placement if manual arrangement is required.

Suggested commit:

```text
feat(delivery): add delivery zones and dispatch options
```

### Milestone 7: Notifications

Scope:

- BullMQ + Redis worker app.
- Resend email adapter.
- Expo Notifications adapter.
- Notification records and retry status.
- Events: new order, stage changed, order ready, booking booked/rescheduled/cancelled, payment link issued, balance paid.

Done when:

- Notification failures do not fail orders or payments.
- Both business and customer receive appropriate updates by push and/or email.

Suggested commit:

```text
feat(notifications): add async email and push delivery
```

### Milestone 8: Subscriptions And Packages

Scope:

- Global plan/package definitions.
- Free, Standard, and later Growth-style packages.
- Plan limits and commission rates.
- Paystack recurring/payment-link subscription billing.
- Subscription state, renewal, failure, grace period, and downgrade rules.

Done when:

- Business can choose and change packages.
- Plan limits are enforced.
- Subscription billing does not require Xtiitch to hold business funds.

Suggested commit:

```text
feat(billing): add subscription packages and billing lifecycle
```

### Milestone 9: Mobile App

Scope:

- Expo app shell.
- Auth.
- Business dashboard essentials.
- Customer storefront/order/tracking flow.
- Push notification registration.
- Poor-network states.

Done when:

- Android/iPhone users can browse, order, track, and receive push notifications.
- Business users can handle core dashboard actions from a phone.

Suggested commit:

```text
feat(mobile): add expo app for customers and businesses
```

### Milestone 10: Hardening And Closed Beta

Scope:

- Security review.
- Tenant-isolation audit.
- Webhook replay tests.
- Load testing of storefront/catalogue read paths.
- Observability.
- Operational runbooks.
- Closed beta seed data and onboarding scripts.

Done when:

- The app is deployable to Render/Vercel.
- Critical flows are tested.
- Beta businesses can be onboarded without engineering hand-holding.

Suggested commit:

```text
chore(release): harden xtiitch for closed beta
```

## Documentation Requirements

Maintain docs as part of each feature:

- Update this `agent_plan.md`.
- Add or update ADRs for architectural decisions.
- Update OpenAPI/protobuf/GraphQL schema docs when contracts change.
- Update setup docs when commands, environment variables, or services change.
- Add runbooks for payment, webhook, subscription, notification, and deployment operations.
- Document test data and seed flows.

## Agent Workflow

Every feature must follow this loop:

1. Read `agent_plan.md` and relevant source docs.
2. Update `Current Work` with the feature being started.
3. Move any stale items from `Current Work` to `Completed` or `Opened / Pending`.
4. Inspect the repo before editing.
5. Implement within the architecture boundaries.
6. Add or update tests for the critical behavior touched.
7. Run the relevant checks.
8. Update this plan with:
   - what was completed,
   - what remains open,
   - commands run,
   - any changed assumptions.
9. Commit with a clear feature commit message.
10. Push to the configured remote once the remote exists.

Do not skip the plan update. This file is the handoff surface for the next agent.

## Commit And Push Rules

- One feature, one focused commit where practical.
- Commit messages should use conventional style:
  - `feat(api): ...`
  - `feat(web): ...`
  - `feat(mobile): ...`
  - `feat(catalogue): ...`
  - `fix(payments): ...`
  - `test(tenant): ...`
  - `docs(architecture): ...`
  - `chore(repo): ...`
- Include generated files only when they are part of the source-controlled contract.
- Never commit secrets, `.env` files, local build output, or dependency caches.
- If no remote exists, make the local commit and record that push is pending.
- Once a remote exists, push after every completed feature.

## First Implementation Tasks

1. Add `.gitignore`, `README.md`, `.editorconfig`, package manager files, and workspace layout.
2. Add `docker-compose.yml` for local Postgres and Redis.
3. Add `apps/marketing`, `apps/web`, `apps/mobile`, and `apps/worker` package scaffolds.
4. Scaffold `apps/api` as a Go service with hexagonal folders and constructor DI.
5. Add SQL migration tooling and a first migration for global plans and businesses.
6. Add `packages/design-tokens` with Xtiitch colors.
7. Add architecture, design, compliance, marketing, quality, and ADR docs.
8. Add initial CI/check scripts.

## Commands Log

- `pdftotext -layout Xtiitch-Product-Definition.pdf -`
- `pdftotext -layout Xtiitch-Technical-Specification.pdf -`
- `rg --files`
- `git status --short --branch` failed because Git is not initialized.
- `git remote -v` failed because Git is not initialized.
- `git init`
- `git add agent_plan.md && git commit -m "docs: add xtiitch agent build plan"`
- `npm view ... version` for current package versions.
- `pnpm install`
- `go get github.com/go-chi/chi/v5@latest && go mod tidy`
- `go get github.com/pressly/goose/v3/cmd/goose@latest && go mod tidy` exposed a local Go toolchain coverage mismatch, so Goose was moved out of the API module and into `go run ...@latest` migration scripts.
- `pnpm check` passed.
- `pnpm test` passed.
- `go test -coverprofile=coverage.out ./...` passed from `apps/api`.
- `git commit -m "chore: initialize xtiitch monorepo foundation"`
- Web research for Ghana e-commerce, data protection, payments, cybersecurity, tax, and marketing context.
- `pnpm --filter @xtiitch/marketing check` passed after redesigning the home business workflow section.
- `pnpm --filter @xtiitch/marketing build` passed after redesigning the home business workflow section.
- `pnpm --filter @xtiitch/marketing test` passed after redesigning the home business workflow section.
- `pnpm lint` passed after redesigning the home business workflow section.
- `pnpm --filter @xtiitch/marketing check` passed after redesigning the shared marketing navbar and footer.
- `pnpm --filter @xtiitch/marketing build` passed after redesigning the shared marketing navbar and footer.
- `pnpm --filter @xtiitch/marketing test` passed after redesigning the shared marketing navbar and footer.
- `pnpm check` passed after redesigning the shared marketing navbar and footer.
