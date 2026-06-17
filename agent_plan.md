# Xtiitch Agent Plan

Last updated: 2026-06-17 GMT

This document is the build guide and living work ledger for Xtiitch. Every agent working in this repository must read this file before making changes, update the status sections as work moves, and leave the repo in a verifiable state after each feature.

## Source Documents

- `Xtiitch-Product-Definition.pdf`
- `Xtiitch-Technical-Specification.pdf`

The PDFs are the product and technical source of truth. This plan records implementation decisions, working conventions, and progress. If this plan conflicts with the PDFs, stop and reconcile the conflict before coding.

## Current Product Surface Map

This is the intended product split. Keep new work aligned to these audience boundaries:

| Surface            | App                       | Audience                                       | Primary job                                                                                                                                           | Current state                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin dashboard    | `apps/admin`              | Xtiitch platform operators                     | Manage platform operators, roles, settings, business verification, money rails, risk/support, health, notifications, reports, exports, subscriptions, promotions, sponsored placements, and audit trail | Admin auth, operator user management, role/permission editing, profile, settings, notification preferences, audit log reads, business verification decisions, business suspension/reactivation, platform metrics, money-rails read/replay/hold controls, subscription lifecycle/read/update/invoice/sweep/downgrade controls, plan-package create/update/archive controls, promotion create/update/archive controls, sponsored placement create/update/archive controls, risk-review close/reopen controls, support queue assignment/resolution, and authenticated CSV exports are API-backed; health, notifications, and reports are derived from the loaded admin read models |
| Storefront         | `apps/storefront`         | Customers/clients shopping a specific business | Browse designs, choose standard orders, start customer requests, pay where applicable, and track order status                                         | Built over public catalogue/order APIs; standard checkout, bespoke/custom requests, collection browsing, and tracking exist                                                                                                                                                                                                                                                                                                           |
| Business dashboard | `apps/dashboard`          | Business owners, admins, and staff             | Receive customer requests/orders, manage catalogue, process production stages, handle money, visits, handovers, team, measurements, and notifications | Built and backed by protected business APIs, with role-aware owner/admin/staff views                                                                                                                                                                                                                                                                                                                                                  |
| Marketing          | `apps/marketing`          | Prospective businesses and public visitors     | Explain the product, pricing, trust posture, and capture waitlist/contact leads                                                                       | Built                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Backend/worker     | `apps/api`, `apps/worker` | Shared system layer                            | Tenant-safe API, payments, catalogue, orders, notifications, and background jobs                                                                      | Built in slices; admin auth/users/roles/settings/audit/business verification/business lifecycle/platform metrics/money-rails/subscription lifecycle/plan-package/promotion/risk-review/support controls are started; notification outbox has dry-run and HTTP provider transports; subscription dunning/grace-expiry sweeps run from admin and worker paths; extra local admin bootstrap users can be seeded through env JSON; production notification provider credentials are pending                                                                                                                                                  |
| Mobile             | `apps/mobile`             | Later customer/business mobile surfaces        | Native access mirroring the web split                                                                                                                 | Stub only                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Handoff — 2026-06-16 (read this first if you are picking up)

State of the backend and business dashboard (`apps/api`, Go hexagonal; `apps/dashboard`, React Router + MUI; money in integer pesewas; **Xtiitch never holds funds**). Latest feature commit on `main`: `efb0a64`. Recently shipped this session, each as one verified+committed slice:

- Money tracker (`bd025f3`): manual takings + income summary.
- Home-visit bookings (`20116f9`/`10c8178`) + booking management `GET/POST /v1/bookings…` cancel/reschedule (`92af171`).
- Fulfilment handovers — pickup/delivery, advance, cancel — `…/v1/handovers…`, migration `000011` (`50bf4cb`).
- Transactional notification outbox — `order_confirmed`/`order_fulfilled` enqueued in-tx; `GET /v1/notifications`; migration `000012` (`3190b8a`).
- More notification producers — `booking_confirmed`, `balance_paid`, `handover_dispatched`, `handover_completed` all enqueue in the same transaction as their booking/payment/handover state change (`49f9b57`).
- Worker-side notification outbox drain — BullMQ repeat job claims due `outbound_messages`, sends through an injectable transport, and marks `sent`/`pending`/`dead` with retries (`8515da3`).
- Worker live notification transport — `NOTIFICATION_TRANSPORT=http` renders WhatsApp/SMS lifecycle templates and posts provider-compatible JSON with auth headers, idempotency keys, timeout handling, retries through the existing outbox drain, and provider response/id storage via migration `000022`.
- Measurement management backend — protected `GET/POST/PATCH/DELETE /v1/measurement-fields` plus `POST /v1/orders/{id}/measurements` for visit/shop staff entry, with tenant, field-key, route, and upsert tests (`d469cfb`).
- Business dashboard polish — `apps/dashboard` now has a branded login, proper workspace shell, richer production board, redesigned design studio, measurement field management, visit/shop measurement capture, and a single-doctype SSR response (`e21d39e`).
- Business dashboard operations panels — the polished shell now exposes money summary/manual takings, booking queue reschedule/cancel, pickup/delivery handovers, notification log, and availability-window management over the existing protected APIs (`d634071`).
- Business dashboard reporting snapshot — a full-width reports layer now derives seven-day recorded income, collection/completion rates, stage throughput, and follow-up radar signals from the already-loaded dashboard data (`1041db1`).
- Business dashboard role-aware task view — owner/admin retain management reports, money, catalogue, measurement setup, and availability controls; staff get a task-first queue for production, measurements, visits, handovers, and messages, with staff loader data stripped of money/catalogue/settings payloads and route actions guarded by the signed role claim (`9fc1b06`).
- Business dashboard routed workspace pages — the old giant `/dashboard` scroll page is split into routed pages (`/dashboard/reports`, `/dashboard/orders`, `/dashboard/money`, `/dashboard/visits`, `/dashboard/handovers`, `/dashboard/catalogue`, `/dashboard/measurements`, `/dashboard/availability`, `/dashboard/messages`) with staff redirects away from management-only pages (`1771047`).
- Business dashboard routed workspace polish — the business dashboard now has a sharper workspace rail, page-specific headers, improved metric cards, and a richer owner/admin overview launchpad while staff keep the task-first landing page (`4537ae1`).
- Cross-app navigation rail polish — admin, business dashboard, and storefront now share fixed desktop rails/sticky mobile rails, stronger active states, and reduced-motion-safe entry/hover animations while keeping each audience's layout appropriate (`acd19d0`).
- Business/storefront rail correction — admin was left untouched; the business dashboard now has a darker fixed studio rail with helpers and live badges, while the storefront has a fuller customer shopping rail with store signals, service status, search, and browsing actions (`8ee7192`).
- Storefront customer-surface polish — the public store header, design cards, empty states, collection page, and tracking page now have richer proof panels, clearer status treatment, and reduced-motion-safe animations (`b559c71`).
- Business dashboard shared-card polish — routed business pages now share richer panel surfaces, elevated metric cards, upgraded overview launch cards, a darker focus panel, and stronger empty/info/stat states (`efb0a64`).

Uncommitted in this working tree: a follow-up `apps/dashboard` / `apps/storefront` polish pass fixes the visible rail breakpoint issues from the small-desktop screenshots, adds the dashboard dark-header priority ribbon, full-card overview navigation, router-link internal dashboard buttons, shared panel motion, dashboard-level `CssBaseline` polish, a denser orders production board, catalogue health stats, a storefront grid that does not overfit narrow screens, and real WebP fallback imagery for storefront and dashboard catalogue designs missing uploaded photos. Verified with dashboard/storefront checks, cross-app eslint, production builds, `git diff --check`, API health, live dashboard route smokes on `http://127.0.0.1:3401` (`/login` 200; `/dashboard` 302 to `/login` without a session; authenticated owner `/dashboard/orders` 200; authenticated owner `/dashboard/catalogue` 200; dashboard fallback WebP 200), and live storefront smokes on `http://127.0.0.1:3402` (`/store/demo-atelier` 200; `demo-atelier.localhost:3402` 200; storefront fallback WebP 200). Local API was started with `DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable` so it hits the demo Postgres container instead of the unrelated Postgres on port 5432.

Follow-up storefront correction after visual review: the public store no longer uses the dashboard-like fixed browsing rail. `apps/storefront/app/components/storefront.tsx` now presents a customer-first storefront with a normal top identity bar, image-backed hero search, service availability band, and compact catalogue grid so two demo pieces do not stretch into oversized tiles. Verified with `pnpm --filter @xtiitch/storefront check`, `pnpm exec eslint apps/storefront --max-warnings=0`, `pnpm --filter @xtiitch/storefront build`, `git diff --check`, and a live `demo-atelier.localhost:3402` smoke returning 200.

Uncommitted feature slice: business-user management now has protected owner/admin API support for listing users, creating admin/staff accounts, and updating role/active state while keeping owner rows protected from this v1 mutation path. The business dashboard has a management-only `/dashboard/team` surface with active/admin/staff/inactive stats, create-access form, editable non-owner rows, owner protection messaging, and self-deactivation disabled in the UI. Verified with `go test ./internal/...` from `apps/api`, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, direct API smokes for `GET`/`POST`/`PATCH /v1/auth/business/users`, and an authenticated live smoke for `http://127.0.0.1:3401/dashboard/team` after restarting the API dev server on `:8080`. The smoke created one inactive demo user, `team-smoke-1781638668@demo.test`, in the local demo database.

Uncommitted dashboard continuation: the business dashboard now loads and renders store settings, collections, size bands, and per-design prices for owner/admin sessions. Added a `/dashboard/settings` store-switch panel, walk-in order logging on the production board, agreed-total editing and balance checkout controls on order cards, collection creation/retire/restore/remove, size-band creation, a catalogue price board for standard checkout pricing, inline design maintenance for title/collection/description/images/display order/deposit/customisation, design image upload/attach via the signed media API, design retire/restore/remove controls, and an overview store-readiness panel for verification/catalogue/pricing/request-path/measurement/availability/team setup health. The dashboard rail is now sticky inside the layout grid instead of fixed, so the sidebar and detail surface occupy separate columns. Typography across admin, dashboard, storefront, and marketing is now standardised to `DM Serif Display` for headings/display and `Instrument Sans` for body/UI. Verified with `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, and `git diff --check apps/dashboard/app/routes/dashboard.tsx agent_plan.md README.md`.

Uncommitted storefront continuation: the public storefront now exposes store collections on the customer-facing store page when collection data is present, and the design detail page has a fuller product/order surface with real fallback imagery, price/deposit/fit signals, listed-size checkout, and the three bespoke request routes (`self_measure`, `home_visit`, `come_to_shop`) wired to the existing `POST /v1/public/stores/{handle}/custom-orders` action. Storefront SSR now returns a single doctype, and Vite dependency pre-optimization includes the new storefront icons. Verified with `pnpm --filter @xtiitch/storefront check`, `pnpm exec eslint apps/storefront --max-warnings=0`, `pnpm --filter @xtiitch/storefront build`, `git diff --check apps/storefront/app/routes/design.tsx apps/storefront/app/components/storefront.tsx apps/storefront/app/routes/store.tsx apps/storefront/app/routes/home.tsx apps/storefront/app/entry.server.tsx apps/storefront/vite.config.ts`, live smokes on `http://127.0.0.1:3402` for `/store/demo-atelier`, `demo-atelier.localhost:3402`, `/store/demo-atelier?q=kente`, `/d/agbada-two-piece-860fed9fa2`, the fallback WebP asset, and no-mutation validation POSTs for standard/custom form errors.

Uncommitted admin continuation: the admin dashboard now has a real platform-admin auth foundation. Added global `admin_users`/`admin_sessions` migration `000013`, separate admin roles (`owner`, `operator`, `support`), dedicated admin JWT claims (`typ=admin_access`, `scope=admin`), bootstrap env vars, `/v1/admin/auth/login|refresh|logout|me`, and a React Router admin session wired to the API instead of the previous local email/password mock. The admin shell displays the authenticated operator name/role and returns only the public operator profile in loader data; access/refresh tokens remain server-side in the HttpOnly session cookie. Admin headings use `DM Serif Display` with `Instrument Sans` for body/UI. Verified with `go test ./internal/...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, manual application of `000013_admin_auth.up.sql` to `xtiitch-demo-pg`, direct API smokes for admin login/me, and live admin app smokes on `http://127.0.0.1:3403` for `/login`, unauthenticated `/admin` redirect, API-backed login, authenticated `/admin` 200, token-free loader HTML, and logout redirect.

Uncommitted admin user-management continuation: platform operator user management is now API-backed. Added owner-only `GET /v1/admin/roles`, `GET /v1/admin/users`, `POST /v1/admin/users`, and `PATCH /v1/admin/users/{id}`; fixed role permission catalog entries; duplicate-email, invalid-role, weak-password, and owner self-demotion/deactivation protections; and a Users section in `apps/admin` with create/edit forms, active/inactive states, operator metrics, and a role-permission matrix. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, direct API smokes for roles/list/create/update, and live admin smokes on `http://127.0.0.1:3403` for fresh API-backed login, authenticated `/admin` 200, token-free loader/action HTML, and an update action rendering the Users section. Local smoke data includes `operator-smoke-1781697347@xtiitch.test` and `frontend-smoke-1781697367@xtiitch.test` in the demo database.

Uncommitted admin role-management continuation: role/permission management is now persisted and editable. Added migration `000014_admin_role_permissions`, seeded owner/operator/support grants, exposed `GET /v1/admin/roles` with the available permission catalog, added protected `PATCH /v1/admin/roles/{role}`, moved admin user-management authorization from hardcoded owner-only checks to permission-based checks, and protected owner recovery grants (`manage_admin_users`, `manage_roles`) from removal. The admin app now has a dedicated Roles section with checkbox grant editing, owner-required grant locks, permission descriptions, metrics, action feedback, and token-free SSR/action output. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000014_admin_role_permissions.up.sql`, direct API smokes for list/update/protected owner failure/restore, and live admin form-action smokes on `http://127.0.0.1:3403`.

Uncommitted admin settings continuation: operator profile, notification preferences, and platform settings are now persisted and editable. Added migration `000015_admin_settings` with `admin_operator_preferences` and singleton `admin_platform_settings`, exposed `GET/PATCH /v1/admin/settings/profile`, `PATCH /v1/admin/settings/preferences`, and `GET/PATCH /v1/admin/settings/platform`, kept profile/preferences self-service, and gated platform settings behind `manage_settings`. The admin app now has a Settings section with profile editing, alert routing, daily digest time, phone/timezone preferences, platform support email, verification SLA, payout-review threshold, and maintenance-mode controls. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000015_admin_settings.up.sql`, direct API smokes for profile/preferences/platform settings, and live admin form-action smokes on `http://127.0.0.1:3403` with token-free HTML.

Uncommitted admin audit continuation: admin audit persistence is now durable and API-backed. Added migration `000016_admin_audit_events`, an audit repository contract, audit event recording for successful admin sign-in/sign-out, profile/preference/platform settings changes, admin user create/update, and role-permission updates, plus `GET /v1/admin/audit-events` with `view_audit` permission enforcement and optional severity filtering. The admin Audit Log now loads durable API events while still allowing mock-only operational buttons to append local session events until those operator APIs are real. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000016_admin_audit_events.up.sql`, direct API smokes for audit creation/listing/severity filtering, and live admin SSR/action smokes on `http://127.0.0.1:3403` with token-free HTML.

Uncommitted admin business-verification continuation: the first real admin operator API is now wired end to end. Added `GET /v1/admin/business-verifications` and `POST /v1/admin/business-verifications/{id}/decision` behind `review_businesses`, cross-tenant RLS-bypass repository reads for the verification queue, approve/reject/hold decision handling (`verified`/`rejected`/`pending`), and durable audit events for business verification decisions. The admin Verification section now loads API-backed cases, shows current verification status/risk/evidence, submits decisions through React Router form actions, returns to the Verification section with action feedback, and keeps tokens out of SSR/action HTML. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, direct API smokes for queue listing/hold decision/audit filtering, and live admin login/SSR/form-action smokes on `http://127.0.0.1:3403`.

Uncommitted admin business-management continuation: the Businesses section is now API-backed for platform lifecycle control. Added migration `000017_admin_business_status` with `operational_status`, suspension reason, timestamp, and suspending admin metadata so suspension does not overwrite KYC/verification state; exposed `GET /v1/admin/businesses` and `PATCH /v1/admin/businesses/{id}/status` behind `review_businesses`; returns real owner, plan, verification, operational status, order count, GMV, commission, risk, subaccount, and last-activity data; and records durable audit events for suspend/reactivate actions. The admin Businesses section now loads the real tenant list, filters real status values, submits suspend/reactivate actions through React Router forms, offers a reason field in the inspector, and keeps tokens out of SSR/action HTML. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000017_admin_business_status.up.sql`, direct API smokes for list/suspend/reactivate/audit, and live admin login/SSR/form-action smokes on `http://127.0.0.1:3403`.

