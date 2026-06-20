# AI Natural-Language Search — Plan

> A customer types plain language — *"a red kente dress for a wedding under 500
> cedis"* or *"smart casual agbada for a tall guy"* — and Xtiitch pulls up the
> stores and designs that fit. A **paid customer feature**.

Status: **Phases 0–1 shipped; Phase 2 backend shipped (UI pending)**. Last updated: 2026-06-20.

---

## 1. Build vs buy — the headline decision

**Recommendation: do NOT build a custom ML model. Use hosted models.**

A custom model would need a large labelled fashion dataset, ML expertise, GPUs,
and ongoing retraining — months of work and cost for something hosted models do
better today. Two hosted pieces cover this cleanly:

1. **Embeddings (semantic search)** — turn each design + the query into a vector
   and find the closest matches. This is what makes "red kente dress for a
   wedding" match a design titled "Festival Kente Set" even with no shared words.
   - Provider options: **Voyage AI** (Anthropic's recommended embeddings
     partner), **OpenAI** `text-embedding-3-small/large`, or **Cohere embed**.
     Any works; Voyage or OpenAI are the pragmatic defaults.
   - Store vectors in **Postgres + `pgvector`** (no new datastore — we already
     run Postgres).
2. **Reasoning layer (query understanding + rerank)** — **Anthropic Claude**
   (use the latest model) to:
   - parse the free text into **structured filters** (category, colour,
     occasion, fabric, gender, price range, size), and
   - optionally **rerank/explain** the top results in natural language ("These 6
     match a wedding kente under ₵500").

So: **Claude for understanding, a dedicated embeddings model for retrieval.**
Anthropic doesn't currently offer an embeddings endpoint, which is exactly why
the two-provider split is the standard pattern.

---

## 2. How it works

```
                         "red kente dress for a wedding under 500 cedis"
                                            │
                          ┌─────────────────┴─────────────────┐
                          ▼                                   ▼
                 Claude: extract filters            Embeddings API: embed query
              {category: dress, colour: red,                  │
               occasion: wedding, fabric: kente,              │
               price_max: 50000}                              │
                          │                                   ▼
                          └────────────►  Postgres hybrid search  ◄────────────┐
                                          - pgvector cosine similarity on the   │
                                            design embedding (semantic)         │
                                          - SQL filters (price, status, in-     │
                                            stock, verified shop, plan gating)  │
                                                       │                        │
                                            top-K candidates                    │
                                                       │                        │
                                   (optional) Claude rerank + 1-line summary    │
                                                       ▼                        │
                                          ranked designs + their stores ────────┘
```

**Ingest pipeline (offline):** whenever a design is created/updated, build a
text blob (title + description + collection + colour/fabric tags + shop name) and
store its embedding in a `design_embeddings` table. Backfill once for existing
designs; re-embed on change via the existing outbox/worker.

**Query pipeline (online):** embed the query, run the hybrid Postgres search,
optionally rerank with Claude, return designs + stores.

---

## 3. Components to build

| # | Component | Notes |
|---|---|---|
| 1 | `pgvector` + `design_embeddings(design_id, business_id, embedding vector, content_hash)` | RLS-scoped; content_hash skips re-embedding unchanged text. |
| 2 | **Embedding adapter** (`adapters/outbound/ai/embeddings`) | One port, swappable provider (Voyage/OpenAI). Batches on ingest. |
| 3 | **Claude adapter** (`adapters/outbound/ai/llm`) | Filter-extraction prompt (structured JSON output) + optional rerank. Use the latest Claude model. |
| 4 | **Ingest worker job** | On design create/update, embed + upsert. Backfill command for the existing catalogue. |
| 5 | **Search service** (`application/aisearch`) | Orchestrates: parse → embed → hybrid query → rerank → results. |
| 6 | **Public endpoint** `POST /v1/public/ai-search` | Body: free-text query (+ optional shop scope). Returns designs + stores. Rate-limited; entitlement-gated (see §4). |
| 7 | **Storefront/marketing UI** | An AI search box ("Describe what you're looking for") with results; upsell when not entitled. |
| 8 | **Usage metering + caching** | Cache identical queries; meter per customer for billing; cap abuse. |

---

## 4. "Paid customer feature" — the real dependency

This is the hard part, and it's a **product decision**, not just engineering:

- **Customers are account-free today.** AI search being paid means we need a way
  to identify a paying customer and meter usage. Options:
  1. **Lightweight customer accounts** (phone/email + OTP) with an AI-search
     entitlement — cleanest, also unlocks order history, reviews, the WhatsApp
     bot identity, and Act 843 export/erasure by account.
  2. **Pay-per-search credits** bought via Paystack (e.g., ₵5 for 20 searches) —
     no full account, but still needs a wallet/credit ledger keyed to a
     phone/device. (Note: this is **Xtiitch's own revenue**, charged to the
     customer — a different money flow from the "never holds funds" business
     settlements, and it needs its own Paystack account + accounting.)
  3. **Freemium**: a few free AI searches per day, then a paywall — best for
     adoption; the paywall still needs option 1 or 2 underneath.

- **Recommendation:** build **lightweight customer accounts** first (small, and
  it unblocks several roadmap items), then gate AI search on a customer
  entitlement with a freemium allowance. Money charged to customers for the
  feature is platform revenue via a Paystack plan/charge.

- **Plan/entitlement note:** this is a *customer* paywall, distinct from the
  *business* plan benefits (`online_ordering`, branding, etc.). Don't overload
  the business `plans.features` for it.

---

## 5. Cost, latency, quality

- **Latency:** embeddings (~50–150ms) + pgvector search (fast) is the core path;
  keep Claude filter-extraction in parallel with embedding, and make the Claude
  rerank **optional** (skip it for the cheapest/fastest tier).
- **Cost control:** cache query→results; only embed designs on change (content
  hash); use a small embedding model; rerank only top-K (e.g., 20).
- **Quality:** hybrid (vector + structured filters) beats pure vector — price and
  in-stock filters must be hard SQL constraints, not "hopefully similar".
- **Cold start:** backfill embeddings for the existing catalogue once before
  launch.

---

## 6. Phases

- **Phase 0 — Retrieval spike:** ✅ **SHIPPED** (commit 447852b). Embeddings
  adapter (`Embedder` port; OpenAI when keyed, deterministic dev hashing embedder
  otherwise), `design_embeddings` table (migration 000049; `real[]` so it runs on
  the stock Postgres image — pgvector is the documented scale-up), ingest/backfill
  on boot, and `POST /v1/public/ai-search` with cosine ranking in Go. Live-
  verified: "red kente dress for a wedding" ranks correctly.
- **Phase 1 — Understanding:** ✅ **SHIPPED** (commit aec3fc6). `QueryParser`
  port — Claude (Anthropic Messages API) when keyed, heuristic parser otherwise —
  extracts colours/categories/occasions + price bounds; the ranker blends cosine
  with hard price filters and soft facet boosts and returns the interpreted
  intent. Live-verified: "kente under 500" drops over-budget designs.
- **Phase 2 — Customer accounts + paywall:** ✅ **SHIPPED** (accounts
  87bc4c9/604be70; paywall aec3fc6; storefront UI 552bda7). Customer phone-OTP
  accounts + a freemium meter (`ai_search_usage`, migration 000050; anon 5/mo,
  free customer 25/mo, pro unlimited; over quota → HTTP 402), and the storefront
  UI: `/discover` (search box, results, understood-intent chips, freemium meter,
  402 prompt) + `/account` (phone-OTP sign-in, session cookie). Live-verified.
  **Pro upgrade payment deferred (product decision):** the freemium meter is the
  funnel for now and `customers.ai_search_pro` is a manual flag. The paid upgrade
  needs a new customer→platform Paystack path (today's payments are all tied to a
  business subaccount) and a pricing/cadence decision — revisit on demand signal.
- **Phase 3 — Polish:** Claude rerank + natural-language result summary, "did you
  mean", multi-language (English/Twi/Pidgin), and feeding the same engine into
  the WhatsApp bot ("describe what you want" over chat).

---

## 7. Decisions needed before building

1. **Embeddings provider:** Voyage AI vs OpenAI vs Cohere? (Recommend Voyage or
   OpenAI to start.)
2. **Customer identity model:** lightweight accounts vs pay-per-search credits vs
   freemium-then-paywall? (Recommend accounts + freemium.)
3. **Who pays and how:** confirm AI search is **Xtiitch revenue** charged to the
   customer (needs a platform Paystack account + tax/accounting), vs a
   business-funded perk.
4. **Scope:** search **designs across all shops** (marketplace discovery) and/or
   **within one shop**? (Both are easy; marketplace is the bigger win.)
5. **Model tiers:** offer a cheap "fast" tier (vector only) and a premium
   "smart" tier (Claude rerank + summary)?

---

## 8. Effort estimate (rough)

- Phase 0 (pgvector + embeddings + backfill + spike): ~3–4 days.
- Phase 1 (Claude understanding + hybrid + UI): ~3–4 days.
- Phase 2 (customer accounts + paywall + metering): ~5–7 days (the accounts +
  billing are the bulk).
- Phase 3 (rerank/summary/multi-lang/bot): ~4–5 days.

The retrieval engine is small; the **customer-accounts + paywall** is the real
weight, and it's shared infrastructure that several roadmap items want anyway.
