# WhatsApp Ordering Bot — Plan

> Let customers discover a shop, browse designs, place an order, pay, and track
> it **entirely inside WhatsApp** — no app, no storefront visit. Ghana runs on
> WhatsApp, so this is the lowest-friction way to order.

Status: **Phases 0–1 shipped (browse + track live); Phase 2 ordering next**. Last updated: 2026-06-20.

This builds directly on what already exists:
- **Outbound WhatsApp** is shipped — the worker's `whatsapp_cloud` transport
  (`apps/worker/src/senders.ts`) sends WhatsApp Cloud API messages, and the API
  already enqueues order lifecycle notifications on the `whatsapp` channel.
- **Catalogue, checkout, payments** are real services (`application/catalogue`,
  `application/checkout`, `application/payments`) the bot can drive — the bot is
  a new *inbound* surface over the same domain, not a new ordering engine.
- **Online ordering is a paid plan benefit** (`online_ordering`), so bot
  ordering is gated by the same entitlement as storefront checkout.

---

## 1. How it works (high level)

```
Customer's WhatsApp ──▶ Meta WhatsApp Cloud API ──▶ webhook  POST /v1/webhooks/whatsapp
                                                        │
                                            verify signature, dedupe
                                                        │
                                              Conversation engine
                                   (per-sender session + state machine)
                                                        │
        ┌───────────────────────────────┬──────────────┴───────────────┐
        ▼                               ▼                              ▼
  catalogue service              checkout service              payments service
  (shops, designs, prices)   (standard / custom orders)   (Paystack payment link)
        │                               │                              │
        └─────────────── replies sent back via the WhatsApp Cloud API ─┘
```

The bot is **stateful per phone number**: each inbound message advances a short
conversation (pick shop → pick design → size → contact → pay), stored in a
`whatsapp_sessions` table (or Redis) keyed by the sender's WA id.

---

## 2. Conversation flows (MVP)

Each flow uses WhatsApp **interactive messages** (list pickers + reply buttons)
so customers tap instead of type where possible.

**A. Entry points**
- Customer messages the shop's WhatsApp number (or scans a `wa.me` link / QR on
  a design). The first message resolves which shop/design they mean.
- Deep link: `https://wa.me/<number>?text=order%20<design-handle>` pre-fills the
  intent so the bot opens straight on a design.

**B. Browse & order a ready-made (standard) piece**
1. "Hi! Welcome to **Adwoa Couture**. What would you like?" → buttons:
   `Browse designs` · `Track an order` · `Talk to the shop`.
2. `Browse designs` → a WhatsApp **list message** of active designs (title +
   price), paged.
3. Pick a design → show image + price + sizes (list of size bands).
4. Pick a size → collect name (+ confirm WA number as phone).
5. Send a **Paystack payment link** (hosted checkout) for the full price.
6. On `charge.success` webhook → create the order (reuse checkout's standard
   path), reply with confirmation + the tracking link/code.

**C. Bespoke / custom order**
- Same start, then `Bespoke` → choose route: self-measure (collect the shop's
  measurement fields one prompt at a time), home-visit (offer open slots),
  come-to-shop (no online payment).
- For paid routes, send the deposit payment link; on success, create the custom
  order.

