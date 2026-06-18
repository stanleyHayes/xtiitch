# ADR 0001: Architecture And Stack

Status: Accepted

Date: 2026-06-14

## Context

Xtiitch v1 is a multi-tenant platform for fashion businesses. It requires strict tenant isolation, direct-settlement payments through Paystack, web and mobile client surfaces, background notifications, and a path to a future cross-business general store.

## Decision

Use a pnpm monorepo with:

- Go backend using hexagonal architecture.
- PostgreSQL with direct SQL and migration files.
- REST as the primary client API, with GraphQL read models and gRPC internal contracts introduced only when they create clear value.
- Custom JWT auth.
- Dedicated React Router/MUI web app.
- Dedicated Expo/React Native mobile app.
- BullMQ and Redis worker app for background jobs.
- Cloudinary, Resend, Expo Notifications, and Paystack adapters behind application ports.

ADR 0004 records the frontend split in more detail: React Router/MUI for dedicated web surfaces, Expo/React Native for future native apps, and shared packages limited to platform-neutral contracts, schemas, tokens and helpers.

## Consequences

- The backend can protect tenant and money rules centrally.
- Client stacks stay idiomatic for their targets while sharing contracts, schemas, and design tokens.
- Direct SQL keeps tenant filters and money queries explicit.
- Go and Node both exist in the system because the API is Go while BullMQ is Node-based; queue boundaries must stay narrow and documented.
