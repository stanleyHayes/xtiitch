# System Updates — WhatsApp order comms + SMS notifications/auth

Extracted from `System Updates.pdf` (2026-07-09), grounded in the current code.

## Data-model facts (today)
- `customers` has one contact column, `phone` (doubles as the WhatsApp/OTP identifier). No separate WhatsApp number. — `infra/migrations/000001_foundation.up.sql:75`
- `orders` has **no** customer contact snapshot; the dashboard/notifications JOIN `customers`. — `order_repository.go:640-659`
- Store owners have `business_users.whatsapp_number` but **no** plain phone. — `000063_business_whatsapp_auth.up.sql`
- Notifications already model an `sms` channel (schema CHECK, domain `ChannelSMS`, worker `assertSendable`), but every emit hard-codes `ChannelWhatsApp` and the worker's `whatsapp_cloud` transport rejects `sms`. — `outbox_repository.go:67-143`, `apps/worker/src/senders.ts`
- OTP delivery for BOTH customer and store owner is built by one function, `buildCustomerOTPDelivery` (`bootstrap/app.go:443-459`) — the single swap point to move auth OTP to SMS.

## Chosen data model
- Customer: keep `customers.phone` as the **direct phone** (SMS/calls, OTP target); add `customers.whatsapp_number` for **WhatsApp chat** (may equal phone).
- Store owner: keep `business_users.whatsapp_number`; add `business_users.phone` (direct phone, SMS target).

---

## Phase A — WhatsApp order communication (NO API keys needed)
Uses `wa.me` deep links from the owner's own WhatsApp — no Cloud API.
- [ ] A1. Migration: add `customers.whatsapp_number` (+ index parity). One migration also carries Phase B columns.
- [ ] A2. Capture the customer WhatsApp number at checkout: storefront `checkout.tsx` form field → checkout handler request bodies → `CreateOnlineOrderInput` (`ports/order.go`) → `customers` upsert in `order_repository.go` (all order paths).
- [ ] A3. Surface it in the store-owner dashboard order records: `ListOrders` query + `/orders` handler expose `customer_whatsapp`; `dashboard.tsx` `OrderSummary`/`OrderCard` show it.
- [ ] A4. Clickable number + **"Chat on WhatsApp"** button on each order card → `https://wa.me/<intl-number>` (opens a chat with that customer). Also make the direct phone a `tel:` link.

## Phase B — Phone-number collection (NO API keys needed)
- [ ] B1. Customer direct phone: already a checkout field (`customer_phone`) → ensure stored (on-conflict currently skips `phone`) and displayed.
- [ ] B2. Store-owner phone: add `business_users.phone`; collect in `register.tsx`; thread through `CreateBusinessWithOwner`. Show/edit in dashboard settings.

## Phase C — SMS (NEEDS the SMS provider + API keys)
Provider TBD (Ghana: Arkesel / Hubtel / mNotify, or Twilio). SMS is sent from two places:
- **OTP** (synchronous, Go API) and **order notifications** (async, TS worker) — so an SMS sender is needed in BOTH.
- [ ] C1. Go SMS sender adapter (`ports.SMSSender`) + config (provider base URL, key, sender id). Dev fallback logs.
- [ ] C2. Switch auth OTP to SMS for customer + store owner. Make the OTP channel configurable (`OTP_CHANNEL=sms|whatsapp`, default sms once keys set) at `buildCustomerOTPDelivery`. Note: this **supersedes WhatsApp OTP for auth** — the WhatsApp auth-template work becomes optional (WhatsApp stays for order chat/notifications).
- [ ] C3. Order-lifecycle SMS notifications to customers: parameterise the `enqueue*` helpers with a channel; enqueue SMS (alongside/instead of WhatsApp per config) for confirmed/fulfilled/handover/balance. Worker gains an SMS transport/sender (TS).
- [ ] C4. Store-owner SMS notifications where relevant (new order placed, etc.) to `business_users.phone`.
- [ ] C5. Customer order-tracking updates via SMS (status changes surface as SMS).

## Open decision
- **SMS provider** (blocks Phase C only). Everything in A + B proceeds now.
- Keep WhatsApp OTP as a selectable fallback, or fully replace with SMS? (Plan: keep configurable.)

## Order of work
Start Phase A (immediate value, no keys) → Phase B → Phase C when the provider + keys arrive.
