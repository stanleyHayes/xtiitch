# ADR 0003: REST-First V1 Client Contracts

Status: Accepted

Date: 2026-06-18

## Context

Xtiitch now has four web surfaces moving at different speeds: marketing, storefront, business dashboard and admin. The backend already exposes REST endpoints for customer storefront flows, protected business operations, platform-admin operations, Paystack webhooks and worker-facing jobs. The open question was whether v1 client screens need GraphQL now, or whether GraphQL should wait until REST read models prove too expensive to compose.

The v1 risk is not a lack of query flexibility. The higher-risk areas are tenant isolation, operator permissions, money movement, payment reconciliation, checkout attribution, subscription billing and audit evidence. Adding GraphQL before those flows are stable would create another authorization and contract surface to harden.

## Decision

V1 remains REST-first for all shipped client screens and commands.

REST owns:

- Public storefront catalogue, checkout, custom requests, referrals, affiliate attribution and order tracking.
- Protected business dashboard operations.
- Platform-admin user, role, business, customer, money, subscription, growth, support, audit, reporting, export and launch-readiness workflows.
- Webhook and worker integration points.

GraphQL is not required for v1 launch. It may be introduced later only as a read-model layer when a specific screen needs composed data that would otherwise require repeated REST round trips or brittle client-side joining.

If GraphQL is introduced later, it must:

- Be read-only at first.
- Call application services or dedicated query services instead of bypassing business rules.
- Enforce the same tenant, role and permission checks as REST.
- Avoid owning mutations, payment logic, entitlement logic or audit behavior.
- Ship with contract tests and schema documentation under `packages/contracts/graphql`.

## Consequences

- The launch surface is smaller and easier to verify.
- Frontend teams can keep using the existing server-side REST clients without waiting for schema generation.
- Admin and dashboard screens should receive richer REST read models when they need composed views.
- GraphQL remains available as a deliberate read-model upgrade after REST is stable, not as a parallel v1 API.