**D. Track an order**
- `Track an order` → ask for the order code (or recall the sender's last order)
  → reply with the red/yellow/green stage and a one-line status. No login.

**E. Hand-off**
- `Talk to the shop` → mark the conversation `human` and notify the business
  (dashboard notification); the bot stops auto-replying until released.

---

## 3. Technical components to build

| # | Component | Notes |
|---|---|---|
| 1 | **Inbound webhook** `GET/POST /v1/webhooks/whatsapp` | GET = Meta verify challenge; POST = messages. Verify `X-Hub-Signature-256` (HMAC over raw body with the app secret), dedupe on message id. |
| 2 | **Conversation store** | `whatsapp_sessions(wa_id, business_id, state jsonb, expires_at)` under RLS, or Redis with TTL. Holds the current step + partial order. |
| 3 | **Conversation engine** (new `application/whatsappbot`) | A state machine: input + current state → next state + outbound message(s). Pure/testable; calls catalogue/checkout/payments ports. |
| 4 | **Number → shop resolution** | Map the *business* WhatsApp number (or a routing keyword) to a business. v1: one number per shop, or one shared number + the shop handle in the first message. |
| 5 | **Interactive message builder** | Helpers to emit list pickers, reply buttons, and text via the Cloud API (extends the existing `whatsapp_cloud` sender). |
| 6 | **Payment links** | Reuse `payments` → Paystack `authorization_url`; the bot sends the link and waits for the `charge.success` webhook to finalise the order (same idempotent path as the storefront). |
| 7 | **Order creation** | Reuse `checkout` service commands so bot orders are identical to storefront orders (and gated by `online_ordering`). |
| 8 | **Outbound replies** | Reuse the shipped `whatsapp_cloud` sender; the bot also rides existing lifecycle notifications for stage changes. |
| 9 | **Operator/business controls** | Toggle the bot per business; view bot conversations; human hand-off; quiet hours. |
| 10 | **Abuse / rate limits** | Per-`wa_id` rate limiting; ignore non-customers; session expiry; opt-out keyword (STOP). |

---

## 4. Reuse vs. new

- **Reuse:** catalogue reads, checkout order creation, Paystack payment +
  webhook confirmation, notification outbound (`whatsapp_cloud`), plan
  entitlement (`online_ordering`), tenant RLS.
- **New:** inbound webhook + signature verify, conversation session store,
  conversation state machine, interactive-message builders, number→shop routing,
  bot admin controls.

---

## 5. Plan gating & money rules

- Bot ordering = online ordering → requires the **`online_ordering`** benefit
  (Standard/Growth). Free shops can run the bot for **browse + enquire + track**,
  but "place & pay" is refused with the same message as the storefront.
- **Xtiitch never holds funds.** The bot only ever sends a Paystack payment link
  that settles to the business subaccount; the bot never collects money itself.

---

## 6. Phases

- **Phase 0 — Foundations:** ✅ **SHIPPED** (commit 44faf6c). Inbound webhook
  `GET/POST /v1/webhooks/whatsapp` (Meta verify challenge + X-Hub-Signature-256
  HMAC verify + message-id dedupe), Postgres session store (`whatsapp_sessions`,
  `whatsapp_inbound_messages`, migration 000051), Go Cloud-API sender with a
  logging dev fallback, and a stateful echo/health engine. Live-verified.
- **Phase 1 — Track + Browse (MVP, works on Free):** ✅ **SHIPPED** (commit
  f24ca35). Resolve shop by name/handle, browse a numbered list of active
  designs with from-prices, drill into sizes/price, and track an order by code
  (red/yellow/green stage). Read-only, no payment. A narrow `ports.BotCatalogue`
  + `botcatalogueadapter` reuse the storefront/order repositories. Engine is a
  pure state machine with 8 unit tests; live-verified against the seeded demo.
- **Phase 2 — Standard ordering (paid):** ✅ **SHIPPED** (commit e94532a). From a
  design detail: ORDER → pick size → give a name → Paystack payment link. Reuses
  `checkout.PlaceStandardOrder` verbatim (same draft order + Paystack intent +
  idempotency + `online_ordering` gate); the WhatsApp number is the order phone
  so the existing `charge.success` → order-confirmation notification routes back
  to chat. Live-verified end-to-end (dev provider): draft order + customer +
  initiated payment created. Gated to online-ordering shops; free shops keep
  browse + track.
- **Phase 3 — Bespoke ordering:** self-measure prompts, home-visit slots, deposit
  links.
- **Phase 4 — Polish:** human hand-off, business bot controls, quiet hours,
  analytics, multi-language (English + Twi/Pidgin canned strings).

> **Decisions locked** (§7): one shared Xtiitch number routing by shop name;
> Postgres session store; browse+track free, place+pay gated by `online_ordering`;
> `wa_id` reuses the `customers` identity; WhatsApp Cloud API direct.

---

## 7. Decisions needed before building

1. **Numbers:** one WhatsApp Business number **per shop**, or **one shared
   Xtiitch number** that routes by the shop handle in the first message? (Shared
   is far cheaper/simpler to operate; per-shop feels more "theirs".)
2. **Conversation store:** Postgres table (durable, queryable, RLS) vs Redis
   (cheap, TTL-native). Recommend Postgres for auditability.
3. **Free-plan bot scope:** browse + enquire + track only, or no bot at all on
   Free? (Recommend browse/track to drive upgrades.)
4. **Identity:** treat each `wa_id` as a lightweight customer identity (reuse the
   `customers` table by phone) so order history + Act 843 export/erasure already
   cover bot customers.
5. **Provider:** WhatsApp Cloud API directly (already integrated) vs a BSP
   (Twilio/360dialog). Recommend Cloud API to start (lowest cost, already wired).

---

## 8. Effort estimate (rough)

- Phase 0–1 (webhook + browse + track): ~3–4 focused days.
- Phase 2 (standard ordering + payment): ~3 days.
- Phase 3 (bespoke): ~3–4 days.
- Phase 4 (polish/controls): ~3 days.

The outbound half (sending WhatsApp messages) is **already done**; this plan is
mostly the *inbound* engine and the conversation state machine.
