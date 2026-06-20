# AI Assistant add-on — billing status

The **AI Assistant** is a paid add-on billed **separately** from a business's
plan. Xtiitch never holds funds — Paystack charges the customer directly.

## Shipped

- `business_addons` table + billing columns — `infra/migrations/000053_business_addons.up.sql`
  (RLS tenant policy, `active`, `activated_at`) and `000054_business_addon_billing.up.sql`
  (`authorization_ref`, `customer_ref`, `amount_minor`, `currency`, `billing_status`,
  `next_charge_at`, `last_charged_at`, `last_reference`).
- **Entitlement check + assist endpoint** — `POST /v1/ai/assist` (business-authed),
  gated on the `ai_assistant` add-on, returns **402** `{code:"addon_inactive"}`
  when inactive. `internal/application/aiassist/service.go`,
  `internal/adapters/inbound/http/aiassist/handler.go`.
- **Self-service Paystack billing** (`internal/application/aiassist/service.go`):
  - `GET /v1/addons/ai_assistant` — status + price to enable/renew.
  - `POST /v1/addons/ai_assistant/checkout` `{callback_url}` → `{redirect_url, reference}`
    (Paystack direct-debit authorization, mirrors `InitializeSubscriptionAuthorization`).
  - `POST /v1/addons/ai_assistant/verify` `{reference}` — verifies the authorization,
    charges the first month, and activates the add-on on a charge that succeeds
    (or is pending). Stores the reusable authorization for renewals.
  - **Renewal sweep** — `POST /v1/admin/addons/recurring-charges` (admin-authed)
    charges every add-on whose `next_charge_at` is due; a hard failure marks it
    `past_due` and revokes access. Call it on the same schedule as the subscription
    recurring sweep (`/v1/admin/subscriptions/recurring-charges`).
  - Price: `AI_ASSISTANT_ADDON_PRICE_MINOR` (default GHS 50.00).
- **Manual activation** (admin, no money) — `POST /v1/admin/businesses/{business_id}/addons`
  `{addon,active}` (stays `billing_status='manual'`, never swept).

## Still to do

1. **Schedule the renewal sweep.** Add `POST /v1/admin/addons/recurring-charges` to
   whatever scheduler already calls `/v1/admin/subscriptions/recurring-charges`
   (the worker/cron). Until then, renewals only run when the endpoint is hit.
2. **Apply migration `000054`** to each environment's DB (demo `:5450` has no
   tracker — apply by hand; production via the normal migration step).
3. **Paystack webhook reconciliation (optional hardening).** Billing is currently
   *optimistic*: a `pending` charge grants access for the cycle and a `pending`
   first charge at checkout is withheld until re-tried. For exact reconciliation,
   route add-on-referenced `charge.success` / `charge.failed` / `subscription.disable`
   events (reference prefix `addon-aiast-`) through the existing verified webhook
   (`internal/adapters/inbound/http/payments/handler.go` → `HandleProviderEvent`)
   to flip `business_addons` active/past_due precisely. This removes the at-most-
   one-cycle optimism window documented in `service.go`.