Uncommitted admin platform-metrics continuation: the Overview metric cards now load real platform metrics instead of mock data. Added `GET /v1/admin/platform-metrics` behind `review_businesses`, aggregating current-month GMV, current-month platform commission revenue, active/total/suspended businesses, pending verifications, and 30-day payment health through the RLS-bypass admin repository path. The admin Overview renders those live values, handles permission denials cleanly, and keeps access/refresh tokens server-side. Also restarted the admin dev server to clear stale React Router HMR state after the browser reported `[react-router:hmr] No module update found for route routes/admin`; server-side admin login was verified independently. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, direct API smoke for `/v1/admin/platform-metrics`, and live admin login/dashboard smokes on `http://127.0.0.1:3403`.

Uncommitted admin login and money-rails continuation: the admin login page has been redesigned into a polished operator entry while preserving the real email/password POST, server-side admin session, `DM Serif Display` headings, Instrument Sans UI, error states, and a submitting state. Added migration `000018_admin_money_controls` with durable admin replay requests and settlement-review holds; the Money rails section now loads a real read model from `GET /v1/admin/money-rails`, queues webhook replay review through `POST /v1/admin/money-rails/replay-requests`, and places/releases settlement-review holds through `PATCH /v1/admin/money-rails/businesses/{id}/settlement-hold`, all behind `manage_money_rails` with durable audit events. The controls are review/audit controls only and do not move or hold customer funds. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, manual application of `000018_admin_money_controls.up.sql`, direct API smokes for money-rails read/replay/hold/release, and live admin login/form-action/dashboard smokes on `http://127.0.0.1:3403` with token-free HTML.

Uncommitted admin risk-review continuation: the Risk section is now API-backed instead of mock/local state. Added migration `000019_admin_risk_reviews` with persisted close/reopen state for generated risk signals, exposed `GET /v1/admin/risk-reviews` and `PATCH /v1/admin/risk-reviews/{key}` behind `manage_risk`, generated the risk queue from payment failures, queued replay requests, active settlement holds, suspended businesses, rejected verification, and verified businesses missing payout setup, and recorded durable audit events for close/reopen actions. The admin Risk tab now loads live reviews, shows open-count badges, submits close/reopen through React Router actions, path-unescapes encoded review keys, and keeps tokens out of SSR/action HTML. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000019_admin_risk_reviews.up.sql`, direct API smokes for list/encoded-key close/reopen, and live admin login/form-action/dashboard smokes on `http://127.0.0.1:3403` with token-free HTML.

Uncommitted admin support continuation: the Support section is now API-backed instead of mock/local assignment state. Added migration `000020_admin_support_tickets` with persisted support assignment/resolution state, exposed `GET /v1/admin/support-tickets` and `PATCH /v1/admin/support-tickets/{key}` behind `manage_support`, generated the queue from operational signals including failed payments, delayed/dead outbound messages, stale confirmed orders, overdue home visits, and handover follow-ups, and recorded durable audit events for assign/unassign/resolve/reopen actions. The admin Support tab now loads live tickets, shows urgent open-count badges, submits assignment and status changes through React Router actions, path-unescapes encoded ticket keys, and keeps tokens out of SSR/action HTML. Verified with `go test ./internal/...`, `go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000020_admin_support_tickets.up.sql`, direct API smokes for list/assign/unassign/resolve/reopen, and live admin login/form-action/dashboard smokes on `http://127.0.0.1:3403` with token-free HTML.

Uncommitted admin notification/reporting/export continuation: the admin shell now has Notifications, Reports, and Exports sections without adding another backend table. Notifications derive action alerts from API-backed verification cases, failed/replayed webhooks, payout reviews, open risk reviews, support tickets, payment health, and the current operator's routing preferences. Reports derive a compliance/operator posture from the same loaded admin read models: GMV/commission/payment health, KYC backlog, payout holds, failed webhooks, open risk/support, audit posture, and platform policy. Exports covers report posture, businesses, verification, money rails, risk reviews, support tickets, audit trail, and admin users, each with jump actions back to the owning workflow. These sections use the existing fixed admin rail, `DM Serif Display` headings, Instrument Sans UI/body, and token-free SSR. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a live admin login/dashboard smoke on `http://127.0.0.1:3403` confirming Reports/Notifications/Exports nav render with token-free HTML.

Uncommitted admin login/health continuation: fixed the local operator-login trap shown in the browser by creating `operator@xtiitch.com` as an active `operator` in the demo database through the owner-backed admin user API, then added `ADMIN_BOOTSTRAP_EXTRA_USERS_JSON` so fresh local/demo databases can seed operator/support accounts durably without changing the login screen. Added an admin Health section to the fixed operator rail that derives payment, KYC, tenant, risk/support, audit, policy, access, and export-readiness signals from the already-loaded admin read models, with jump actions back to the owning workflows. Restarted the admin dev server in a detached `screen` session on `http://127.0.0.1:3403` to clear stale React Router HMR state. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, direct API login smoke for `operator@xtiitch.com`, and live admin login/dashboard smoke confirming Health nav render, operator identity render, and token-free HTML.

Uncommitted admin notification-feed continuation: the Notifications section now behaves like an operator triage feed instead of a flat derived list. Notifications carry categories, sources, watched/muted status, and sorted severity; the feed adds filterable triage lanes for all/verification/money/risk/support/platform/audit, active-vs-muted counts from the operator's notification preferences, source metadata on each alert, platform maintenance and critical-audit signals, and a routing panel that summarizes watched categories plus email/SMS delivery. It remains derived from already-loaded admin read models, so no new backend table is required. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check apps/admin/app/routes/admin.tsx agent_plan.md`, and a live admin smoke on `http://127.0.0.1:3403` confirming operator login, Notifications nav, and token-free HTML.

Uncommitted admin shell/subscriptions continuation: replaced the messy mobile admin header/rail with a real drawer-backed mobile navbar, added a collapsible desktop sidebar, and redesigned the sticky detail toolbar with notification access, sidebar collapse, dark/light chrome toggle, and a profile/settings dropdown for profile, platform settings, notification routing, audit, and logout. Added a Subscriptions section as the first billing visibility slice over existing `plans` and admin business read models: package mix, estimated base MRR, commission exposure, free-plan upgrade candidates, paid-plan readiness, and explicit blockers for the future Paystack recurring/payment-link lifecycle. This does not charge package fees yet and does not hold funds. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check apps/admin/app/routes/admin.tsx agent_plan.md`, and a live admin smoke on `http://127.0.0.1:3403` confirming operator login, toolbar render, and token-free HTML.

Uncommitted admin subscription-lifecycle continuation: upgraded subscriptions from derived visibility to persisted lifecycle management. Added migration `000021_admin_subscriptions` with tenant-scoped `business_subscriptions` and `business_subscription_events`, seeded rows for existing businesses, added `manage_subscriptions` to RBAC, exposed `GET /v1/admin/subscriptions` and `PATCH /v1/admin/subscriptions/businesses/{id}`, recorded lifecycle events plus admin audit events, and rewired the admin Subscriptions section to show API-backed plan mix, MRR, attention queues, status/billing-mode controls, and recent lifecycle events. This still does not perform automatic Paystack recurring charges and does not hold funds. Verified with `go test ./internal/...`, `go test ./internal/application/adminauth ./internal/domain/admin ./internal/adapters/inbound/http/adminauth ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000021_admin_subscriptions.up.sql` to the local demo database on `localhost:5450`, direct API smoke for operator login/list/update subscription lifecycle, and live admin web login smoke on `http://127.0.0.1:3403` confirming Subscriptions nav render and token-free HTML.

Uncommitted admin subscription-invoice continuation: package billing now has an operator invoice ledger and settlement controls. Added migration `000025_admin_subscription_invoices` with tenant/RLS-protected `business_subscription_invoices`, exposed admin-only invoice issue/mark-paid/mark-failed endpoints under `/v1/admin/subscriptions`, extended subscription responses with recent invoices, and added invoice controls to the admin Subscriptions lifecycle queue. Issuing an invoice records the next package period and optional Paystack payment-link/reference metadata; marking failed moves the subscription to `past_due`/grace retry state; marking paid advances the paid-through period, resets failed count, and records the last payment. This is still not automatic Paystack recurring authorization; it is the production-safe manual/payment-link control path that never holds funds. Verified with `cd apps/api && go test ./internal/... && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, manual application of `000025_admin_subscription_invoices.up.sql` to the local demo database, and a live admin API smoke that issued an invoice, marked it failed (`past_due`), then marked it paid (`active`, failed count reset).

Uncommitted admin server-side export continuation: admin CSV downloads are now served by authenticated backend endpoints instead of browser data URLs. Added `GET /v1/admin/exports/{dataset}.csv` for report posture, businesses, verification, money rails, risk reviews, support tickets, audit events, users, subscriptions, and promotions; the admin app posts download forms through the server action so access tokens stay in the HttpOnly session while the browser receives attachment responses. Verified with `cd apps/api && go test ./internal/... && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, a fresh API restart on `:8080`, and live CSV smokes for `/v1/admin/exports/report-posture.csv` and `/v1/admin/exports/businesses.csv` returning `text/csv` attachments with expected rows.

Uncommitted admin billing-sweep continuation: subscription dunning now has an operator-run sweep control. Added `POST /v1/admin/subscriptions/billing-sweeps` behind `manage_subscriptions`; it fails overdue issued package invoices, advances affected subscriptions into `past_due`/`grace_period`, cancels subscriptions whose grace window has already expired, writes subscription lifecycle events, and records an admin audit event with sweep counts. The admin Subscriptions screen now shows overdue invoice/expired grace counts and a “Run sweep” action. This is still not automatic Paystack recurring authorization; it is the safe dunning/grace-expiry control that can later be called by a worker schedule. Verified with `cd apps/api && go test ./internal/... && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, a fresh API restart on `:8080`, direct API smoke for the sweep endpoint, and an audit-feed smoke confirming `Ran subscription billing sweep` was recorded.

Uncommitted admin subscription-downgrade continuation: subscription cancellation now enforces the package downgrade rule. When an operator cancels a subscription manually, or when the billing sweep cancels an expired grace subscription, the subscription row and the business row both move to the active `free` plan so paid package limits/fees are no longer shown as current. This keeps cancellation behavior consistent with the no-funds-held package model while leaving re-upgrade as a future explicit assignment flow. Verified with `cd apps/api && go test ./internal/... && go vet ./...`, a fresh API restart on `:8080`, and a local API smoke that inserted a temporary standard-plan business/subscription, canceled it through `PATCH /v1/admin/subscriptions/businesses/{id}`, confirmed the response and database both reported `free`, then deleted the temp business.

Uncommitted worker scheduled-billing-sweep continuation: the worker now schedules subscription billing sweeps alongside notification outbox draining. Added `apps/worker/src/billing.ts` with the same overdue-invoice, grace-expiry, free-downgrade, lifecycle-event, and system audit behavior as the admin sweep; added `SUBSCRIPTION_BILLING_SWEEP_ENABLED` and `SUBSCRIPTION_BILLING_SWEEP_INTERVAL_MS` config; and wired a BullMQ repeat/startup job named `run-subscription-billing-sweep`. Verified with `pnpm --filter @xtiitch/worker check`, `pnpm --filter @xtiitch/worker test`, and a live worker-store smoke against the local demo database returning a zero-count sweep.

Uncommitted admin subscription-webhook continuation: Paystack webhooks now reconcile package invoices that do not correspond to customer order payments. The payment repository keeps the existing provider-event idempotency ledger, then falls through from unknown order-payment references to tenant-scoped `business_subscription_invoices` matching by `provider_invoice_ref` or `invoice_ref`; signed success events mark invoices paid, reactivate subscriptions, reset failed counts, and record provider-origin lifecycle events, while failed events move issued invoices into `past_due`/grace retry state. This still does not hold customer funds and reuses the no-funds-held invoice/payment-link model. Verified with `cd apps/api && go test ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/application/payments`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, and `cd apps/api && go vet ./...`.

Uncommitted admin recurring-reference continuation: subscription lifecycle updates can now attach Paystack customer/subscription references for payment-link and recurring package billing. Manual billing clears provider refs, recurring billing requires a subscription reference, the admin lifecycle event and audit metadata record the refs, and the Subscriptions UI exposes Paystack customer/subscription reference inputs on each lifecycle row. Added a live Postgres repository integration test that stores recurring refs and then verifies manual billing clears them. Verified with `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, and `pnpm --filter @xtiitch/admin build`.

Uncommitted admin entitlement-usage continuation: subscription records now include active catalogue design counts so operators can see package-limit pressure without entering the business dashboard. The admin subscription read model and responses expose `design_count`; the Subscriptions screen adds an “Over design limit” metric, includes over-limit stores in the lifecycle attention queue, and shows per-business active design usage plus warning chips when the plan cap is exceeded. This is visibility only; hard enforcement belongs to the catalogue write path and remains separate from the protected storefront/catalogue lane. Verified with `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, and `pnpm --filter @xtiitch/admin build`.

Uncommitted admin plan-package continuation: package definitions are now admin-managed instead of static-only. Added migration `000023_admin_plan_packages` to add `manage_plans` to admin RBAC, exposed `GET/POST/PATCH /v1/admin/plans` and `POST /v1/admin/plans/{id}/archive` behind `manage_plans`, used the admin RLS-bypass transaction path for cross-tenant package metrics, recorded audit events for create/update/archive, and added package controls to the admin Subscriptions section for creating, updating, activating/archiving, and reviewing live package performance. This slice only manages package definitions; it still does not perform recurring package billing or hold funds. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `cd apps/api && go test ./internal/application/adminauth ./internal/domain/admin ./internal/adapters/inbound/http/adminauth ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000023_admin_plan_packages.up.sql` to the local demo database on `localhost:5450`, direct API smokes for owner login/list/create/update/archive plan package, and admin web smokes on `http://127.0.0.1:3403` for login 200 and unauthenticated `/admin` redirect.

Uncommitted admin promotions continuation: promotion/voucher definitions are now admin-managed. Added migration `000024_admin_promotions` with `promotions` and `promotion_redemptions`, added `manage_promotions` to admin RBAC, exposed `GET/POST/PATCH /v1/admin/promotions` and `POST /v1/admin/promotions/{id}/archive`, used the admin RLS-bypass transaction path for platform-wide or business-targeted offers, validated code/discount/window/limit/funding fields, recorded audit events for create/update/archive, and added a Promotions section in `apps/admin` for platform-wide vouchers, targeted business offers, caps, limits, funding source, scope, date windows, and archive controls. This slice manages promotion definitions only; checkout redemption/application, business-side promotion controls, and payment split discounting remain open. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `cd apps/api && go test ./internal/application/adminauth ./internal/domain/admin ./internal/adapters/inbound/http/adminauth ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, manual application of `000024_admin_promotions.up.sql` to the local demo database on `localhost:5450`, direct API smokes for owner login/list/create/update/archive promotion, RBAC catalog smoke for `manage_promotions`, and admin web smokes on `http://127.0.0.1:3403` for `/login` 200 and unauthenticated `/admin` redirect. Local smoke data includes archived promotion `PROMO1781724884`.

Uncommitted admin promotion-redemption continuation: Promotions now include a compact recent-redemptions ledger. The admin promotion read model attaches up to five latest redemptions per promotion with status, discount, customer/order references, customer display name, and timestamps; the admin HTTP response/client maps `recent_redemptions`; and the Promotions UI shows recent redemption activity directly inside each promotion card. Added a live Postgres repository integration test for applied/pending redemption ordering and aggregate counts. Verified with `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, and `pnpm --filter @xtiitch/admin build`.

Uncommitted admin promotion-export continuation: The authenticated admin CSV exporter now has a `promotion-redemptions` dataset built from the secured promotion read model, including promotion, code, business, customer/order references, redemption status, discount, and timestamps for the recent redemption rows carried by each promotion. The Admin Exports section now exposes both the existing `promotions` summary dataset and the new recent-redemptions dataset with row counts and download actions. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/api/internal/adapters/inbound/http/adminauth/handler.go apps/admin/app/routes/admin.tsx`.

Uncommitted admin subscription-export continuation: The Admin Exports section now exposes the existing authenticated `subscriptions` CSV dataset with plan, billing status, billing mode, fee, design-usage, invoice, payment, and renewal timing rows. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/admin/app/routes/admin.tsx`.

Uncommitted admin notification continuation: The derived Admin Notifications action center now includes subscription billing/usage signals and promotion pending-redemption signals alongside verification, money, risk, support, platform, and audit alerts. Added filter lanes for Subscriptions and Promotions, routed those alerts to their dashboard sections, and kept notification preference routing default-watched for the new platform-owned lanes. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/admin/app/routes/admin.tsx`.

Uncommitted admin reporting continuation: The derived Admin Reports posture now includes subscription billing/usage and promotion activity report rows, including active MRR snapshot, over-plan usage count, active offer count, pending redemption count, and redeemed discount value. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/admin/app/routes/admin.tsx`.

Uncommitted admin health continuation: Operations Health now includes subscription health and promotion controls signals, flagging past-due/grace/over-plan subscription risk, cancel-at-period-end watch rows, active promotion count, and pending promotion redemptions. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/admin/app/routes/admin.tsx`.

