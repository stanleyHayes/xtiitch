# Xtiitch

Xtiitch is the operating system for Ghanaian fashion businesses: a per-business storefront, dashboard, payments flow, customer tracking view, and mobile-first operating layer.

Read these first:

- [agent_plan.md](agent_plan.md)
- [docs/design/style-guide.md](docs/design/style-guide.md)
- [docs/quality/sonarqube.md](docs/quality/sonarqube.md)
- [docs/compliance/ghana-compliance.md](docs/compliance/ghana-compliance.md)
- [docs/architecture/scalability.md](docs/architecture/scalability.md)
- [docs/marketing/marketing-site-plan.md](docs/marketing/marketing-site-plan.md)
- `Xtiitch-Product-Definition.pdf`
- `Xtiitch-Technical-Specification.pdf`

The PDF documents are the product and technical source of truth. The agent plan is the live implementation ledger and must be updated by every feature commit.

## Stack

- Monorepo: pnpm workspaces.
- Backend: Go, hexagonal architecture, direct SQL on PostgreSQL, custom JWT.
- API contracts: REST first, with room for GraphQL read models and gRPC internal contracts.
- Marketing web: React Router framework mode and MUI.
- Product web: React Router framework mode, MUI, React Hook Form, Zod.
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
