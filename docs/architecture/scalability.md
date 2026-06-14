# Scalability Guide

Xtiitch starts as one shared multi-tenant platform. It must be designed so many businesses and customers can join without forcing a rewrite.

## Core Scaling Principles

- Keep one shared data model across businesses.
- Make tenant-scoped access the default path.
- Page every list endpoint.
- Avoid unbounded dashboard queries.
- Keep write paths idempotent.
- Push slow or retryable work to queues.
- Cache only with tenant-aware keys.
- Add observability before guessing at bottlenecks.

## Database

PostgreSQL is the system of record.

Required practices:

- Every tenant-scoped table has `business_id`.
- High-traffic tenant-scoped tables need compound indexes that start with `business_id`.
- Public storefront lookups need indexes for `handle`, active catalogue status, collection membership, and search fields.
- Payment idempotency keys need unique indexes.
- Webhook event IDs need unique indexes.
- Booking slots need constraints that prevent double booking.
- Money columns use integer minor units.
- List queries use stable pagination.
- Large analytics queries should read pre-aggregated tables or materialized views once traffic demands it.

Avoid:

- Sequential client-facing IDs.
- Cross-tenant scans in v1.
- Dashboard queries that count everything live on every page load.
- N+1 query patterns in storefront, orders, and dashboard screens.

## Tenant Isolation At Scale

Defense in depth matters more as data grows:

- Repository methods require tenant scope.
- SQL filters by `business_id`.
- Row Level Security should be enabled for tenant-scoped tables.
- Background jobs carry tenant scope explicitly.
- Cache keys include `business_id`.
- Search indexes include tenant scope.
- Phase-two cross-tenant reads must use separate read paths and permissions.

## API

REST remains the command surface. Every endpoint should have:

- Request size limits.
- Pagination for lists.
- Idempotency keys for payment and money-state operations.
- Consistent error shapes.
- Rate limiting for auth, payment initialization, public search, and webhooks.
- Request IDs and structured logs.

GraphQL, if added, should be a read-model layer over application services. It must not bypass tenant scope or own business rules.

## Background Jobs

BullMQ and Redis handle retries and asynchronous work.

Use queues for:

- Notification dispatch.
- Email delivery.
- Push delivery.
- Payment reconciliation.
- Cloudinary cleanup tasks.
- Analytics rollups.

Job payloads must include:

- Tenant scope when tenant data is involved.
- Idempotency key or source event ID.
- Minimal personal data.

## Media

Cloudinary should protect the app from heavy image loads:

- Upload originals once.
- Serve transformed thumbnails and responsive sizes.
- Use consistent product image aspect ratios.
- Avoid loading full-size images in catalogue grids.
- Store public IDs and derived metadata, not raw image blobs.

## Caching

Cache later, not first. When introduced:

- Cache public storefront reads by `business_id` or store handle.
- Include locale, filters, and pagination cursor in cache keys.
- Invalidate on design, collection, price, and visibility changes.
- Never cache tenant-scoped dashboard data without tenant-aware keys.

## Observability

Before closed beta, add:

- Structured logs.
- Request IDs.
- Error tracking.
- Payment webhook metrics.
- Queue depth metrics.
- Slow query logging.
- Tenant-isolation failure alerts.
- Basic product analytics events.

## Deployment

Initial deployment can stay simple:

- API on Render.
- Worker on Render.
- PostgreSQL managed service.
- Redis managed service.
- Web on Vercel.
- Mobile through Expo/EAS.

Scale by pressure:

- Increase API replicas when request load grows.
- Scale workers by queue depth.
- Add read replicas only when read load justifies them.
- Add search infrastructure when PostgreSQL search becomes limiting.
- Do not split into microservices until operational pressure proves the boundary.

## Agent Rule

If a feature works for one business but would become unsafe, slow, or leaky with one thousand businesses, it is not done.

