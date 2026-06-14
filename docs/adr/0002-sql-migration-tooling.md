# ADR 0002: SQL Migration Tooling

Status: Accepted

Date: 2026-06-14

## Context

Xtiitch uses direct SQL with PostgreSQL. Migrations need to stay plain, reviewable, and easy to run locally and in deployment.

## Decision

Use Goose for SQL migrations. Keep migration files under `infra/migrations`, and expose migration commands through `@xtiitch/api` package scripts. The scripts run `github.com/pressly/goose/v3/cmd/goose@latest` so migration tooling stays current without adding Goose's broad CLI dependency graph to the API application module.

## Consequences

- Migration files remain direct SQL.
- Agents can run migrations through pnpm without memorizing flags.
- The API module remains lean and testable.
- Migration runs depend on network/toolchain availability unless a later tools module or pinned binary cache is introduced.
