# SQL Migrations

Migrations are plain SQL and should stay reviewable.

Rules:

- Tenant-scoped tables include `business_id`.
- High-traffic tenant-scoped indexes should start with `business_id`.
- Money is stored as integer minor units.
- Client-facing IDs use UUIDs or another unguessable ID strategy.
- RLS policies should be added for tenant-scoped tables.
- Webhook and payment idempotency tables must have unique constraints when introduced.

Migration tooling: golang-migrate through `go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest`. The split `.up.sql` / `.down.sql` layout is the golang-migrate format — it is also the runner used at deploy time (`render.yaml`). See `docs/adr/0002-sql-migration-tooling.md` (amended).

Run from the repo root (requires `$DATABASE_URL`):

```sh
pnpm --filter @xtiitch/api migrate:up      # apply all pending
pnpm --filter @xtiitch/api migrate:status  # print the current version
pnpm --filter @xtiitch/api migrate:down    # roll back ONE migration
```