Uncommitted admin plan-export continuation: The authenticated admin CSV exporter now includes a `plans` dataset with package code/name, active state, monthly fee, commission, design limit, business count, active subscriptions, estimated MRR, and timestamps. The Admin Exports section exposes the Plan packages CSV card using the loaded plan read model. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/api/internal/adapters/inbound/http/adminauth/handler.go apps/admin/app/routes/admin.tsx`.

Uncommitted admin RBAC-export continuation: The authenticated admin CSV exporter now includes a `roles` dataset for role labels, permission counts, and permission grants, and the Admin Exports section exposes a Roles and permissions card from the loaded role catalog. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/api/internal/adapters/inbound/http/adminauth/handler.go apps/admin/app/routes/admin.tsx`.

Uncommitted admin settings-export continuation: The authenticated admin CSV exporter now includes a `settings` dataset for the current operator profile, notification routing preferences, and platform policy controls, and the Admin Exports section exposes a Settings and notifications card with the loaded profile/settings read models. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check -- agent_plan.md apps/api/internal/adapters/inbound/http/adminauth/handler.go apps/admin/app/routes/admin.tsx`.

Uncommitted admin notification-preference continuation: Operator notification settings now persist subscription and promotion alert preferences. Added migration `000026_admin_notification_growth_preferences` with `alert_subscriptions` and `alert_promotions`, threaded those fields through admin preferences ports, Postgres repository scans/upserts, service normalization, HTTP request/response, admin API client mapping, Settings form toggles, notification watched/muted logic, routing summaries, and settings export rows. Applied the migration to the local demo database. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check`.

Uncommitted admin ads-permission continuation: Sponsored placements now have a dedicated `manage_ads` admin RBAC foundation. Added migration `000027_admin_ads_permission`, granted owner/operator default access, threaded the permission through the admin domain catalog, role-permission ordering, backend permission labels, and the admin Roles UI label/description. Applied the migration to the local demo database and confirmed owner/operator grants. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and `git ls-files | grep -i '\.pdf$' || true`.

Uncommitted admin sponsored-placement continuation: Sponsored placements now have an API-backed admin queue. Added migration `000028_admin_ad_campaigns` with tenant-scoped `ad_campaigns` and `ad_events`, enforced verified/active advertiser eligibility plus active-design targeting for promoted designs, exposed `GET/POST/PATCH/POST archive /v1/admin/ad-campaigns` behind `manage_ads`, recorded durable admin audit events, added typed admin client methods, and added an Ads section with create/update/archive controls, budget/date/review fields, and event rollup metrics. Applied the migration to the local demo database, restarted the local API screen on current code, and live-smoked list/create/update/archive with `operator@xtiitch.com` against `demo-atelier`. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check`.

Uncommitted admin ads-reporting continuation: Sponsored placements are now wired into the admin operating layer instead of living only in the Ads queue. Ads pending review feed notifications, reports, operations health, and the Exports screen; `ad-campaigns` is also available as an authenticated server-backed CSV dataset with campaign, advertiser, placement, spend, cap, date, engagement, and review-note fields. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a live temporary-API smoke of `GET /v1/admin/exports/ad-campaigns.csv`.

Uncommitted admin growth-permission continuation: Admin-run affiliate/referral programmes now have a dedicated `manage_growth` RBAC foundation. Added migration `000029_admin_growth_permission`, granted owner/operator default access, threaded the permission through the backend domain catalog, role-permission ordering, backend permission labels, and the admin Roles UI label/description. Applied the migration to the local demo database and confirmed owner/operator grants. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a temporary-API smoke showing `manage_growth: Growth programmes` from `GET /v1/admin/roles`.

Uncommitted admin affiliate-registry continuation: Admin-run affiliate programmes now have a platform-global partner registry behind `manage_growth`. Added migration `000030_admin_affiliates` with bypass-only RLS, unique affiliate codes, commission model/rate, cookie window, payout mode/reference, status, notes, and admin audit fields; added API-backed list/create/update/archive service methods with audit events; added typed admin client calls; and added an Affiliates section in `apps/admin` for registering, editing, pausing, and archiving partner records. Applied the migration to the local demo database and live-smoked list/create/update/archive with `operator@xtiitch.com` (`AFF1781737675` active -> paused -> archived). Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check`.

Uncommitted admin affiliate-reporting continuation: Affiliate programmes are now wired into the admin operating layer. Pending partner reviews feed Notifications, Reports, Operations Health, and the Exports screen; `affiliates` is also available as an authenticated server-backed CSV dataset with partner code, contact, commission, payout, cookie-window, status, notes, and updated-at fields. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a live temporary-API smoke of `GET /v1/admin/exports/affiliates.csv`.

Uncommitted admin referral-programme schema continuation: Referral programmes now have a platform-global data foundation behind the future `manage_growth` API/UI work. Added migration `000031_admin_referral_programmes` with bypass-only RLS, unique code prefixes, audience, referrer/referee reward kinds, reward economics, qualifying order minimum, reward hold window, schedule/status, notes, and admin audit columns. Applied the migration to the local demo database and confirmed the table exists. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, and `git diff --check`.

Uncommitted admin referral-programme registry continuation: Admin referral programme definitions are now API-backed and editable behind `manage_growth`. Added list/create/update/archive service and repository methods over `referral_programmes`, exposed `GET/POST/PATCH/POST archive /v1/admin/referral-programmes`, recorded audit events, added typed admin client methods, and added a Referrals section in `apps/admin` for code prefixes, audience, reward routes, reward economics, qualifying order minimums, hold days, schedule windows, notes, and lifecycle state. Verified with `cd apps/api && go test ./internal/application/adminauth ./internal/adapters/inbound/http/adminauth ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a temporary-API live smoke on `:18084` that created referral programme `REF1781738747`, updated it active -> paused, then archived it.

Uncommitted admin referral-reporting continuation: Referral programmes are now wired into the admin operating layer instead of living only in the Referrals registry. Draft/paused referral programmes feed Notifications, Reports, Operations Health, and the Exports screen; `referral-programmes` is also available as an authenticated server-backed CSV dataset with code prefix, audience, reward routes/economics, qualifying order minimum, hold window, schedule, status, notes, and updated-at fields. Verified with `cd apps/api && go test ./internal/adapters/inbound/http/adminauth ./internal/application/adminauth`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a live temporary-API smoke of `GET /v1/admin/exports/referral-programmes.csv` returning `text/csv` with the `REF1781738747` row.

Uncommitted admin affiliate-attribution schema continuation: Affiliate performance now has a database foundation for the future admin ledger and public tracking path. Added migration `000032_admin_affiliate_attribution` with platform-global `affiliate_clicks` and tenant-bound `affiliate_conversions`, one conversion per order, visitor/ip-hash tracking without raw IP storage, commission snapshots, hold/approval/settlement/reversal state, order/business tenant FK enforcement, indexes, RLS policies, and app grants. Applied the migration to the local demo database with the owner role and verified both tables, policies, and grants through the `xtiitch_app` role. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `git diff --check`, and direct SQL verification of the new tables, policies, and role grants.

Uncommitted admin affiliate-attribution read-model continuation: Admin affiliate performance is now API-backed and visible in the Affiliates section. Added `GET /v1/admin/affiliate-attribution` behind `manage_growth`, a bypass read model aggregating affiliate clicks/conversions/status buckets/gross/commission/latest activity plus five recent conversions per partner, typed admin client mapping, and performance cards/partner-level conversion rows in `apps/admin`. Verified with `cd apps/api && go test ./internal/application/adminauth ./internal/adapters/inbound/http/adminauth ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a temporary-API live smoke of `GET /v1/admin/affiliate-attribution` returning one local affiliate (`AFF1781737675`) with zeroed performance counters.

Uncommitted admin affiliate-conversion controls continuation: Admin operators can now review affiliate conversion rows from the Affiliates section. Added `PATCH /v1/admin/affiliate-conversions/{id}/status` behind `manage_growth`, conservative pending -> approved/reversed and approved -> settled/reversed transitions, audit events with operator notes, Postgres integration coverage for transition persistence and terminal settled state, typed admin client support, and compact approve/settle/reverse controls on recent conversion rows. Verified with `cd apps/api && go test ./internal/application/adminauth ./internal/adapters/inbound/http/adminauth ./internal/adapters/outbound/postgres`, `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, `git diff --check`, and a temporary-API live smoke that inserted a tagged conversion, approved it, settled it, confirmed the attribution read model showed one settled conversion with GHS 40.00 commission, and cleaned the smoke rows. Public click ingestion, checkout attribution, and payout reconciliation remain the next affiliate slices.

Uncommitted checkout promotion-redemption continuation: public standard checkout and custom deposit checkout now accept `promo_code`, reserve an active store-scoped promotion atomically, reduce the draft order/deposit payable amount before charging, carry the correct commission override for business-funded, platform-funded, and split-funded discounts, void abandoned setup failures, apply redemptions only on signed `charge.success`, and void pending redemptions on failed provider events. Checkout redemption currently supports `scope='store'`; collection/design-scoped target matching and business-side promotion controls are still pending. Verified with `cd apps/api && go test ./internal/...`, `cd apps/api && go vet ./...`, `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./internal/adapters/outbound/postgres`, a live admin-created voucher smoke against `demo-atelier` that reduced a GHS 450.00 order to GHS 400.00 with a pending redemption, and a signed local Paystack webhook smoke that confirmed the order/payment and moved the redemption to `applied`.

Uncommitted worker notification-transport continuation: added a live HTTP notification sender for the worker. `NOTIFICATION_TRANSPORT=http` now requires `NOTIFICATION_HTTP_URL` plus an auth header/value, renders lifecycle templates for order confirmation/fulfilment, booking confirmation, balance paid, and handover dispatched/completed, posts a provider-compatible JSON payload with idempotency headers, treats non-2xx responses as retryable send failures, and stores provider response/id metadata on `outbound_messages` through migration `000022_notification_provider_delivery`. `log` dry-run and `disabled` remain available. Verified with `pnpm --filter @xtiitch/worker check`, `pnpm --filter @xtiitch/worker test`, and `git diff --check` over the worker/docs/migration files. Production still needs an actual provider endpoint/token and message-template approval where the provider requires it.

Uncommitted responsive shell correction: the business dashboard mobile navigation is now a real drawer instead of a horizontal sticky rail, with a compact mobile header, scrollable touch-friendly drawer content, and guarded page/content widths. The admin shell mobile/tablet pass tightens the drawer width, sticky toolbar controls, profile menu width, main content overflow, and long business/user/audit text wrapping so the detail surface owns the viewport cleanly. Verified with `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, `pnpm --filter @xtiitch/admin check`, `pnpm exec eslint apps/dashboard apps/admin --max-warnings=0`, `pnpm --filter @xtiitch/admin build`, and `git diff --check apps/dashboard/app/routes/dashboard.tsx apps/admin/app/routes/admin.tsx agent_plan.md`.

How to run + verify (dev):

- Demo Postgres runs in docker container `xtiitch-demo-pg` on `localhost:5450` (db/owner `xtiitch`/`xtiitch`, app role `xtiitch_app`). Migrations `000001`–`000028` are applied locally.
- The local demo database now contains `operator@xtiitch.com` with the standard local smoke password. On a fresh database, seed it by setting `ADMIN_BOOTSTRAP_EXTRA_USERS_JSON='[{"email":"operator@xtiitch.com","display_name":"Xtiitch Operator","password":"AdminPass123!","role":"operator"}]'` before starting the API.
- Integration tests need `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable`; without it they skip. Run from `apps/api`: `go build ./... && go vet ./... && go test ./...` (currently 23 packages green).
- New migrations: the goose split-file tooling panics on the `.up.sql`/`.down.sql` convention, so apply by hand as the owner: `docker exec -i xtiitch-demo-pg psql -U xtiitch -d xtiitch -v ON_ERROR_STOP=1 < infra/migrations/0000NN_x.up.sql`.

Working conventions (must follow):

- A concurrent contributor owns the storefront catalogue lane. Do **not** stage their in-flight files: `apps/api/internal/adapters/inbound/http/catalogue/public.go` (+`public_test.go`), `apps/api/internal/adapters/outbound/postgres/storefront_repository.go`, `apps/api/internal/application/ports/catalogue.go`, `apps/storefront/app/lib/api.ts`, `apps/storefront/app/routes/design.tsx`. Stage your own files **explicitly** (never `git add -A`).
- Before each commit: confirm no PDF is tracked (`git ls-files | grep -i '\.pdf$'` is empty), and isolation-build the staged tree (`git checkout-index -a --prefix=/tmp/x/ && (cd /tmp/x/apps/api && go build ./... && go vet ./...)`) so the slice is standalone-clean.
- Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`; push with `GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes" git push origin main` (remote `git@github.com:stanleyHayes/xtiitch.git`). Log every shipped slice in the Completed list below and push the docs commit.
- Hard constraints: the two source PDFs are Strictly Confidential — never commit them (gitignored). Never build money-holding/escrow/wallet. Tenant isolation (RLS as `xtiitch_app`) is release-blocking — every new tenant table uses the hardened policy shape + `FORCE ROW LEVEL SECURITY` and is proven cross-tenant in an integration test.

Recommended next slices (additive, low-collision with the contributor):

1. Add business-side promotion controls in the business dashboard/API, limited to each business's own store and business-funded offers.
2. Add automatic subscription billing mechanics: Paystack recurring authorization/webhook reconciliation, grace expiry automation, downgrade rules, and plan-limit enforcement.
3. Configure production notification provider credentials/templates and run an end-to-end provider sandbox smoke for `NOTIFICATION_TRANSPORT=http`.
4. Customer-facing handover/tracking reads and deeper business-user hardening.
5. Start the referral engine on top of the shared promotion-redemption ledger.

## Current Work

- Milestone 1 (Backend Foundation and Money Rails) is complete, including database-enforced tenant isolation: auth/identity, JWT verification + middleware with server-derived tenant scope, refresh-token rotation and logout, the Paystack money rails (subaccount provisioning on verification, the commission split, and idempotent webhook confirmation), and row-level security now actively enforced by the database — all built, unit-tested, and verified end-to-end against Postgres with the dev payment provider.
- Milestone 2 (Catalogue and Storefront) backend is in place: store settings, collections, designs (with images, status lifecycle and unguessable handles), business-defined size bands, per-band pricing, and the public storefront by handle (browse, single design/collection, search) with active-only visibility — all RLS-enforced, unit-tested, and verified end-to-end.
- The `apps/storefront` public storefront (the customer-facing shop over the catalogue API) is built and verified in the browser: store-by-handle with the business's own brand colour, a polished public store header, richer design cards with pricing/custom badges, collection entry points, collection pages with dark editorial framing, listed-size checkout, bespoke request forms for the three measurement routes, a two-panel tracking page, server-side search, SSR + hydration, mobile-responsive, and 404 handling.
- Cloudinary signed image uploads are implemented: the `MediaStore` port is backed by a real Cloudinary signing client (parsed from `CLOUDINARY_URL`, SHA-1 signature over sorted params) and a dev fallback, exposed at `POST /v1/media/design-upload-signature` (protected). The browser uploads directly to Cloudinary and stores only the URL — image bytes never pass through Xtiitch.
- The `apps/dashboard` business app is built and polished: login over the auth API stores tokens in an httpOnly signed cookie session; protected `/dashboard` routes now use focused pages with a fixed animated studio workspace rail, helper labels, live badges, page-specific headers, elevated shared card surfaces, store profile, order metrics, reports snapshot, money desk/manual takings, visit queue management, handover desk, notification log, availability-window management, a richer production board, stage advancement for confirmed orders, customer contact, payment state, a design create/retire/restore studio rail, measurement-field management, visit/shop measurement capture, and role-aware owner/admin versus staff views backed by the signed business-user role claim; logout clears the session.
- Milestone 3 (Ordering, Stages, and Tracking) is started: the production-stage model, the walk-in order path, and the red/yellow/green "where is my cloth?" customer tracking view are built and verified in the browser (an order goes red → yellow → green → fulfilled as the business advances stages). Default stages are seeded per business at registration.
- The online order checkout path is built and security-hardened (see Completed): a customer places a standard order from the storefront, pays the full price over the existing money rails, and the webhook confirmation advances the order to confirmed at its first stage. The storefront design page now contains the live order form and redirects to the provider checkout URL.
- The public marketing UI has received a second polish pass over already-finished surfaces: the home hero now has a live order-path proof panel, shared feature cards are more crafted and less generic, the how-it-works steps read as a connected timeline, sizing/measurement routes use a shared richer component, and trust cards now carry stronger security/numbering treatment.
- The remaining marketing pages have also been polished: the waitlist/contact flow now has a richer guided form and launch-step panel, FAQ opens with quick-answer proof cards, the security money-flow section uses an image-led explainer, and Privacy/Terms use a shared legal-review card system instead of flat text rows.
- The custom (bespoke) order backend is built and security-reviewed (see Completed): all three measurement routes (self-measure, home-visit, come-to-shop), deposit checkout over the existing money rails, self-measure measurement capture, and confirmation at the first bespoke stage via the deposit webhook. The storefront design page now exposes all three customer request routes and validates the no-mutation form edge cases before posting to the API.
- The dashboard orders board is built and verified (see Completed): the API now returns dashboard-ready order summaries with contact, route, channel, payment, settlement, stage, and created-at context; the web dashboard filters standard/custom/draft/confirmed/fulfilled orders and advances only confirmed orders.
- Platform architecture decided 2026-06-15 (see the Platform Architecture section). Done so far: the old combined `apps/web` direction is split into `apps/storefront` (customer) and `apps/dashboard` (business), the storefront resolves a store from its `<handle>.xtiitch.com` subdomain, and the first `apps/admin` operator surface is scaffolded and verified (see Completed). Still to do, in order: finish the remaining admin foundation/operator APIs, then the two mobile apps (customer + business).
- Admin dashboard work has started: `apps/admin` now runs as a standalone React Router + MUI app for `admin.xtiitch.com`, with a redesigned operator login/control-room entry, API-backed admin auth/session handling, permission-backed operator user management, editable role/permission grants, persisted profile/settings/notification preferences, a durable audit log, API-backed business verification decisions, API-backed business list/suspend/reactivate controls, API-backed platform metrics, API-backed money-rails monitoring/replay/settlement-review holds, API-backed subscription lifecycle/invoice/billing-sweep/downgrade controls, API-backed plan-package create/update/archive controls, API-backed promotion controls, API-backed sponsored placement controls, API-backed risk-review close/reopen controls, API-backed support queue assignment/resolution, authenticated CSV exports, derived notifications/reports/health, and a responsive operator rail/drawer.
- The transactional notification outbox now covers order confirmation/fulfilment plus booking confirmation, balance payment, and handover dispatched/completed milestones. The worker-side drain is built with BullMQ, Postgres claiming, retries, dead-lettering, and a dry-run log transport; the worker also runs scheduled subscription billing sweeps for overdue invoices and expired grace windows. Live WhatsApp/SMS provider adapters are still pending.
- Measurement-field management is built end-to-end for the business dashboard/API: businesses can manage their measurement template over protected APIs, and staff can record/upsert visit/shop measurements only for confirmed custom orders on the matching route.
- Next recommended backend features: finish the admin operator foundation first (real operator APIs), then subscription billing, live notification provider transport, customer-facing handover/tracking reads, and deeper business-user hardening. The dashboard now has role-aware owner/admin/staff presentation and route-action guards, plus a first owner/admin Team page backed by protected user-management APIs.
- The backend slices (auth completion, money rails, RLS hardening, catalogue/storefront, Cloudinary, orders/tracking, online checkout, custom orders, balance collection, bookings, handovers, notification outbox/producers), the split storefront/dashboard apps, and the first mock-backed admin app are committed. The current admin auth/user-management/role-management/settings/audit/business-verification/business-management/platform-metrics/money-rails/risk-review/support-control work remains uncommitted in this working tree. The two source PDFs are intentionally left untracked (Strictly Confidential).
- Remote `origin` is configured at `git@github.com:stanleyHayes/xtiitch.git`; push verified local commits with the SSH command in the working conventions.

