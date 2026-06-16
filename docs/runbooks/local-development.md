# Local Development Runbook

## Start Dependencies

```sh
docker compose up -d postgres redis
```

## Backend

```sh
cp .env.example .env
cd apps/api
go run ./cmd/api
```

## Worker

```sh
pnpm install
DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable \
NOTIFICATION_TRANSPORT=log \
pnpm dev:worker
```

The worker schedules `drain-notification-outbox` on the `xtiitch.outbox` BullMQ queue. It claims due
`outbound_messages` rows with the transport RLS bypass, marks dry-run sends as `sent`, and returns
failed messages to `pending` with exponential backoff until `OUTBOX_MAX_ATTEMPTS`, then `dead`.

## Health Checks

```sh
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```
