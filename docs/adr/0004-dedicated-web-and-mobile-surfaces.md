# ADR 0004: Dedicated Web And Mobile Surfaces

Status: Accepted

Date: 2026-06-18

## Context

Xtiitch needs public marketing, per-business storefronts, business operations, platform admin tooling and later mobile apps. The stack pressure is that MUI and React Router are excellent for dense web dashboards and SSR storefront pages, while Expo and React Native are native-first and should not inherit web-only layout assumptions.

The product also has strict audience boundaries:

- Customers browse and track orders.
- Business owners, admins and staff run operations.
- Platform admins manage the whole service.
- Marketing converts businesses before signup.

Combining these into one web app or trying to force a single shared UI stack across web and native would blur permissions, routing, deployment and interaction patterns.

## Decision

Use dedicated deployable surfaces:

- `apps/marketing`: React Router and MUI public marketing site.
- `apps/storefront`: React Router and MUI customer storefront for business subdomains.
- `apps/dashboard`: React Router and MUI business operations dashboard.
- `apps/admin`: React Router and MUI platform operator console.
- Future customer mobile app: Expo and React Native, native-first.
- Future business mobile app: Expo and React Native, native-first.

Share contracts, schemas, design tokens, copy rules and safe feature logic across surfaces. Do not share web-only components with native apps. Do not merge customer, business and admin routing into one application shell.

## Consequences

- Each audience gets its own navigation, density, auth and deployment boundary.
- Web apps can use MUI and React Router deeply without constraining mobile.
- Mobile apps can use native navigation, sheets, permissions and push flows when they are built.
- Shared packages must stay platform-neutral: contracts, schemas, tokens and domain-safe helpers only.
- Cross-surface features must still go through the same Go API and tenant-safe authorization rules.
