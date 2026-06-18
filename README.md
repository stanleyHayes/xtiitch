# Xtiitch

Xtiitch is the operating system for Ghanaian fashion businesses: a per-business storefront, dashboard, payments flow, customer tracking view, and mobile-first operating layer.

Read these first:

- [agent_plan.md](agent_plan.md)
- [docs/design/style-guide.md](docs/design/style-guide.md)
- [docs/quality/sonarqube.md](docs/quality/sonarqube.md)
- [docs/compliance/ghana-compliance.md](docs/compliance/ghana-compliance.md)
- [docs/runbooks/launch-validation.md](docs/runbooks/launch-validation.md)
- [docs/architecture/scalability.md](docs/architecture/scalability.md)
- [docs/marketing/marketing-site-plan.md](docs/marketing/marketing-site-plan.md)
- `Xtiitch-Product-Definition.pdf`
- `Xtiitch-Technical-Specification.pdf`

The PDF documents are the product and technical source of truth. The agent plan is the live implementation ledger and must be updated by every feature commit.

## Product Surfaces

Xtiitch is intentionally split by audience:

- `apps/admin`: platform operator console for Xtiitch staff at `admin.xtiitch.com`.
- `apps/storefront`: customer-facing store for each business at `<handle>.xtiitch.com`, with transitional `/store/:handle` routes during development.
- `apps/dashboard`: business owner and staff workspace at `app.xtiitch.com`.
- `apps/marketing`: public acquisition website at `xtiitch.com`.
- `apps/api` and `apps/worker`: shared backend and background processing used by all product surfaces.
- `apps/mobile`: later mobile app placeholder.

## Stack

- Monorepo: pnpm workspaces.
- Backend: Go, hexagonal architecture, direct SQL on PostgreSQL, custom JWT.
- API contracts: REST first, with room for GraphQL read models and gRPC internal contracts.
- Marketing web: React Router framework mode and MUI.
- Product web surfaces: React Router framework mode, MUI, React Hook Form, Zod.
- Mobile: Expo, React Native, Expo Router, Expo Notifications.
- Worker: BullMQ and Redis for background jobs.
- Payments: Paystack with subaccounts, splits, payment links, and webhooks.
- Media: Cloudinary.
- Email: Resend.
- Hosting target: Render for backend, Vercel for web, Expo/EAS for mobile.

## Local Services

```sh
docker compose up -d postgres redis
```

Default local URLs are listed in [.env.example](.env.example).

For local admin login, run the API with the bootstrap variables from `.env.example`:
`ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `ADMIN_BOOTSTRAP_DISPLAY_NAME`, and `ADMIN_BOOTSTRAP_ROLE`.
To seed additional local operator accounts, set `ADMIN_BOOTSTRAP_EXTRA_USERS_JSON`, for example:

```sh
ADMIN_BOOTSTRAP_EXTRA_USERS_JSON='[{"email":"operator@xtiitch.com","display_name":"Xtiitch Operator","password":"AdminPass123!","role":"operator"}]'
```

## Common Commands

```sh
pnpm check
pnpm lint
pnpm test
pnpm sonar
pnpm dev:api
pnpm dev:worker
```

Run Go checks directly when working in the backend:

```sh
cd apps/api
go test ./...
go run ./cmd/api
```

Run the notification worker in dry-run mode while developing:

```sh
NOTIFICATION_TRANSPORT=log pnpm dev:worker
```

For live WhatsApp/SMS delivery, point the worker at an HTTPS-capable provider or
gateway endpoint:

```sh
NOTIFICATION_TRANSPORT=http \
NOTIFICATION_HTTP_URL=https://provider.example/messages \
NOTIFICATION_HTTP_AUTH_HEADER=Authorization \
NOTIFICATION_HTTP_AUTH_VALUE="Bearer <token>" \
pnpm dev:worker
```

The worker posts a JSON payload with `message_id`, `channel`, `kind`,
`recipient`, `from`, rendered `text`, and the original outbox `payload`. When
the provider response includes `provider_message_id`, `message_id`, or `id`,
the worker stores that value on the outbox row for support/audit follow-up.

## Architecture Rules

- Domain code must not import adapters.
- Application services depend on domain types and ports.
- Inbound adapters translate HTTP, GraphQL, gRPC, and webhook requests into application commands or queries.
- Outbound adapters implement ports for PostgreSQL, Paystack, Cloudinary, Redis/BullMQ, Resend, and Expo Push.
- Tenant scope must be server-derived, passed into tenant-scoped repository methods, and enforced in SQL.
- Payments must be webhook-confirmed and idempotent.
- Xtiitch must never hold customer or business funds.

## Git Notes

The repo is initialized locally. Pushes are pending until a remote is added.
