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
pnpm dev:worker
```

## Health Checks

```sh
curl http://localhost:8080/healthz
curl http://localhost:8080/readyz
```