## Completed

- Reviewed the root product definition and technical specification.
- Confirmed v1 scope: per-business platform, not the phase-two general store.
- Confirmed selected stack and libraries from the project owner.
- Confirmed initial brand colors:
  - Main brand: `#800020`
  - Primary type: `#15111a`
  - Warm background: `#faf6f2`
- Created the initial `agent_plan.md` from the product and technical specification.
- Captured the selected stack, architecture, dependency-injection strategy, milestone sequence, and agent workflow.
- Initialized Git in the project folder.
- Created the first local commit: `docs: add xtiitch agent build plan`.
- Added the requirement for a public marketing website as a first-class app.
- Added design, quality, compliance, scalability, and marketing planning docs.
- Added strict linting and SonarQube quality-gate planning.
- Scaffolded the pnpm monorepo with `apps/api`, `apps/marketing`, `apps/web`, `apps/mobile`, `apps/worker`, and shared packages.
- Added exact current npm package versions for the scaffolded JavaScript/TypeScript packages.
- Added Go API shell using Chi, hexagonal folders, constructor DI, health routes, config, logging, domain primitives, and application ports.
- Added SQL migration baseline for plans, businesses, store settings, business users, global customers, tenant-scoped customer relationships, indexes, and RLS policies.
- Chose Goose for SQL migrations through `go run github.com/pressly/goose/v3/cmd/goose@latest`.
- Added Docker Compose for local PostgreSQL and Redis.
- Added design tokens package with the Xtiitch color palette and starter scale.
- Added BullMQ worker shell.
- Added GitHub Actions check workflow with conditional SonarQube scan.
- Verified `pnpm check`, `pnpm test`, and direct Go coverage tests pass locally.
- Created local foundation commit: `chore: initialize xtiitch monorepo foundation`.
- Added business auth and tenant onboarding application service with constructor-injected ports.
- Added bcrypt password hashing, HS256 custom JWT issuing, random refresh-token generation, and hashed refresh-session persistence.
- Added business owner registration and business login HTTP endpoints under `/v1/auth/business`.
- Added tenant-aware Postgres repositories for business identity creation, credential lookup, and auth-session storage.
- Added `auth_sessions` migration with tenant RLS policy and indexes.
- Added Auth API documentation and auth-boundary notes in the tenant isolation guide.
- Added API tests for registration/login use cases, HTTP auth handlers, request decoding, and JWT claims.
- Added a bounded API race coverage command with `-timeout=45s` so CI and local quality gates fail loudly instead of hanging.
- Verified `pnpm check` and `pnpm test` pass locally after the auth slice.
- Completed the public marketing website shell with React Router SSR, MUI theme, navigation, footer, SEO metadata, sitemap, favicon, and Vercel-ready build scripts.
- Added a polished image-led home hero using the Xtiitch brand palette and a generated Ghanaian fashion atelier asset saved under `apps/marketing/public/images`.
- Completed the authentication loop: JWT access-token verification (signature, exp, issuer, audience, `typ=access`), an Authenticator middleware that derives the tenant scope server-side from the token and exposes a `Principal` in context, a protected `GET /v1/auth/business/me`, refresh-token rotation (`/auth/business/refresh`, single-use: presented session revoked, new pair issued), and idempotent logout (`/auth/business/logout`). Added Postgres `FindByRefreshTokenHash` (joins the user for live role/active state) and tenant-scoped `Revoke`. 16 new tests plus an end-to-end run against Postgres covering register → me → refresh → old-token-rejected → logout → refresh-fails → duplicate-handle-409.
- Hardened the committed auth foundation: duplicate store handle now returns 409 `handle_taken` (was an opaque 500), login equalises password-hash timing on unknown/inactive users to resist account enumeration, and registration rejects passwords over bcrypt's 72-byte limit.
- Built the Milestone 1 Paystack money rails. Migration `000003` adds `payments` and `manual_takings` (tenant-scoped with RLS) and a `payment_provider_events` idempotency ledger. The money domain computes the commission split in GHS pesewas (`amount * bps / 10000`, floored) and resolves the deposit by strict override→store-default→floor precedence with the GHS 100 hard floor. A `PaymentProvider` port is implemented by a real Paystack HTTP client (subaccount, transaction/initialize with `transaction_charge` split, HMAC-SHA512 webhook verification) and by a `DevProvider` used when no live key is configured — the dev provider stubs outbound HTTP but performs real signature verification and event parsing, so the money path runs locally and in tests. The payments service provisions a subaccount on verification, gates charging until verified, raises a split charge recording an `initiated` payment, and advances it to `succeeded`/`failed` only via a verified, idempotent webhook. HTTP surface: `POST /v1/businesses/me/verify`, `POST /v1/payments/checkout`, `GET /v1/payments` (all protected) and `POST /v1/webhooks/paystack` (signature-verified). Verified end-to-end against Postgres: checkout is gated before verification (409), the 3% free-plan commission is computed and recorded, a re-delivered webhook is deduped to one event with no double-apply, a tampered signature is rejected (401), and a second business sees none of the first's payments.
- Verified `go build`, `go vet`, `gofmt`, and `go test ./...` all pass for the API after the auth-completion and money-rails slices.
- Hardened tenant isolation at the database layer (migration `000004`). Because the Docker `xtiitch` owner is a superuser (superusers bypass RLS even with `FORCE`), the API now connects as a dedicated non-superuser, non-`BYPASSRLS` role (`xtiitch_app`); migrations still run as the owner. Every tenant policy was rewritten to add an explicit `xtiitch.bypass` escape used only by the three legitimately cross-tenant credential lookups (login by handle, refresh by token hash, webhook lookup by provider reference); all other access must set the tenant scope. `FORCE ROW LEVEL SECURITY` is set on all seven tenant tables as belt-and-suspenders. Verified end-to-end as `xtiitch_app`: the full register/login/refresh/verify/checkout/webhook flow still works, and direct `psql` checks show a missing scope returns zero rows (fail-closed) on payments, businesses and auth_sessions, each tenant context sees only its own rows, and one business reading another's row by id returns nothing. The migration's down path restores the prior policies and drops the role. Follow-up: provision the app role's credentials through infrastructure rather than the committed dev password.
- Built the Milestone 2 catalogue and storefront backend. Migration `000005` adds `collections`, `designs` (image array + active/retired/deleted lifecycle), `size_bands`, and `design_prices`, all tenant-scoped under the same hardened RLS shape (bypass clause + `FORCE`, with the app-role grant). A `catalogue` domain provides the three-state status lifecycle and unguessable handle generation (slug + random token). The catalogue service manages store settings, collections, designs (create/update/retire/restore/delete), size bands, and per-band pricing, and the storefront service resolves a public store by handle and returns only active designs/collections plus single-design, single-collection, and search views. HTTP surface: protected dashboard CRUD under `/v1` and the account-free public storefront (`/v1/public/stores/{handle}`, `/v1/public/stores/{handle}/search`, `/v1/public/designs/{handle}`, `/v1/public/collections/{handle}`). Added a port-level `ErrNotFound` so a missing record maps to 404. Verified end-to-end against Postgres as the app role: a business builds a store (settings, size band, collection, priced design), a public visitor browses it with no account, a per-design deposit override below the GHS 100 floor is rejected (400), retiring a design removes it from every public surface, search finds an active design by title, an unknown store returns 404, and a second business sees none of the first's catalogue (with a direct fail-closed RLS check on the catalogue tables). The migration's down path drops the catalogue tables cleanly.
- Verified `go build`, `go vet`, `gofmt`, and `go test ./...` (10 packages) all pass for the API after the RLS-hardening and catalogue/storefront slices.
- Added Cloudinary signed image uploads. A `cloudinary` adapter parses `CLOUDINARY_URL` and signs direct browser-to-Cloudinary uploads using the provider's algorithm (parameters sorted by key, joined `key=value` with `&`, secret appended, SHA-1 hex), scoped to a per-business folder; a dev fallback runs without a Cloudinary account. A thin `media` service and a protected `POST /v1/media/design-upload-signature` endpoint return the signature payload so the dashboard can upload images directly to Cloudinary and store only the URL on a design — image bytes never pass through the platform. Unit-tested (signature parity with the algorithm, URL parsing, scoped payload). `go test ./...` is 11 packages green.
- Built the `apps/web` public storefront — the customer-facing shop — as a React Router v7 + MUI SSR app reusing the marketing app's proven Emotion/Vite setup (single Emotion instance, critical-CSS extraction via `renderToPipeableStream` + `onAllReady`, dependency pre-bundling). Server-side loaders call the Go public catalogue API (`XTIITCH_API_URL`). Routes: a minimal home, `store/:handle` (the business's own brand colour applied to the header, design grid with GHS price labels, server-side search), `d/:handle` (gallery, sizes-and-prices table, an honest "ordering coming soon" note since the order flow is Milestone 3), `c/:handle`, and a 404. Verified the full stack in the browser (Postgres → Go API seeded with a store → web): the store renders with its brand colour, designs show with prices and a clean no-image fallback, the design page and search work, the page hydrates, mobile is responsive, and unknown stores/designs return 404. `tsc` and ESLint are clean and the production build passes.
- Built the `apps/web` business dashboard. Login posts to `/v1/auth/business/login` and stores the access + refresh tokens in an httpOnly, signed cookie session (`createCookieSessionStorage`); a small `apiFetch` helper attaches the bearer token and redirects to login on a missing or rejected token. A protected `/dashboard` route loads the store profile via a new `GET /v1/businesses/me` (name, handle, plan, verification) and the owner's designs, with form actions to create a design and retire/restore one, plus logout. All actions are progressively-enhanced form posts. Added the `businesses/me` profile endpoint to the catalogue handler/service and a `GetProfile` to the store-settings repository. Verified end-to-end in the browser: log in → dashboard shows the profile and designs → create a design (it appears) → retire it (it leaves the public storefront) → log out → `/dashboard` redirects back to login. `tsc`, ESLint, and the production build are clean.
- Started Milestone 3 with the production-stage tracking heart. Migration `000006` adds `orders`, `stage_templates`, and `stage_events` (tenant-scoped under the hardened RLS shape); default stages for both flows are seeded per business at registration (ready-made: Order placed/Preparing/Ready·delivered; bespoke: Order received/Being made/Ready for fitting/Ready·delivered), each tied to a red/yellow/green colour. An `order` domain provides classification (standard vs custom → ready-made vs bespoke flow) and the colour model. The order service + repository support the walk-in order path (create the customer and a confirmed order at the first stage in one transaction), listing, advancing the order to the next stage (fulfilled at the last), and a public tracking read keyed by the unguessable order reference (cross-tenant by credential, via the RLS bypass). HTTP: protected `POST /v1/orders`, `GET /v1/orders`, `POST /v1/orders/{id}/advance`, and the account-free `GET /v1/public/orders/{id}`. The `apps/web` storefront gained a colour-led, accessible `track/:orderId` page (colour + icon + word, never colour alone). Verified end-to-end against Postgres and in the browser: a walk-in order starts red ("Order placed"), advances to yellow ("Preparing") then green ("Ready / delivered") then fulfilled, with the tracking page reflecting each step. `go test ./...` is 13 packages green; the migration's down path reverses cleanly.
- Built the online checkout → payment → order-confirmation coupling. A new `checkout` application service places a standard order from the public storefront: it resolves the store by handle, gates on the business being verified for payments, validates that the chosen design and size band belong to that store, records a `draft` online order, and raises the full price over the existing money rails with the order linked to the payment (`payments.order_id`). The public design API now includes the store summary, and the `apps/web` design page has a live order form for size, customer contact, and payment method; successful submission redirects to the provider checkout URL, with tracking available after confirmation. The Paystack webhook then confirms the linked order — on a genuine `initiated → succeeded` transition it advances the order to `confirmed` at its first stage and credits `settled_minor`, atomically in the same transaction. HTTP: the account-free `POST /v1/public/stores/{handle}/orders`. Migration `000007` adds a composite `(order_id, business_id)` foreign key so a payment can only ever reference an order of its own business — a database backstop independent of the application and RLS.
- Ran an adversarial review of the money/tenant coupling and fixed four confirmed high-severity findings. (1) Order confirmation is now gated on the payment's own `initiated → succeeded` UPDATE affecting exactly one row, not on the inbound event flag, so a `charge.success` arriving after a `charge.failed` can never settle an order whose payment is failed. (2) The webhook's cross-tenant RLS bypass is now cleared the moment the tenant is known, so every money-mutating write runs under real row-level security forced to that one business. (3) The order confirmation is additionally constrained to the payment's business in SQL and by the new composite FK, so a stray cross-tenant `order_id` settles nothing. (4) A checkout whose charge cannot be raised now compensates by discarding the just-created draft order, so no un-payable draft accumulates. Checkout and payment-method validation tests cover invalid inputs, unavailable bands, unverified stores, compensation on charge failure, and the happy charge path. Verified against Postgres as the `xtiitch_app` role with regression tests: the failed-then-success scenario leaves the order draft and unsettled, the happy path confirms and settles exactly once and is idempotent on redelivery, and the database rejects a cross-tenant payment link. `go vet`, `go test ./...`, `pnpm --filter @xtiitch/web check`, `pnpm --filter @xtiitch/web build`, `pnpm check`, `pnpm lint`, and `pnpm test` are green.
- Built the custom (bespoke) order backend, reusing the money rails, the verified-business gate, the hardened confirm-on-payment webhook, and the per-business-seeded bespoke stages. The `checkout` service gained `PlaceCustomOrder` covering all three measurement routes behind `POST /v1/public/stores/{handle}/custom-orders`: self-measure (records a `draft` bespoke order with the customer's measurements and raises a deposit), home-visit (draft + deposit, measurements taken later), and come-to-shop (confirmed at the first bespoke stage immediately, with no online payment). The deposit is `money.ResolveDeposit(design override → store default → GHS 100 floor)` charged with purpose `deposit`; the order stays `draft` so the unchanged webhook confirms it at the first bespoke stage and credits `settled_minor`. Migration `000008` adds tenant-scoped `measurement_fields` and `order_measurements` (jsonb values) under the project's RLS bypass-clause + FORCE shape, with a composite `(order_id, business_id)` FK mirroring `000007` so a measurement can never bind another tenant's order. Self-measure keys are validated against the business's own fields in the same tenant-scoped transaction (fail closed), values are trimmed and required non-blank, and a fail-fast guard rejects a custom order when the business has no bespoke stages (so a deposit can never strand an unconfirmable order). The storefront query now exposes the store-default deposit; registration seeds a default set of bespoke measurement fields so self-measure works out of the box. The whole slice is backend-only (the storefront form is the frontend contributor's).
- Reviewed the custom-order slice with a 21-agent adversarial workflow (money, tenant-isolation, webhook, measurement, edge-case, and contract dimensions, each finding triple-verified). It confirmed a single low-severity gap — self-measure validated measurement keys but not values, so a blank value could be charged and confirmed — now fixed by trimming and requiring non-blank values. No money or tenant-isolation defects were found. Verified against Postgres as the `xtiitch_app` role: a self-measure deposit confirms the bespoke order at its first (red) stage and credits the deposit, an unknown measurement key rolls the order back, come-to-shop confirms with no payment, the no-bespoke-stages guard fires, discard removes the measurement/order/customer, and the composite FK rejects a cross-tenant measurement. `gofmt`, `go vet`, and `go test ./...` (15 packages) are green and migration `000008` reverses cleanly.
- Built the dashboard orders board. The protected `GET /v1/orders` summary now includes order type, size route, channel, customer phone/email, settled amount, latest payment status/purpose/amount, and creation time, all from the tenant-scoped Postgres repository. `POST /v1/orders/{id}/advance` now rejects draft, fulfilled, or stage-less orders with a 409 `order_not_advanceable` instead of letting unpaid draft orders move through production stages. The `apps/web` dashboard now loads orders beside the profile and design list, shows live metrics, filters all/standard/custom/awaiting payment/in studio/fulfilled orders, displays customer contact and payment progress, and advances only confirmed orders. Added order HTTP contract tests plus a real-Postgres integration test for the dashboard summary. Verified with `go test ./...`, `go vet ./...`, `pnpm --filter @xtiitch/web check`, `pnpm --filter @xtiitch/web build`, `pnpm lint`, `pnpm check`, and `pnpm test`.
- Split `apps/web` into two independently deployable apps per the platform architecture: `apps/storefront` (`@xtiitch/storefront`, the customer shop — home/store/design/collection/track, for `<handle>.xtiitch.com`) and `apps/dashboard` (`@xtiitch/dashboard`, the business app — login + dashboard, for `app.xtiitch.com`, its index redirecting to `/dashboard`). Each keeps only the routes and lib it needs; git tracked the moves as renames so history follows the files. Both typecheck, build, lint (`--max-warnings=0`), and run against the existing API with no behaviour change. Committed as `ee8d8d8`.
- Made the storefront resolve a business from its `<handle>.xtiitch.com` subdomain (dev: `<handle>.localhost:3100`): the home route reads the `Host` header, takes the subdomain label as the handle, and renders that store, replacing `/store/:handle` as the primary entry while keeping the legacy path working. The apex, `www`, and reserved labels (`app`/`admin`/`api`/`store`/`dashboard`) show the generic landing; an unknown subdomain 404s; the store header now reads `<handle>.xtiitch.com`. The store page was extracted into a shared `StoreView` used by both entries, Vite `allowedHosts` accepts `*.localhost`/`*.xtiitch.com`, and the API now refuses reserved labels as business handles at registration (with a unit test). Verified in the browser at `demo-atelier.localhost:3100`. Committed as `1c8c3bb`.
- Started the standalone admin app for platform operators. `apps/admin` is a React Router + MUI SSR app for `admin.xtiitch.com`, with a polished operator login/control-room entry, local protected operator login, a dense admin shell, platform metrics, KYC/payment-verification queue with approve/reject decisions, business search/filter with suspend/reactivate controls, money-risk review cards, and support triage. This is intentionally frontend/mock-backed until backend admin users, roles, audit logging, and real operator APIs are built. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm --filter @xtiitch/admin build`, `pnpm exec eslint apps/admin --max-warnings=0`, and route smoke checks (`/login` 200 with the redesigned entry, `/admin` redirects unauthenticated, logged-in `/admin` 200 with a single doctype).
- Expanded the admin operator surface beyond the first shell: verification cases now include evidence and operator notes plus approve/reject/hold decisions; businesses can be inspected in a side panel with subaccount, plan, GMV, commission, and tenant-safe actions; a new Money Rails section tracks webhook events, safe replay queues, payout settlement, commission, and holds; support tickets can be assigned/unassigned; risk reviews can be closed/reopened; and a new Audit Log section records local operator actions with severity filtering. Verified with `pnpm --filter @xtiitch/admin check`, `pnpm --filter @xtiitch/admin build`, `pnpm exec eslint apps/admin --max-warnings=0`, and live route smoke checks for the expanded admin navigation. Committed after the first admin shell as a separate follow-up feature.
- Built custom-order balance collection, completing the deposit→balance money lifecycle. A business finalises a confirmed custom order's price with `POST /v1/orders/{id}/agreed-total` (only a confirmed custom order, never below what is already settled) and collects the outstanding balance with `POST /v1/orders/{id}/balance`, which raises a split charge (`purpose='balance'`) for `agreed − settled` over the existing rails. The webhook now branches on payment purpose: a `balance` success credits `settled_minor` without changing the production stage, capped at the agreed total. Adversarially reviewed (26 agents) — it confirmed one high-severity money bug: a double-submit could charge the customer twice while the ledger cap hid the over-collection. Fixed three ways: migration `000009` adds a partial unique index so at most one balance charge is ever in flight per order (race-proof), `CollectBalance` refuses when a balance is already pending, and `SetAgreedTotal` refuses to re-price while a balance is in flight. Verified against Postgres as `xtiitch_app`: the balance credits once and is idempotent, settlement is capped at the agreed total, a second in-flight balance is rejected by the index, agreed-total validation holds, and reads/writes are tenant-scoped. `gofmt`, `go vet`, `go test ./...` (17 packages) are green; migration `000009` reverses cleanly.
- Built the home-visit bookings backend as a purely additive feature (the `/custom-orders` contract and the in-flight storefront form are untouched). Migration `000010` adds `availability_windows` (recurring weekly), a `bookings` table where a row IS the slot reservation, a partial unique index on `(business_id, slot_start)` over held/booked rows so two customers can never double-book, composite same-tenant FKs (`bookings`→`orders`, `payments`→`bookings`), and the `home_visit_enabled`/`business_timezone` store-settings columns. A `booking` domain enumerates bookable slots from weekly windows (honouring slot length, lead time, and timezone); an `availability` service defines windows and lists a store's open slots; and `checkout.PlaceHomeVisitBooking` validates the slot is open, records a draft bespoke order, holds the slot atomically, and raises a booking-deposit split charge carrying both order and booking ids (compensating on a failed-to-raise deposit). The webhook now branches on `purpose='booking_deposit'`: a genuine success books the held slot and confirms the draft order at its first bespoke stage; a failure releases the slot and cancels the draft — still gated on the payment's own transition and idempotent. HTTP: `GET /v1/public/stores/{handle}/availability`, `POST /v1/public/stores/{handle}/bookings`, `POST /v1/availability/windows`, `GET /v1/availability`. Verified as `xtiitch_app`: 8 concurrent holds of one slot leave exactly one winner, a deposit books slot+order idempotently, a failed deposit frees the slot for re-holding, compensation removes everything, and the composite FK rejects a cross-tenant booking. Full suite (19 packages) green; `000010` reverses cleanly. Committed as `20116f9`. Deferred: availability exceptions, reschedule/cancel, the abandoned-hold expiry sweeper, and DST-correct non-Accra timezones.
- Built the home-visit bookings backend (additive — the `/custom-orders` contract is untouched). A business publishes recurring weekly availability windows; a customer books a visit at `POST /v1/public/stores/{handle}/bookings`, which validates the requested slot is open, records a draft `home_visit` order, atomically HOLDS the slot, and raises a booking deposit (`purpose='booking_deposit'`). The deposit webhook books the held slot and confirms its order at the first bespoke stage; a failed deposit releases the slot. The no-double-book guarantee is migration `000010`'s partial unique index on `bookings(business_id, slot_start)` over held/booked rows — a second concurrent hold fails with `ErrSlotTaken`. Endpoints: public `GET …/availability` (derived open slots) + `POST …/bookings`, and dashboard `POST /v1/availability/windows` + `GET /v1/availability`. Composite same-tenant FKs (`bookings.order_id`, `payments.booking_id`) and the RLS bypass-clause shape back the tenant isolation; `booking.EnumerateSlots` is a pure, timezone-threaded slot deriver. Adversarially reviewed (21 agents): the confirmed high finding — an abandoned hold blocked its slot forever — is fixed by lazy expiry (availability ignores stale holds and the next hold reclaims them, no background sweeper), plus overlapping-window rejection and dropping an unenforced gate. Verified as `xtiitch_app` against Postgres: an 8-way concurrent double-book resolves to exactly one winner, deposit confirm/release + idempotency hold, a stale hold is reclaimable, compensation removes the held booking/order/customer, and the composite FK rejects a cross-tenant booking. `go test ./...` (19 packages) is green; migration `000010` reverses cleanly. Deferred: cancel/reschedule, one-off availability exceptions, and customer-facing booking management.
- Built the money tracker so a business sees its full income. Manual takings log off-platform sales (cash/momo/other) that carry no commission and move no money — Xtiitch never touches them. The income summary aggregates succeeded through-platform payments and their commission with the off-platform takings; net income = through-platform − commission + manual takings, in GHS pesewas. HTTP (authenticated, tenant-scoped): `POST /v1/money/takings`, `GET /v1/money/takings`, `GET /v1/money/summary`, reusing the `manual_takings` table (`000003`) and its RLS. Verified as `xtiitch_app`: the summary counts only the business's own succeeded through-platform payments and takings (an initiated/failed payment and another tenant's money never count), a logged taking carries no commission, and net = through − commission + takings. Committed as `bd025f3`; full suite (19 packages) green. The local commits are now pushed to `git@github.com:stanleyHayes/xtiitch.git` (`main`).
- Completed the home-visit booking lifecycle with business-only management (customers get a call-the-business action, not a self-serve API). `GET /v1/bookings` is the dashboard visit queue (held/booked first, then by slot, with customer/design/slot/status/address); `POST /v1/bookings/{id}/cancel` cancels a held or booked visit and frees its slot (the cancelled row drops out of the active-slot unique index); `POST /v1/bookings/{id}/reschedule` validates the new slot is open, then atomically marks the old booking `rescheduled` and inserts a new `booked` row (carrying the same order, customer, deposit, address) at the new slot — the insert hits the no-double-book index, so a taken target fails with `ErrSlotTaken` and the source is left intact; only booked visits reschedule. A `bookingapp` service validates the target slot via the availability use case before the one-transaction move. Verified as `xtiitch_app`: cancel frees the slot for re-holding (missing booking → clean not-found), reschedule moves atomically + carries context + rejects a taken target while leaving the source booked + refuses non-booked, and the queue is tenant-scoped. Committed as `92af171` and pushed; full suite (20 packages) green.
- Extended the order lifecycle past production with fulfilment handovers: once an order is `fulfilled`, a handover tracks the last leg — pickup (customer collects) or delivery (business sends to an address) — as logistics state only; Xtiitch never holds funds, so no delivery fee is escrowed here. `POST /v1/handovers` arranges one for a fulfilled, tenant-owned order (409 `invalid_order_state` / 404 otherwise), requires an address for delivery (400), and allows only one open handover per order (409 `handover_in_progress`, race-proof via a partial unique index over pending/dispatched rows). `GET /v1/handovers` is the queue (open first, then most-recent) with order/customer/design context. `POST /v1/handovers/{id}/advance` moves one step forward — pickup → completed; delivery → dispatched → completed — derived from method+status and guarded on the current status (terminal can't advance; a concurrent change is a clean conflict). `POST /v1/handovers/{id}/cancel` cancels an open handover, freeing the order to re-arrange. The `delivery` domain owns the method/status rules (pure, unit-tested); a `deliveryapp` service applies them; migration `000011` adds `handovers` with the one-open index, a same-tenant composite FK to orders, a `dispatched`-only-for-delivery check, and the hardened RLS shape. Verified as `xtiitch_app`: fulfilled-order gate (rejects confirmed, 404s a missing order), one-open guarantee, full advance path with the stale-from guard, the pickup-never-dispatched DB check, cancel-frees-order, tenant-scoped queue, and cross-tenant rejection. Committed as `50bf4cb` and pushed; full suite (22 packages) green. Deferred: a customer-facing handover/tracking read and any delivery-fee charge (would reuse the existing payment rails, never escrow).
- Built the transactional notification outbox so the two customer-facing order milestones become durable, deduplicated message intents. Each lifecycle change writes an `outbound_messages` row in the SAME transaction as the state change, so a confirmed/fulfilled order always has its message recorded and a message is never recorded for a change that rolled back. The platform transport (the existing BullMQ worker) drains the outbox and sends over WhatsApp/SMS out of band — the outbox is never on the send path and moves no money. Migration `000012` adds `outbound_messages` with a unique `(business_id, dedup_key)` index (idempotent enqueue), a partial due-index for the transport, and the hardened RLS shape. A payment that confirms an order enqueues `order_confirmed`; an order reaching its final stage enqueues `order_fulfilled` — both via a package-private helper that inserts `ON CONFLICT DO NOTHING`, joining the customer's phone (`AdvanceStage`'s stage-move switch was extracted to `advanceOrFulfil` to stay under the complexity limit). `GET /v1/notifications` is the business's own tenant-scoped message log. The `notification` domain owns the channel/kind vocabulary and the dedup key (pure, unit-tested). Verified as `xtiitch_app`: confirming an order enqueues exactly one `order_confirmed` for the customer's phone and a redelivered webhook adds nothing; reaching the final stage enqueues `order_fulfilled`; a business reads only its own log. Committed as `3190b8a` and pushed; full suite (23 packages) green; the money-path producer edits regress nothing. Deferred: the worker-side drain/send (TS/BullMQ), more event kinds (booking/handover/balance), and per-message delivery state transitions.
- Expanded the transactional notification producers so the already-built outbox now records every current customer milestone: booking-deposit success enqueues `booking_confirmed`, balance payment success enqueues `balance_paid`, and delivery/pickup handover transitions enqueue `handover_dispatched` and `handover_completed`. All producers run inside the same database transaction as the state change and use the existing `(business_id, dedup_key)` outbox idempotency contract. Verified as `xtiitch_app`: booking, balance, and handover events enqueue the expected pending WhatsApp messages, existing balance idempotency still holds, and tenant-scoped notification reads still pass. `go build ./...`, `go vet ./...`, and `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./...` are green. Committed as `49f9b57`. Deferred: worker-side drain/send and delivery-state transitions.
- Built the worker-side notification outbox drain in `apps/worker`. A repeatable BullMQ job (`drain-notification-outbox` on `xtiitch.outbox`) claims due `outbound_messages` rows with `FOR UPDATE SKIP LOCKED` under the transport RLS bypass, leases them as `sending`, calls an injectable notification sender, marks successes `sent`, and returns failures to `pending` with exponential backoff until `OUTBOX_MAX_ATTEMPTS`, then `dead`. Added exact latest `pg@8.21.0` and `@types/pg@8.20.0`, worker unit tests for success/retry/dead-letter behaviour, and local runbook notes. Verified with `pnpm --filter @xtiitch/worker check`, `pnpm --filter @xtiitch/worker test`, `pnpm exec eslint apps/worker --max-warnings=0`, a staged-tree offline install/check/test/lint, and a live Postgres smoke that inserted one due message, drained it, and observed `status='sent'`/`attempts=1`. Committed as `8515da3`. Deferred: live WhatsApp/SMS provider transport, templates, and provider delivery IDs.
- Built the measurement management backend for bespoke orders. Added a `measurement` application service, protected field-management endpoints (`GET/POST/PATCH/DELETE /v1/measurement-fields`), and staff measurement capture at `POST /v1/orders/{id}/measurements`. Recording is tenant-scoped, validates submitted field ids against the business's own `measurement_fields`, only accepts staff sources `visit`/`shop`, requires the order to be a confirmed custom order on the matching route (`home_visit`/`come_to_shop`), and upserts one measurement row per order while preserving the original measurement id. Verified with service unit tests, Postgres integration tests for tenant scoping/duplicate sequence/route rejection/unknown fields/upsert, `go build ./...`, `go vet ./...`, a full `XTIITCH_TEST_DATABASE_URL=postgres://xtiitch_app:xtiitch_app@localhost:5450/xtiitch?sslmode=disable go test ./...`, and a staged-tree build/vet/full-test isolation run. Committed as `d469cfb`. Deferred: dashboard UI controls for field management and visit/shop entry.
- Polished the business dashboard end to end in `apps/dashboard`. The rough app shell is replaced by a branded owner login, Manrope product typography, a sticky workspace rail, a dark command-room summary, denser metric cards, a redesigned production board, improved order cards with payment/contact/stage context, a richer design studio, measurement-field CRUD, and inline visit/shop measurement capture for eligible confirmed custom orders. Also fixed the dashboard SSR response so it emits a single `<!DOCTYPE html>` and refreshed Vite optimized deps for the new MUI surface. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, a staged-tree offline install/check/lint/build, and live route smoke checks for `/login` (200, single doctype) and `/dashboard` (302 to `/login` without a session). Committed as `e21d39e`. Deferred: dedicated dashboard panels for money tracker, bookings, handovers, notifications, and availability windows.
- Added the dashboard operations panels in `apps/dashboard`: loader/action wiring and polished MUI surfaces for money summary/manual takings, booking reschedule/cancel, pickup/delivery handover arrange/advance/cancel, outbound notification log, and weekly availability-window replacement. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, live `/login` and `/dashboard` smoke checks, and a staged-tree offline install/check/lint/build. Committed as `d634071`. Deferred: reporting/analytics and reminder triage.
- Added the dashboard reporting snapshot in `apps/dashboard`: a full-width reports panel derives seven-day recorded income, collection and completion percentages, stage throughput bars, and a follow-up radar from already-loaded orders, manual takings, bookings, handovers, and notifications. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, authenticated live `/dashboard` smoke on the local API/demo login, and a staged-tree offline install/check/lint/build. Committed as `1041db1`. Deferred: role-aware permissions and staff task views.
- Added the dashboard role-aware task view in `apps/dashboard`: the loader now reads `/auth/business/me`, owner/admin sessions fetch and render management reports, money, catalogue, measurement setup, and availability controls, while staff sessions fetch only task-needed production/measurement/visit/handover/message data, zero order money details, and see a staff task queue. Dashboard route actions now reject management-only intents for staff even if a hidden form is posted manually. Seeded the active local demo database with owner/admin/staff users and updated `credentials.txt` for the current localhost ports. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, API role-claim checks for owner/admin/staff, live dashboard smokes proving staff gets `Staff task queue` without money/reporting/catalogue/settings labels while owner keeps reports and money, and a staged-tree offline install/check/lint/build. Committed as `9fc1b06`. Deferred: backend business-user invite/role-management APIs and service-level role enforcement beyond the dashboard policy.
- Split the business dashboard into routed workspace pages in `apps/dashboard`: `/dashboard` remains the manager overview or staff task queue, and management work now lives at `/dashboard/reports`, `/dashboard/orders`, `/dashboard/money`, `/dashboard/visits`, `/dashboard/handovers`, `/dashboard/catalogue`, `/dashboard/measurements`, `/dashboard/availability`, and `/dashboard/messages`. Staff navigation and loader access exclude management-only pages, and staff attempts to open money/reporting redirect back to `/dashboard`. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, authenticated owner/staff live route smokes, and a staged-tree offline install/check/lint/build. Committed as `1771047`.
- Polished the routed business dashboard workspace in `apps/dashboard`: added route-specific page metadata and dark headers, replaced the old side rail with a cleaner active-state workspace rail, strengthened metric cards, and made the owner/admin overview a practical launchpad into Reports, Orders, Money, Visits, Handovers, and Catalogue while staff keep the scoped task landing page. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, authenticated owner/staff live smoke checks for overview/reports/money/staff redirects, and a staged-tree offline install/check/lint/build. Committed as `4537ae1`.
- Polished navigation rails across `apps/admin`, `apps/dashboard`, and `apps/storefront`: admin now has a fixed desktop operator rail with mobile sticky navigation, counters, active-state accents, and rail/content/card animation; business dashboard rails are fixed on desktop with the same reduced-motion-safe entry treatment; storefront has a customer-appropriate fixed browse/search rail on desktop, sticky mobile browsing bar, and animated design cards. Verified with Prettier, `pnpm --filter @xtiitch/admin check`, `pnpm --filter @xtiitch/dashboard check`, `pnpm --filter @xtiitch/storefront check`, `pnpm exec eslint apps/admin apps/dashboard apps/storefront --max-warnings=0`, production builds for all three apps, live route smokes for admin/business/storefront rails, and a staged-tree offline install/check/lint/build. Committed as `acd19d0`.
- Corrected the non-admin sidebars in `apps/dashboard` and `apps/storefront`: admin was intentionally left alone; the business dashboard rail became a darker fixed studio rail with nav helper text, live badges, stronger active states, and mobile sticky overflow, while the storefront rail became a fuller customer shopping rail with branded store identity, search, store signals, service status, and browse/about actions. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm --filter @xtiitch/storefront check`, `pnpm exec eslint apps/dashboard apps/storefront --max-warnings=0`, production builds for both apps, live authenticated business and demo storefront smoke checks, and a staged-tree offline install/check/lint/build. Committed as `8ee7192`.
- Polished the customer-facing storefront surfaces in `apps/storefront`: the store header now carries proof metrics, design cards show stronger image overlays and descriptions, empty states are styled, the collection page has a dark editorial hero plus collection signals, and the tracking page is now a two-panel status/progress experience. Verified with Prettier, `pnpm --filter @xtiitch/storefront check`, `pnpm exec eslint apps/storefront --max-warnings=0`, `pnpm --filter @xtiitch/storefront build`, live smokes for the demo store, collection, and tracking routes using local demo records, and a staged-tree offline install/check/lint/build. Committed as `b559c71`.
- Polished the shared business dashboard card language in `apps/dashboard`: the base `Panel`, `MetricCard`, `MiniStat`, `InfoStrip`, overview room cards, today's focus panel, and empty states now have warmer surfaces, stronger depth, tone-aware borders, hover motion, and clearer icon treatments that propagate across routed manager and staff pages. Verified with Prettier, `pnpm --filter @xtiitch/dashboard check`, `pnpm exec eslint apps/dashboard --max-warnings=0`, `pnpm --filter @xtiitch/dashboard build`, authenticated live owner/staff route smokes for overview/money/reports/tasks, and a staged-tree offline install/check/lint/build. Committed as `efb0a64`.
- Added marketing pages for Home, Features, How it works, Pricing, For customers, Security, FAQ, Contact, Privacy, and Terms.
- Added a product-preview band showing the storefront/dashboard/order workflow without claiming unsupported features beyond the v1 scope.
- Added waitlist lead capture with server-side Zod validation, consent checkbox, anti-spam honeypot, webhook or Resend delivery support, and honest no-sink error behavior.
- Added marketing waitlist tests with Node test runner through `tsx`.
- Fixed marketing SSR so responses emit a single `<!DOCTYPE html>`.
- Verified the marketing route returns `200`, waitlist no-sink behavior is explicit, and desktop screenshot captures show the first viewport and next band.
- Verified `pnpm check`, `pnpm test`, and `pnpm --filter @xtiitch/marketing build` pass locally after the marketing slice.
- Redesigned the home page `What businesses get` section so it no longer squeezes a dashboard mock into the layout; it now presents an editorial atelier image, business workflow steps, storefront/order/customer signals, and customer-facing status chips.
- Verified the redesigned marketing section in desktop and mobile Chrome screenshots.
- Redesigned the shared marketing navbar and footer with stronger brand presence, active navigation states, a polished mobile drawer, footer proof points, route groups, and a footer CTA panel.
- Verified the redesigned navbar, mobile drawer, desktop footer, and mobile footer in Chrome screenshots.
- Redesigned and polished the full public marketing surface while preserving the approved content: Fraunces display headings, Manrope UI/body typography, richer shared section primitives, page-specific hero icon watermarks, polished feature/pricing/customer/security/legal/contact pages, and a simplified hero panel with no squeezed fake dashboard rows.
- Verified the full marketing redesign with Chrome screenshots, `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, `pnpm check`, and `pnpm test`.
- Redesigned the home hero proof strip from three quiet stat boxes into a connected proof rail with icons, a brand gradient rule, light background texture, stronger hierarchy, and red/yellow/green status chips while preserving the original proof copy.
- Verified the proof-strip redesign with desktop Chrome screenshots, `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, and `pnpm lint`.
- Refined the shared marketing page hero artwork by removing the black illustrative card, placing the page-specific icon watermark directly on the cream grid, slightly darkening the icon, and keeping only the small brand stitch marks.
- Verified the shared page-hero refinement with a desktop Chrome screenshot, `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, and `pnpm lint`.
- Replaced the slanted marketing background language: alternate sections now use a straight stitch-grid/dot texture, the home proof-strip cards use straight textile patches instead of oversized angled watermark silhouettes, and the How-it-works hero watermark changed from a slanted chart to a checklist icon.
- Verified the replacement background direction with desktop Chrome screenshots, `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, and `pnpm lint`.
- Added the first marketing animation layer without adding dependencies: global keyframes, reduced-motion safeguards, shared button/card/link motion, home hero entrance, subtle textile drift, proof-strip staging, reusable grid/list/card lift effects, page-hero watermark float, tracking-status pulse, and footer/header micro-interactions.
- Verified the animation pass with `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, `pnpm lint`, and a `200 OK` smoke check on the running marketing home route.
- Polished the marketing footer by adding icon-led footer group headings, icon-backed footer links, and removing the footer top margin so it connects directly to the red CTA band above it.
- Verified the footer icon/gap fix with `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, `pnpm lint`, and a `200 OK` smoke check on the running marketing home route.
- Updated the marketing typography to Instrument Sans for body/UI and DM Serif Display for titles, inspired by the American Tractor Company reference while preserving Xtiitch's brand palette and no-negative-letter-spacing rule.
- Added reference-inspired marketing motion and richer imagery: a moving proof ticker under the hero, a soft animated hero spotlight background, a three-image editorial atelier strip, and new compressed WebP assets for design review, payment handoff, and fitting progress.
- Verified the typography/reference/image pass with `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, `pnpm lint`, and a `200 OK` smoke check on the running marketing home route.
- Continued polishing the already-finished public marketing UI without changing approved copy: added the home hero live-order proof panel, upgraded shared feature cards with numbered accents and icon watermarks, made the steps section feel connected, replaced duplicated measurement-card layouts on Features and For customers with a single richer `MeasurementRouteGrid`, and strengthened the trust cards with numbered security treatment. Verified with Prettier, `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, `pnpm lint`, `pnpm check`, and route smoke checks returning `200` for `/`, `/features`, `/for-customers`, `/how-it-works`, and `/pricing`.
- Continued the marketing polish into the remaining public pages: contact/waitlist now has icon-backed fields, a stronger success state, and a launch-step proof panel; FAQ now has three quick-answer cards above the accordion list; Security now has an image-led Paystack money-flow explainer; Privacy and Terms now share a richer `PolicySectionList` legal-review surface. Verified with Prettier, `pnpm --filter @xtiitch/marketing check`, `pnpm --filter @xtiitch/marketing build`, `pnpm --filter @xtiitch/marketing test`, `pnpm lint`, and route smoke checks returning `200` for `/contact`, `/faq`, `/security`, `/privacy`, and `/terms`.

## Opened / Pending

- Push verified local commits to `origin/main` after each completed slice; the remote is configured.
- Resolve one stack tension before frontend implementation: MUI and React Router are web-first, while Expo/React Native is native-first. The working resolution below is dedicated web plus dedicated mobile, sharing contracts, schemas, design tokens, and feature logic.
- Subscription invoice/payment-link/manual billing controls, operator-run and worker-scheduled dunning/grace-expiry sweeps, and cancellation-to-free downgrade rules now exist in admin; automatic Paystack recurring authorization, recurring webhook reconciliation, and plan-limit enforcement are still pending.
- Define refund and cancellation policy before live payments.
- Confirm whether GraphQL is required for v1 client screens or should start as a documented/read-model surface after REST is stable.
- Current latest Expo package graph has a peer warning: Expo 56 expects `react-native-worklets` `^0.7.4 || ^0.8.0`, while latest Reanimated pulls the 0.9 line. Keep visible until Expo or Reanimated aligns, or deliberately switch to Expo-compatible package versions.
- SonarQube scan is configured and was attempted locally. The scanner reached SonarCloud, then stopped before analysis because `sonar.organization` is not configured for project key `xtiitch`. Add the organization plus the required host/token environment and rerun `pnpm sonar`.
- Non-API app tests are placeholder scripts until their app shells and first real flows are implemented.
- Add Postgres integration tests for auth repositories, migrations, and RLS tenant isolation before auth is considered production-ready.
- Configure either `MARKETING_WAITLIST_WEBHOOK_URL` or `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `MARKETING_WAITLIST_EMAIL_TO` before public waitlist launch.
- Final privacy, terms, refund, cancellation, subscription renewal, and chargeback language must receive legal review before public launch.
- React Router build emits v8 future-flag warnings. Keep visible until the team deliberately opts into the v8 behavior changes.
- Admin notification and reporting surfaces still derive from the loaded admin read models; authenticated server-side CSV export/download endpoints now exist for the current admin datasets.
- Configure production WhatsApp/SMS provider credentials/templates and run a provider sandbox smoke. The worker now has a generic HTTP live transport, lifecycle text templates, and provider response/id persistence, but no real production provider token is committed.
- Add customer-facing handover/tracking reads for the delivery/pickup leg.
- Finish business-user hardening: email invites/password resets, owner-transfer policy, and role enforcement inside protected API/service boundaries beyond the auth/team endpoints.
- Growth & monetisation layer (see `## Growth & Monetisation`): plan-package CRUD, admin promotion-definition CRUD, store-scoped checkout redemption/application, admin sponsored-placement campaign controls, admin affiliate registry/reporting, the admin referral-programme definition registry, and the affiliate attribution schema foundation now exist; remaining slices are business-side promotion controls, collection/design-scoped checkout targeting, referral attribution/reward execution, affiliate click/conversion ingestion plus approval/settlement UI, and public sponsored placement rendering/event tracking on the marketing site — businesses act on their own customers; admin acts on businesses and customers; all delivered via discount-at-charge / commission-rebate / vouchers or Xtiitch-owned ad revenue so the no-funds-held invariant holds.

## Product Boundary

Build version one only:

- Public marketing website for acquisition, pricing, product education, trust, and business signup/waitlist conversion.
- Per-business online storefront.
- Business dashboard.
- Global customer identity with tenant-scoped relationships and orders.
- Catalogue, collections, designs, images, sizes, measurements, customisation, delivery, bookings, order stages, tracking, notifications, payments, subscriptions, money tracker, walk-in logging, and analytics.
- Paystack checkout, payment links, subaccounts/splits, and webhook confirmation.

Do not build in v1:

- General cross-business marketplace.
- POS and inventory.
- Escrow, wallet, pooled balance, or platform-held funds.
- Full accounting, invoicing, expenses, or profit-and-loss.
- Lending, insights products, or group services.
- Cross-tenant browse/search except the explicitly deferred phase-two read path.

## Platform Architecture

Decided 2026-06-15 with the project owner. Xtiitch is delivered as separate, independently deployable front-ends over one shared Go API and worker — four web apps and two mobile apps, each scoped to a single audience so concerns never mix.

| Audience                     | Web app                                     | Mobile app                     | Domain                           |
| ---------------------------- | ------------------------------------------- | ------------------------------ | -------------------------------- |
| Marketing (pre-signup)       | `apps/marketing` (built)                    | —                              | `xtiitch.com`, `www.xtiitch.com` |
| Customer (shopper)           | `apps/storefront` (split out of `apps/web`) | `apps/mobile-customer` (later) | `<handle>.xtiitch.com`           |
| Business (tailor/seamstress) | `apps/dashboard` (split out of `apps/web`)  | `apps/mobile-business` (later) | `app.xtiitch.com`                |
| Admin (platform operator)    | `apps/admin` (first frontend slice built)   | —                              | `admin.xtiitch.com`              |
| Backend                      | `apps/api` (Go) + `apps/worker` (built)     | —                              | `api.xtiitch.com`                |

- **App separation.** The old combined `apps/web` direction has been split into `apps/storefront` and `apps/dashboard`. Each product surface deploys independently to its own domain. The admin surface lives in `apps/admin`. `apps/marketing` stays the public `xtiitch.com` site.
- **Per-business subdomains.** A business is reached at `<handle>.xtiitch.com` (e.g. a business with handle `neurodynecorp` is served at `https://neurodynecorp.xtiitch.com`). Wildcard DNS `*.xtiitch.com` points at the storefront app, which reads the `Host` header, takes the subdomain label as the business handle, and resolves the store — replacing today's `/store/:handle` path. Reserved labels `www`, `app`, `admin`, and `api` route to their own apps and must be refused as business handles at registration. In development this is `<handle>.localhost:<port>` (browsers resolve `*.localhost` to 127.0.0.1). A business mapping its OWN custom domain (e.g. `neurodynecorp.com`) is a later phase via a verified `domains` table.
- **Admin app.** The platform operator gets its own front-end and auth (admin users, not business users): manage admin users, roles, permissions, profile/settings, notification preferences, approve/verify businesses for payments (KYC/compliance for Ghana — verification becomes admin-gated `pending → verified/rejected` rather than business self-serve), platform metrics (GMV, commission, active businesses), suspend/manage businesses, money rails, subscriptions, plan packages, promotions, sponsored placements, risk, support, notifications, reports, exports, and audit tooling. Admin auth, operator user management, editable RBAC/permissions, profile settings, platform settings, notification preferences, audit events, business verification decisions, business suspend/reactivate controls, platform metrics, money-rails read/replay/hold controls, subscription lifecycle/invoice/payment-link controls, plan-package controls, promotion-definition controls, sponsored-placement controls, risk-review controls, and support queue controls are now backend-backed; notifications, reports, and exports are derived from the loaded admin read models.
- **Mobile.** Two React Native / Expo apps mirroring the web split — a customer app and a business app — sharing one typed API client. `apps/mobile` is currently an empty stub.
- **Invariant preserved.** This is presentation-layer separation only. Tenant isolation, the money rails, and "Xtiitch never holds funds" are unchanged; every front-end goes through the same hardened, RLS-enforced API.

## Growth & Monetisation — Promotions, Referrals, Affiliates, Sponsored Placements (planned)

Requested 2026-06-17 by the project owner. Researched against the current codebase and the Paystack split model. This is the growth layer: businesses reward and acquire their own customers; the platform runs cross-business programmes, sells plan packages, and monetises the marketing site — all without ever holding funds.

### Guiding principle — deliver value without holding funds

Paystack supports a **per-transaction dynamic split** (set the split inline at charge time), which is the enabler for every reward below: the customer's charge is divided atomically by Paystack between the business's subaccount and Xtiitch's commission — Xtiitch only ever touches its own commission. Three reward mechanisms, and one forbidden:

- **(a) Discount at charge time** — reduce what the customer pays, then charge the lower amount. Funded by shrinking the **business's** share, the **platform's** commission share, or a split of both. No money is moved or held; it is simply a smaller charge. Always prefer this.
- **(b) Commission rebate** — Xtiitch waives or reduces its **own** split share on a business's qualifying orders. This is how you reward a *business* (referrer/affiliate) without any payout.
- **(c) Forbidden: platform-funded cash credits/payouts.** Without a wallet there is no cash to hand out. Every "credit" is instead a **future-use, capped, expiring, non-withdrawable voucher** folded back into mechanism (a) — it only ever materialises as a smaller charge on a real future order. The **only** sanctioned real cash outflow is a KYC-gated Paystack **Transfer to an affiliate from Xtiitch's own settled commission**, or routing an affiliate as a **co-recipient on the split** — never customer funds, never held in between. This keeps the `## Product Boundary` "no wallet/escrow/pooled balance" invariant intact.

### Actor & permission boundary (the core rule)

Businesses act only on **their own customers**; the platform (admin) acts on **businesses and customers**.

| Capability                         | Business (dashboard, tenant-scoped)                          | Admin (operator, platform-wide)                                            |
| ---------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Promotions / discount codes        | Yes — for its own store's customers, business-funded only    | Yes — platform-wide or targeted at any business; platform- or split-funded |
| Referral programme                 | Yes — refer/reward its own customers (vouchers)              | Yes — for customers **and** business→business (rewarded by commission rebate) |
| Affiliate programme                 | No                                                           | Yes — registered partners/agents; payout via split co-recipient or KYC-gated transfer |
| Plan packages (CRUD)               | No (a business only *selects/assigned to* a plan)            | Yes — create/update/archive packages, set commission/fee/limits            |
| Sponsored placement on marketing   | Submit & pay for a campaign (advertiser)                     | Review/approve, curate, run, and price placements                          |

Map to the existing admin RBAC (`internal/domain/admin/admin.go`: roles Owner/Operator/Support, permissions): `manage_plans`, `manage_promotions`, and `manage_ads` are separate admin permissions. Business-side surfaces use the business JWT + tenant RLS; admin-side surfaces use admin auth + the new permissions and write an audit event for every change.

### Build one engine first, then layer on it

Build the **promotions/voucher engine once**; referral rewards, referee rewards, customer-side affiliate rewards, and the voucher form of any "credit" all become **auto-generated single-use promotion rows** running through that one redemption ledger, cap/expiry/scope system, and reconciliation path. Only commission rebates and split co-recipient routing touch the Paystack split layer directly.

### Proposed slices (build order)

1. **Promotions engine (business + admin).** New tables `promotions` (`promo_id`, `business_id` *nullable* for platform-wide, `code` nullable for automatic promos, `type` percentage|fixed, `value`, `max_discount_cap` — **required for %**, `min_spend`, `starts_at`/`ends_at`, `usage_limit_global`, `usage_limit_per_customer`, `funding_source` business|platform|split, scope store|collection|design, `status`, `created_by`) and `promotion_redemptions` (`promo_id`, `order_id`, `customer_id`, `discount_minor`, `redeemed_at`; unique `(promo_id, order_id)`). Business-owned rows are tenant-scoped via the hardened RLS DO-block + composite same-tenant FK; platform-wide rows (`business_id` null) are admin-managed and resolved at checkout alongside the store's own. **Apply at checkout:** add optional `promo_code` to `PlaceStandardOrder`/`PlaceCustomOrder`, validate (active, window, `min_spend`, caps via an atomic redemption insert), compute the discount on the scoped subtotal capped at `max_discount_cap`, and reduce `price`/`deposit` **before** `InitiateCharge` ([apps/api/internal/application/checkout/service.go](apps/api/internal/application/checkout/service.go) ≈ lines 159/330/514) so the Paystack split and commission auto-recompute on the lower amount. Finalise the redemption only on `charge.success` (the payment webhook) to avoid abandoned-cart leakage. Funding maps to the split: business-funded shrinks the business share; platform-funded shrinks the commission share (capped at the commission amount); split pro-rates. Money stays integer pesewas; enforce a minimum chargeable total (MoMo fee ≈ 1.95%). Permission: a business may only create `business_id = self`, `funding_source = business`; admin may create platform-wide / target any business / use `platform`|`split` funding. **Status:** admin promotion definition CRUD/archive is built in the admin Promotions section, and checkout redemption/application is built for store-scoped standard orders and custom deposit routes with pending→applied/void webhook finalisation. Business promotion controls, collection/design-scoped checkout targeting, account-free customer repeat dedupe beyond the generated customer id, and referral-generated single-use vouchers are still pending.
2. **Plan-package CRUD (admin).** `plans` is static reference today (free/standard/growth; `commission_bps` 300/100/50; `design_limit`; `monthly_fee_minor`). Add admin CRUD to create/update/**archive** packages (never hard-delete — archive via `is_active`/`status` so businesses keep their assigned plan) under admin auth + `manage_plans`, auditing every change. Changing `commission_bps` affects **future** charges only (commission is computed per charge). Assigning a business to a package is an admin business-management action. **Status:** package definition CRUD/archive is built in the admin Subscriptions section. Note: actual recurring **billing** of `monthly_fee_minor` is the separate, still-open `## Opened / Pending` subscription-mechanics decision — this slice is package *definition + assignment*, not recurring billing.
3. **Referral engine (two-sided).** Tables `referral_codes` (`owner_type` customer|business, `owner_id`, stable unique `code`, `status`), `referrals` (`referral_code_id`, referrer, referee, `status` pending→qualified→rewarded|void, `qualifying_order_id`; **unique referee** — referred once ever), `referral_rewards` (`referral_id`, beneficiary, `reward_kind` voucher|commission_rebate, `voucher_id` → a generated single-use promotion). Attribution is first-touch, locked at the referee's first interaction/order. **Reward triggers on the referee's first *paid* order** (`charge.success`), after a refund/dispute hold window. Delivery: referee → single-use voucher; referrer-is-customer → voucher; referrer-is-business → commission rebate (or voucher). Fraud: dedupe on **MoMo/phone number** (primary identity in Ghana), reject self-referral, per-referrer reward cap, void on refund inside the hold window. Permission: a business runs referral for **its own** customers (business-funded vouchers); admin runs platform/customer programmes and **business→business** referral (rewarded by commission rebate). Customers are platform-global (no account), so a customer's referral identity is global while the voucher it earns is scoped to the store where it redeems. **Status:** admin referral programme definition schema/API/UI registry is built; referral code issuance, attribution, qualification, reward generation, fraud checks, and checkout/application integration remain pending.
4. **Affiliate programme (admin-run).** Registered partners/agents with tracking links and last-click attribution within a cookie window — distinct from casual referral. Tables `affiliates` (`entity_type`, `code`, `commission_model` percent|flat, `rate`, `cookie_window_days`, payout account, `status`), `affiliate_clicks` (`visitor_id`, `clicked_at`), `affiliate_conversions` (`order_id`, gross, `commission`, `status` pending→approved→settled|reversed, `attributed_click_id`). Delivery, in order of preference: (1) affiliate is a registered business with a Paystack subaccount → add as a **co-recipient on the order's split** at charge time (no funds held — ideal); (2) batched/cross-business → accrue, then a **KYC-gated Paystack Transfer from Xtiitch's settled commission** (the only sanctioned cash outflow — min payout, hold window, reconciliation); (3) no payout rail → downgrade to vouchers. Admin-only (`manage_growth`); businesses do **not** run affiliate programmes. Define precedence vs referral so one order is never double-rewarded. **Status:** admin affiliate registry/reporting, click/conversion schema foundation, admin performance read model/UI, and admin conversion approval/settlement/reversal controls are built; public click ingestion, checkout attribution, and payout reconciliation remain pending.
5. **Sponsored placements on the marketing site.** Marketing is currently 100% static ([apps/marketing/app/content.ts](apps/marketing/app/content.ts), zero API calls). Add a public read endpoint (e.g. `GET /v1/public/sponsored`) that the marketing loaders call to render a "Featured businesses / designs" band, plus `ad_campaigns` (`advertiser_business_id`, `placement_type` featured_business|promoted_design|homepage_hero, `target_ref_id`, `starts_at`/`ends_at`, `status` pending_review→active→paused/completed, `pricing_model` flat_time|cpm|cpc, `budget`, `spend_to_date`, `daily_cap`) and `ad_events` (impression|click, `visitor_id`, ts — server-side, deduped). v1 = **flat-time** placement (simplest), **prepaid to Xtiitch's main account** via Paystack (the advertiser pays the platform — Xtiitch's own revenue, no third-party funds held). Admin reviews/approves campaigns (`manage_ads`); enforce `ends_at` **server-side at query time**; interleave with organic and cap sponsored density; **label every placement "Sponsored"** (legal disclosure + trust). Only verified businesses are eligible advertisers. **Status:** admin RBAC, campaign/event tables, operator CRUD/review UI, audit events, and verified/active advertiser enforcement are built. Public marketing read/rendering, impression/click capture, sponsored density caps, and Paystack ad-payment collection are still pending.

### Cross-cutting notes & open decisions

- Reuse the hardened RLS DO-block + composite same-tenant FK for tenant-scoped tables; platform-global tables (`plans`, platform promotions, `affiliates`, `ad_campaigns`) are admin-managed (no/nullable `business_id`) and accessed under admin/bypass context, mirroring how `customers`/`plans` are global today. All money in integer pesewas; finalise any promo/referral value only on `charge.success`; audit every admin growth action.
- **Decisions to confirm with the owner:** default funding for business promos; whether platform-wide admin promos are opt-in per business; affiliate payout KYC/threshold policy; sponsored pricing model + rate card; whether referral vouchers are store-scoped or platform-wide; precedence when promo + referral + affiliate collide on one order; and the still-open subscription-billing mechanics that plan-package monthly fees depend on (`## Opened / Pending`).

## Selected Stack

### Monorepo

- Package manager: `pnpm`.
- Monorepo tooling: Turborepo or plain `pnpm` workspaces at first; add Turborepo once multiple apps need cached pipelines.
- Package version policy: use exact latest stable package versions when added. If latest creates a known peer/platform conflict, prefer the latest compatible stable version and record the exception here.
- Suggested root layout:

```text
apps/
  api/                 Go backend
  marketing/           Public acquisition site with React Router and MUI
  storefront/          Customer storefront app for <handle>.xtiitch.com
  dashboard/           Business dashboard app for app.xtiitch.com
  admin/               Platform operator app for admin.xtiitch.com
  mobile/              Expo + React Native + Expo Router stub
  worker/              Node.js BullMQ workers
packages/
  contracts/           OpenAPI, GraphQL schema, protobuf, generated clients
  design-tokens/       Brand colors, typography scale, spacing, radii
  schemas/             Shared TypeScript Zod schemas where useful
  api-client/          Generated/handwritten REST and GraphQL clients
  config/              Shared lint, tsconfig, formatting presets
infra/
  docker/              Local Postgres, Redis, supporting services
  migrations/          SQL migrations
  render/              Backend deployment notes/config
  vercel/              Frontend deployment notes/config
docs/
  adr/                 Architecture decision records
  api/                 Contract docs
  architecture/        Scalability and system design guidance
  compliance/          Ghana legal/compliance engineering checklist
  design/              Style and design guide
  marketing/           Public website plan and messaging strategy
  quality/             SonarQube and quality-gate guidance
  runbooks/            Operational docs
  security/            Threat model, tenant isolation notes
scripts/
```

### Frontend

- Marketing web: React Router framework mode, MUI, shared design tokens, Vercel deployment.
- Product web surfaces: React Router framework mode, MUI, React Hook Form, Zod.
- Mobile: Expo, React Native, Expo Router, Expo Notifications.
- Shared: API clients, Zod schemas where practical, design tokens, constants, feature copy, validation rules that are safe to share.
- Important: all business rules still live behind the backend contract. Clients validate for user experience only.

### Backend

- Language: Go.
- HTTP framework: prefer `chi` or `gin`; choose `chi` if simplicity and standard-library feel matter more, `gin` if middleware/ecosystem speed matters more.
- REST: primary public/client command and resource API.
- GraphQL: optional client query/read-model surface, implemented with `gqlgen` only when it reduces frontend query sprawl. It must call application services and must not own business rules.
- gRPC: internal service contract for background services and future service extraction. Start with protobuf contracts in `packages/contracts/proto`; expose gRPC only where it creates real value.
- Database: PostgreSQL.
- SQL: direct SQL using SQL migrations plus `pgx`/`pgxpool`; use `sqlc` for type-safe generated Go access while keeping SQL files explicit and reviewable.
- Migrations: Goose via `go run github.com/pressly/goose/v3/cmd/goose@latest`.
- Auth: custom JWT with refresh-token/session records.
- Dependency injection: constructor injection by default; use Google Wire if wiring grows large enough to justify compile-time generation. Avoid hidden service locators.
- Background jobs: BullMQ + Redis in a Node worker app. The Go API should publish jobs through a narrow queue port/adapter or an internal worker bridge.
- Payments: Paystack subaccounts, splits, payment links, mobile money, cards, and verified webhooks.
- Media: Cloudinary.
- Email: Resend.
- Push: Expo Notifications.
- Hosting: Render for backend services; Vercel for web frontend. Mobile ships through Expo/EAS.

### Brand Tokens

Use these tokens from the beginning:

```ts
export const xtiitchColors = {
  burgundy: "#800020",
  ink: "#15111a",
  cream: "#faf6f2",
};
```

Frontend UI should feel warm, professional, and operational. This is a fashion-business operating system, not a generic SaaS landing page. The dashboard should be efficient and calm; storefronts should let each business brand itself while still feeling trustworthy.

## Architecture Standard

Use hexagonal architecture. The domain and application layers must not import adapters.

### Backend Layers

```text
cmd/api/                    Process entrypoint
internal/bootstrap/         Config, DI wiring, server startup
internal/domain/            Entities, value objects, invariants, domain errors
internal/application/       Use cases, commands, queries, ports
internal/adapters/inbound/  HTTP REST, GraphQL, gRPC, webhook handlers
internal/adapters/outbound/ Postgres, Paystack, Cloudinary, Redis/BullMQ bridge, Resend, Expo Push
internal/platform/          Logging, tracing, config, clock, ids, transactions
```

### Dependency Direction

- `domain` imports nothing project-specific.
- `application` imports `domain` and defines ports/interfaces.
- `inbound adapters` translate transport input into application commands/queries.
- `outbound adapters` implement application ports.
- `bootstrap` wires concrete adapters into application services.
- Tests can use in-memory or fake port implementations.

### Required Ports

Define narrow ports before adapters:

- `TenantAuthorizer`
- `BusinessRepository`
- `CustomerRepository`
- `CatalogueRepository`
- `OrderRepository`
- `PaymentRepository`
- `LedgerRepository`
- `BookingRepository`
- `NotificationRepository`
- `AnalyticsRepository`
- `TransactionManager`
- `PasswordHasher`
- `TokenIssuer`
- `IDGenerator`
- `Clock`
- `PaymentProvider`
- `MediaStore`
- `EmailSender`
- `PushSender`
- `JobQueue`

Ports should be use-case-shaped, not generic database wrappers.

## Tenant Isolation Recommendation

Use defense in depth:

- Every tenant-scoped table has `business_id`.
- Every repository method for tenant-scoped data requires a server-derived tenant scope argument.
- Every tenant-scoped SQL query filters by `business_id`.
- PostgreSQL Row Level Security should be enabled for tenant-scoped tables once the migration baseline exists.
- Database sessions/transactions set the current tenant context before touching tenant-scoped rows.
- Public storefront scope comes from resolved store handle, not from client authority.
- Direct-reference reads outside scope return not found.
- Client-facing IDs must be non-sequential and unguessable.
- Cache keys and job payloads include tenant scope.
- Tests must include deliberate cross-tenant access attempts for every critical repository/use case.

This is one of the highest-risk parts of the system. Treat a tenant leak as a release-blocking defect.

## Domain Model Guide

Start with these aggregates and entities:

- Business: tenant root, store handle, verification status, settlement data, plan, default deposit.
- Store settings: toggles for bespoke, measurements, customisation, collections, delivery, dispatch, branding.
- Business user: owner/admin/staff, bound to one business.
- Customer: global identity.
- Customer-business relationship: tenant-scoped visibility of a customer through orders.
- Collection: optional themed catalogue grouping.
- Design: catalogue item, order type, status, images, pricing, deposit override, customisation options.
- Measurement field and size band: business-defined sizing.
- Design pricing by band.
- Order: standard/custom lifecycle, stage status, payment state, delivery, booking, measurements.
- Measurement: tenant-scoped measurement values for a customer/order.
- Availability and booking: home-visit slots and state.
- Stage template and stage event.
- Delivery zone.
- Plan: global subscription package.
- Payment: provider payment, split, commission, status, idempotency.
- Manual taking: off-platform cash/direct mobile money record.
- Notification.
- Analytics event.

Represent money as exact minor units in GHS pesewas. Never use floats for money. Store timestamps in UTC and render in the business local time.

## API Contract Strategy

### REST

REST is the primary v1 contract for clients:

- `/auth`
- `/businesses`
- `/store-settings`
- `/catalogue`
- `/public/stores/{handle}`
- `/orders`
- `/measurements`
- `/bookings`
- `/payments`
- `/money-tracker`
- `/notifications`
- `/analytics`
- `/subscriptions`
- `/webhooks/paystack`

Document REST with OpenAPI. Generate TypeScript clients where possible.

### GraphQL

GraphQL may expose composed read models for dashboard and storefront screens:

- No business rules.
- No mutation until there is a clear benefit over REST commands.
- Must enforce the same tenant scope and pagination rules.
- Must not introduce cross-tenant reads in v1.

### gRPC

Use protobuf contracts for internal boundaries:

- Notification dispatch.
- Job processing.
- Payment reconciliation.
- Future service extraction.

Do not split the backend into many deployable services early just because gRPC exists. Keep the deployable shape simple until there is pressure to separate.

## Security And Data Protection

- Card data never touches Xtiitch. Paystack owns card collection.
- Store settlement and identity details encrypted/protected at rest.
- JWT access tokens are short-lived.
- Refresh tokens are stored as hashed session records and can be revoked.
- Use role checks for owner/admin/staff actions.
- Avoid exposing global customer data to businesses except through tenant-scoped orders.
- Webhooks must verify Paystack signatures.
- Money and state-changing endpoints require idempotency keys where retries are possible.
- Audit money-state changes, verification changes, order-stage changes, role changes, and settlement changes.

## Testing Standard

Coverage must focus on critical behavior:

- Tenant isolation and direct-reference protection.
- Auth, role authorization, JWT expiry/refresh/revocation.
- Paystack webhook verification and idempotency.
- Payment split/commission calculations.
- Deposit rules and GHS minor-unit arithmetic.
- Order state machine transitions.
- Booking slot concurrency.
- Subscription package changes and billing events.
- Notification enqueueing and failure isolation.
- Public storefront visibility rules.
- Repository integration tests against Postgres.
- End-to-end smoke flows for the main journeys.

Minimum practical test stack:

- Go unit tests for domain/application.
- Go integration tests with test Postgres/Redis.
- Contract tests for REST/OpenAPI and webhook payloads.
- Frontend component/form tests for critical flows.
- Playwright smoke tests for web once screens exist.
- Expo/manual smoke checklist for mobile until automated mobile E2E is added.
- Marketing pages must include responsive checks, accessibility checks, SEO metadata checks, and claim/compliance review before launch.

## Milestone Plan

### Milestone 0: Repository Foundation

Done when:

- Monorepo is initialized.
- Git is initialized.
- Root README, agent plan, editor config, formatting, linting, basic CI scripts, Docker Compose, and environment templates exist.
- Design tokens package contains the Xtiitch palette.
- Architecture, quality, design, compliance, marketing, and ADR docs exist.

Suggested commit:

```text
chore: initialize xtiitch monorepo foundation
```

### Milestone 0.5: Marketing Website

Scope:

- Public marketing app in `apps/marketing`.
- Home, features, how it works, pricing, customer education, trust/security, FAQ, and contact/waitlist pages.
- Messaging grounded in the product docs and Ghanaian fashion-business reality.
- SEO metadata and Open Graph basics.
- Lead capture path that can later connect to onboarding.
- Clear compliance-safe claims about payments, privacy, refunds, and subscriptions.

Done when:

- A fashion business owner can understand the product and join/request access from the first visit.
- Customers can understand why an Xtiitch tracking/payment link is trustworthy.
- Pricing and package information are clear.
- The site passes responsive, accessibility, lint, test, and SonarQube checks.

Suggested commit:

```text
feat(marketing): add public acquisition website
```

### Milestone 1: Backend Foundation And Money Rails

Scope:

- Go API skeleton with hexagonal folders.
- DI bootstrap.
- Config, logger, error model, request IDs.
- PostgreSQL migrations.
- Auth and custom JWT.
- Business onboarding.
- Tenant isolation baseline.
- Paystack subaccount provisioning.
- Paystack split payment test flow.
- Webhook verification and idempotency.

Done when:

- A verified business can receive a test payment through Paystack with the platform commission split.
- Webhook confirmation advances the correct payment/order record exactly once.
- Deliberate cross-tenant reads/writes fail.

Suggested commit:

```text
feat(api): add tenant foundation and paystack money rails
```

### Milestone 2: Catalogue And Storefront

Scope:

- Business store settings.
- Collections.
- Designs.
- Cloudinary uploads.
- Size bands and design pricing.
- Public storefront by handle.
- Shareable design and collection links.
- Single-tenant search.
- Web storefront screens.

Done when:

- A business can build a public store with images, designs, collections, size bands, and prices.
- Public visitors can browse without an account.
- Retired/deleted visibility rules hold.

Suggested commit:

```text
feat(catalogue): add tenant storefront and design management
```

### Milestone 3: Ordering, Stages, And Tracking

Scope:

- Standard order journey.
- Custom order journey.
- Measurement routes.
- Deposit rules.
- Stage templates and stage events.
- Customer light account.
- Customer tracking view.
- WhatsApp handoff for custom balance discussion.

Done when:

- Standard order pays in full and is confirmed.
- Custom measurement/customisation paths collect deposit when required.
- Come-to-shop measurement path skips deposit.
- Customer sees the simple red/yellow/green tracking state.

Suggested commit:

```text
feat(orders): implement order journeys and customer tracking
```

### Milestone 4: Money Tracker And Manual Takings

Scope:

- Automatic through-platform takings from succeeded payments.
- Manual cash/direct mobile-money takings.
- Daily, weekly, and monthly summaries.
- Split between Xtiitch payments and off-platform takings.

Done when:

- Business sees honest takings without treating it as full accounting.
- Commission applies only to through-platform payments.

Suggested commit:

```text
feat(ledger): add money tracker and manual takings
```

### Milestone 5: Bookings And Home-Visit Calendar

Scope:

- Weekly availability.
- Slot generation.
- Home-visit booking with deposit confirmation.
- Business reschedule/cancel.
- Slot reopening.
- Concurrency protection.

Done when:

- A home visit reserves a slot only after the correct payment path.
- Double booking is prevented.
- Customer cannot self-cancel paid visit; they can call the business.

Suggested commit:

```text
feat(bookings): add home visit calendar and slot controls
```

### Milestone 6: Delivery And Dispatch

Scope:

- Delivery zones.
- Fees.
- Dispatch settings.
- Pickup vs dispatch at checkout.
- Manual arrangement when no rate matches.

Done when:

- Matching zone adds the fee automatically.
- Pickup has no fee.
- Delivery never blocks order placement if manual arrangement is required.

Suggested commit:

```text
feat(delivery): add delivery zones and dispatch options
```

### Milestone 7: Notifications

Scope:

- BullMQ + Redis worker app.
- Resend email adapter.
- Expo Notifications adapter.
- Notification records and retry status.
- Events: new order, stage changed, order ready, booking booked/rescheduled/cancelled, payment link issued, balance paid.

Done when:

- Notification failures do not fail orders or payments.
- Both business and customer receive appropriate updates by push and/or email.

Suggested commit:

```text
feat(notifications): add async email and push delivery
```

### Milestone 8: Subscriptions And Packages

Scope:

- Global plan/package definitions.
- Free, Standard, and later Growth-style packages.
- Plan limits and commission rates.
- Paystack recurring/payment-link subscription billing.
- Subscription state, renewal, failure, grace period, and downgrade rules.

Done when:

- Business can choose and change packages.
- Plan limits are enforced.
- Subscription billing does not require Xtiitch to hold business funds.

Suggested commit:

```text
feat(billing): add subscription packages and billing lifecycle
```

### Milestone 9: Mobile App

Scope:

- Expo app shell.
- Auth.
- Business dashboard essentials.
- Customer storefront/order/tracking flow.
- Push notification registration.
- Poor-network states.

Done when:

- Android/iPhone users can browse, order, track, and receive push notifications.
- Business users can handle core dashboard actions from a phone.

Suggested commit:

```text
feat(mobile): add expo app for customers and businesses
```

### Milestone 10: Hardening And Closed Beta

Scope:

- Security review.
- Tenant-isolation audit.
- Webhook replay tests.
- Load testing of storefront/catalogue read paths.
- Observability.
- Operational runbooks.
- Closed beta seed data and onboarding scripts.

Done when:

- The app is deployable to Render/Vercel.
- Critical flows are tested.
- Beta businesses can be onboarded without engineering hand-holding.

Suggested commit:

```text
chore(release): harden xtiitch for closed beta
```

## Documentation Requirements

Maintain docs as part of each feature:

- Update this `agent_plan.md`.
- Add or update ADRs for architectural decisions.
- Update OpenAPI/protobuf/GraphQL schema docs when contracts change.
- Update setup docs when commands, environment variables, or services change.
- Add runbooks for payment, webhook, subscription, notification, and deployment operations.
- Document test data and seed flows.

## Agent Workflow

Every feature must follow this loop:

1. Read `agent_plan.md` and relevant source docs.
2. Update `Current Work` with the feature being started.
3. Move any stale items from `Current Work` to `Completed` or `Opened / Pending`.
4. Inspect the repo before editing.
5. Implement within the architecture boundaries.
6. Add or update tests for the critical behavior touched.
7. Run the relevant checks.
8. Update this plan with:
   - what was completed,
   - what remains open,
   - commands run,
   - any changed assumptions.
9. Commit with a clear feature commit message.
10. Push to the configured remote once the remote exists.

Do not skip the plan update. This file is the handoff surface for the next agent.

## Commit And Push Rules

- One feature, one focused commit where practical.
- Commit messages should use conventional style:
  - `feat(api): ...`
  - `feat(web): ...`
  - `feat(mobile): ...`
  - `feat(catalogue): ...`
  - `fix(payments): ...`
  - `test(tenant): ...`
  - `docs(architecture): ...`
  - `chore(repo): ...`
- Include generated files only when they are part of the source-controlled contract.
- Never commit secrets, `.env` files, local build output, or dependency caches.
- If no remote exists, make the local commit and record that push is pending.
- Once a remote exists, push after every completed feature.

## First Implementation Tasks

1. Add `.gitignore`, `README.md`, `.editorconfig`, package manager files, and workspace layout.
2. Add `docker-compose.yml` for local Postgres and Redis.
3. Add `apps/marketing`, `apps/web`, `apps/mobile`, and `apps/worker` package scaffolds.
4. Scaffold `apps/api` as a Go service with hexagonal folders and constructor DI.
5. Add SQL migration tooling and a first migration for global plans and businesses.
6. Add `packages/design-tokens` with Xtiitch colors.
7. Add architecture, design, compliance, marketing, quality, and ADR docs.
8. Add initial CI/check scripts.

## Commands Log

- `pdftotext -layout Xtiitch-Product-Definition.pdf -`
- `pdftotext -layout Xtiitch-Technical-Specification.pdf -`
- `rg --files`
- `git status --short --branch` failed because Git is not initialized.
- `git remote -v` failed because Git is not initialized.
- `git init`
- `git add agent_plan.md && git commit -m "docs: add xtiitch agent build plan"`
- `npm view ... version` for current package versions.
- `pnpm install`
- `go get github.com/go-chi/chi/v5@latest && go mod tidy`
- `go get github.com/pressly/goose/v3/cmd/goose@latest && go mod tidy` exposed a local Go toolchain coverage mismatch, so Goose was moved out of the API module and into `go run ...@latest` migration scripts.
- `pnpm check` passed.
- `pnpm test` passed.
- `go test -coverprofile=coverage.out ./...` passed from `apps/api`.
- `git commit -m "chore: initialize xtiitch monorepo foundation"`
- Web research for Ghana e-commerce, data protection, payments, cybersecurity, tax, and marketing context.
- `pnpm --filter @xtiitch/marketing check` passed after redesigning the home business workflow section.
- `pnpm --filter @xtiitch/marketing build` passed after redesigning the home business workflow section.
- `pnpm --filter @xtiitch/marketing test` passed after redesigning the home business workflow section.
- `pnpm lint` passed after redesigning the home business workflow section.
- `pnpm --filter @xtiitch/marketing check` passed after redesigning the shared marketing navbar and footer.
- `pnpm --filter @xtiitch/marketing build` passed after redesigning the shared marketing navbar and footer.
- `pnpm --filter @xtiitch/marketing test` passed after redesigning the shared marketing navbar and footer.
- `pnpm check` passed after redesigning the shared marketing navbar and footer.
- `pnpm --filter @xtiitch/marketing check` passed after the full marketing redesign polish.
- `pnpm --filter @xtiitch/marketing build` passed after the full marketing redesign polish.
- `pnpm --filter @xtiitch/marketing test` passed after the full marketing redesign polish.
- `pnpm check` passed after the full marketing redesign polish.
- `pnpm test` passed after the full marketing redesign polish.
- `pnpm sonar` was attempted after the full marketing redesign polish and failed before analysis because `sonar.organization` is missing.
- `pnpm --filter @xtiitch/marketing check` passed after the home proof-strip redesign.
- `pnpm --filter @xtiitch/marketing build` passed after the home proof-strip redesign.
- `pnpm --filter @xtiitch/marketing test` passed after the home proof-strip redesign.
- `pnpm lint` passed after the home proof-strip redesign.
- `pnpm check` was attempted after the home proof-strip redesign and failed in unrelated `apps/web` scaffold work because `react-router typegen` could not find `apps/web/app/routes.ts`.
- `pnpm --filter @xtiitch/marketing check` passed after removing the black shared page-hero card.
- `pnpm --filter @xtiitch/marketing build` passed after removing the black shared page-hero card.
- `pnpm --filter @xtiitch/marketing test` passed after removing the black shared page-hero card.
- `pnpm lint` passed after removing the black shared page-hero card.
- `pnpm --filter @xtiitch/marketing check` passed after replacing slanted marketing backgrounds.
- `pnpm --filter @xtiitch/marketing build` passed after replacing slanted marketing backgrounds.
- `pnpm --filter @xtiitch/marketing test` passed after replacing slanted marketing backgrounds.
- `pnpm lint` passed after replacing slanted marketing backgrounds.
- `pnpm --filter @xtiitch/marketing check` passed after adding the first marketing animation layer.
- `pnpm --filter @xtiitch/marketing build` passed after adding the first marketing animation layer.
- `pnpm --filter @xtiitch/marketing test` passed after adding the first marketing animation layer.
- `pnpm lint` passed after adding the first marketing animation layer.
- `curl -I -s http://localhost:3005/` returned `200 OK` after adding the first marketing animation layer.
- `pnpm --filter @xtiitch/marketing check` passed after adding footer icons and removing the footer CTA gap.
- `pnpm --filter @xtiitch/marketing build` passed after adding footer icons and removing the footer CTA gap.
- `pnpm --filter @xtiitch/marketing test` passed after adding footer icons and removing the footer CTA gap.
- `pnpm lint` passed after adding footer icons and removing the footer CTA gap.
- `curl -I -s http://localhost:3005/` returned `200 OK` after adding footer icons and removing the footer CTA gap.
- `curl -L -s https://www.americantractorcompany.com/` was used as reference inspection for typography, ticker, hero overlay, and animation cues.
- Built-in image generation produced three project-bound editorial fashion images, then `cwebp -q 82` compressed them into `apps/marketing/public/images/atelier-review.webp`, `payment-handoff.webp`, and `tracking-fitting.webp`.
- `pnpm --filter @xtiitch/marketing check` passed after the American Tractor-inspired typography, ticker, background animation, and image-depth pass.
- `pnpm --filter @xtiitch/marketing build` passed after the American Tractor-inspired typography, ticker, background animation, and image-depth pass.
- `pnpm --filter @xtiitch/marketing test` passed after the American Tractor-inspired typography, ticker, background animation, and image-depth pass.
- `pnpm lint` passed after the American Tractor-inspired typography, ticker, background animation, and image-depth pass.
- `curl -I -s http://localhost:3005/` returned `200 OK` after the American Tractor-inspired typography, ticker, background animation, and image-depth pass.
