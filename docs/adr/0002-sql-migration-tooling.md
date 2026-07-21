# ADR 0002: SQL Migration Tooling

Status: Amended (2026-07-21)

Date: 2026-06-14

## Context

Xtiitch uses direct SQL with PostgreSQL. Migrations need to stay plain, reviewable, and easy to run locally and in deployment.

## Decision

Use golang-migrate for SQL migrations. Keep migration files under `infra/migrations`, and expose migration commands through `@xtiitch/api` package scripts. The scripts run `github.com/golang-migrate/migrate/v4/cmd/migrate@latest` (with the `postgres` build tag) so migration tooling stays current without adding the CLI's dependency graph to the API application module.

Migration files are split `.up.sql` / `.down.sql` pairs — the golang-migrate format — which is also what the deploy path uses (`render.yaml` installs the same CLI and runs `migrate -path ../../infra/migrations -database "$DATABASE_URL" up` on API boot).

## Amendment (2026-07-21): Goose → golang-migrate

This ADR originally selected Goose, but the migration files were written in golang-migrate's split `.up.sql` / `.down.sql` layout, which Goose v3 cannot parse (it panics with "duplicate version N" — every pair registers two migrations at the same version). The deploy pipeline had already switched to golang-migrate (`232f609`), leaving the local `migrate:*` scripts broken. The amendment aligns local tooling, deploy tooling, and the file format on golang-migrate. Command mapping: `migrate:up` → `up`, `migrate:status` → `version`, `migrate:down` → `down 1` (single-step; golang-migrate's bare `down` rolls back everything).

## Consequences

- Migration files remain direct SQL.
- Agents can run migrations through pnpm without memorizing flags.
- The API module remains lean and testable.
- Migration runs depend on network/toolchain availability unless a later tools module or pinned binary cache is introduced.
- golang-migrate tracks state in a `schema_migrations` table; `down` requires interactive confirmation, which suits local use.
