# AI Assistant add-on — deferred Paystack billing (slice 4)

The **AI Assistant** is a paid add-on billed **separately** from a business's
plan. Everything except the recurring money flow is shipped:

- `business_addons` table — `infra/migrations/000053_business_addons.up.sql`
  (RLS tenant policy + `active` flag + `activated_at`).
- Entitlement check + assist endpoint — `POST /v1/ai/assist` (business-authed),
  gated on the `ai_assistant` add-on, returns **402** `{code:"addon_inactive"}`
  when inactive. See `internal/application/aiassist/service.go` and
  `internal/adapters/inbound/http/aiassist/handler.go`.
- Manual activation (so the feature is testable without billing) —
  `POST /v1/admin/businesses/{business_id}/addons` `{addon,active}`. See
  `internal/adapters/inbound/http/aiassist/admin_handler.go`.

**What is intentionally NOT built here (money-critical; handle separately):**

1. A **Paystack charge/subscription flow** that, on a successful payment, sets
   `business_addons.active = true` for the paying business (i.e. calls the same
   upsert the admin endpoint uses: `ports.BusinessAddonRepository.SetBusinessAddon`
   / `aiassistapp.Service.SetAddon`).
2. A **webhook** that **deactivates** the add-on (`active = false`) on
   cancellation or a failed renewal.

> Xtiitch never holds funds — this is a Paystack subscription charge only. Do
> not add any wallet/escrow.

## Where the existing Paystack plan-subscription code lives (reuse it)

Grep `paystack` to confirm; the key files:

- **Provider client** — `internal/adapters/outbound/paystack/client.go`
  - `InitializeAuthorization(...)` — starts a recurring-billing authorization and
    returns the redirect link (line ~95).
  - `VerifyAuthorization(...)` — confirms the authorization after redirect and
    yields the reusable Paystack `authorization_code` (line ~121).
  - `ChargeAuthorization(...)` — charges a stored authorization for renewals
    (line ~148).
  - `VerifyWebhookSignature(...)` / `ParseChargeEvent(...)` — webhook verification
    and event parsing (lines ~38–42).
  - Dev fallback with real signature verification: `internal/adapters/outbound/paystack/dev.go`.
- **Plan-subscription billing flow (the template to mirror for the add-on)** —
  `internal/application/auth/service.go`:
  - `InitializeSubscriptionAuthorization(...)` (line ~221) — builds the Paystack
    authorization link for a tenant's paid plan.
  - `VerifySubscriptionAuthorization(...)` (line ~263) — verifies it and persists
    the authorization via
    `internal/adapters/outbound/postgres/business_identity_repository.go`
    `ActivateRecurringBilling(...)`.
  - HTTP entry points in `internal/adapters/inbound/http/auth/handler.go`
    (`/auth/business/subscription/...`).
  - Admin-side recurring sweep / charge in
    `internal/application/adminauth/service.go`
    (`RunSubscriptionRecurringSweep`, `InitializeSubscriptionAuthorization`,
    `VerifySubscriptionAuthorization`).
- **Inbound webhook** — `internal/adapters/inbound/http/payments/handler.go`
  - Route `POST /v1/webhooks/paystack` → `handler.webhook` → the payments
    service's `HandleProviderEvent(ctx, body, signature)` →
    `paystack.Client.ParseChargeEvent`. The add-on renewal/cancellation events
    should be routed through (or alongside) this same verified webhook entry so
    signature verification is shared.

## Suggested shape

1. Add an add-on price (config or a small `addons` catalogue) — keep it separate
   from `plans`.
2. New business-authed endpoint, e.g. `POST /v1/addons/ai_assistant/checkout`,
   that calls `InitializeAuthorization` and returns the redirect link
   (mirroring `InitializeSubscriptionAuthorization`).
3. On verify (or on the `charge.success` webhook keyed to the add-on reference):
   `aiassistapp.Service.SetAddon(ctx, businessID, "ai_assistant", true)`.
4. On `subscription.disable` / failed renewal: `SetAddon(..., false)`.
5. Store the Paystack `authorization_code` so renewals can `ChargeAuthorization`
   on a schedule (reuse the subscription sweep pattern).
