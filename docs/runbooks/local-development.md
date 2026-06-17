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

For a local admin operator account in addition to the owner bootstrap account,
set `ADMIN_BOOTSTRAP_EXTRA_USERS_JSON` before starting the API:

```sh
ADMIN_BOOTSTRAP_EXTRA_USERS_JSON='[{"email":"operator@xtiitch.com","display_name":"Xtiitch Operator","password":"AdminPass123!","role":"operator"}]'
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

To exercise a live provider-compatible path, use the HTTP transport:

```sh
DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5432/xtiitch?sslmode=disable \
NOTIFICATION_TRANSPORT=http \
NOTIFICATION_HTTP_URL=https://provider.example/messages \
NOTIFICATION_HTTP_AUTH_HEADER=Authorization \
NOTIFICATION_HTTP_AUTH_VALUE="Bearer <token>" \
pnpm dev:worker
```

The HTTP transport renders lifecycle templates for order, booking, balance, and handover messages,
then posts JSON containing `message_id`, `business_id`, `channel`, `kind`, `recipient`, `from`,
rendered `text`, and the original outbox `payload`. Non-2xx responses are treated as send failures
and go through the same retry/dead-letter policy. On success, provider responses are stored in
`outbound_messages.provider_response`; common id fields (`provider_message_id`, `message_id`, `id`)
are also copied to `provider_message_id`.

## Health Checks

```sh
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```
