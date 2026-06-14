# SQL Migrations

Migrations are plain SQL and should stay reviewable.

Rules:

- Tenant-scoped tables include `business_id`.
- High-traffic tenant-scoped indexes should start with `business_id`.
- Money is stored as integer minor units.
- Client-facing IDs use UUIDs or another unguessable ID strategy.
- RLS policies should be added for tenant-scoped tables.
- Webhook and payment idempotency tables must have unique constraints when introduced.

Migration tooling: Goose through `go run github.com/pressly/goose/v3/cmd/goose@latest`. See `docs/adr/0002-sql-migration-tooling.md`.

Run from the repo root:

```sh
pnpm --filter @xtiitch/api migrate:up
pnpm --filter @xtiitch/api migrate:status
pnpm --filter @xtiitch/api migrate:down
```
