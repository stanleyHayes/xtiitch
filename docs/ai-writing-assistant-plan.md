# AI Writing Assistant Bar — Plan

> A reusable inline assistant that sits beside the dashboard's text inputs and
> helps a business write and improve content faster — design descriptions,
> announcements, customer messages, policies, storefront copy — while keeping the
> author in full control of the final text.

Status: **planning**. Last updated: 2026-06-20.

A **paid Growth-plan benefit** (`ai_writing_assistant`), gated the same way as
the other plan entitlements ([[plan-feature-entitlements]]). Builds directly on
what already exists: the **Anthropic/Claude** integration is wired and live (it
powers AI-search query understanding), and the **per-subject monthly metering**
pattern (`ai_search_usage`) is the template for usage limits.

---

## 1. How it works (high level)

```
Dashboard text input ──▶ <AiWritingBar> (shared React component)
                              │ action + selected/full text + optional prompt
                              ▼
                POST /v1/ai-writing/transform   (business auth, Growth-gated, metered)
                              │
                      application/aiwriting  →  Claude (Anthropic Messages API)
                              │ action-specific system prompt
                              ▼
                    { result, tokens, quota }  ──▶ preview → replace / insert / copy / discard
```

The component is **presentation + UX**; all generation happens server-side so the
API key never reaches the browser, the Growth gate and usage meter are enforced
on the server, and prompts stay consistent.

---

## 2. Actions (MVP)

Each maps to a server-side, action-specific prompt. Works on the **selected text**
when there is a selection, otherwise the **full input**.

| Action | What it does |
|---|---|
| Formalize | Rewrite in a more professional tone |
| Make casual | Rewrite in a friendly, conversational tone |
| Summarize | Shorten to a clearer, tighter version |
| Expand | Add detail while keeping the meaning |
| Fix grammar | Correct spelling, grammar, punctuation, structure |
| Improve clarity | Make it easier to understand |
| Create from prompt | Generate full text from the author's description |
| Generate title/headline | Produce a title from the body |
| Generate message | Compose an email / SMS / announcement / reminder |
| Translate | Translate into a supported language (English/Twi/Pidgin/French to start) |

---

## 3. Where it appears

Attached (opt-in, per field) to the dashboard's content surfaces:
- Design **title** + **description**, collection blurbs.
- Storefront **about / policy / banner** copy.
- **Announcements**, customer **messages/replies**, order notes.
- Email/SMS **notification** compose fields.

The bar is collapsed by default (a single "✨ Assist" affordance) so forms don't
feel crowded; it expands to the action row on demand.

---

## 4. Technical components

| # | Component | Notes |
|---|---|---|
| 1 | **`<AiWritingBar>`** shared component (`apps/dashboard`, exportable) | Props: `value`, `selection`, `onApply`, `actions?` (subset per field), `context?` (field hint), `disabled`. Renders the action row, a prompt box for "create from prompt", loading/error states, and the result preview with **Replace / Insert below / Copy / Discard** — **confirm before overwrite**. |
| 2 | **Endpoint** `POST /v1/ai-writing/transform` | Business auth; Growth-gated; metered. Body `{action, text, prompt?, context?, target_language?}` → `{result, quota}`. |
| 3 | **`application/aiwriting` service** | Maps action → Claude system prompt, calls the Anthropic adapter (reuse `aiadapter`), returns the rewrite. Pure/testable; a dev fallback (echo/deterministic transform) so it runs without a key. |
| 4 | **Entitlement** `ai_writing_assistant` in `plans.features` | Default **on for Growth**; admin-toggleable. Server refuses with the same shape as other gated benefits; the bar is hidden client-side when absent. |
| 5 | **Usage meter** `ai_writing_usage` | Per-business monthly quota (mirror `ai_search_usage`); over-quota → HTTP 402; the bar shows remaining. Generous default (e.g. 300/mo), tunable. |
| 6 | **Abuse / safety** | Max input length, rate limit per business, strip prompt-injection framing, never execute instructions found in the user's text. |

---

## 5. Reuse vs. new

- **Reuse:** Anthropic/Claude adapter (`aiadapter`), the plan-entitlement gate +
  admin toggle, the `*_usage` monthly-meter + 402 pattern, business auth/RLS.
- **New:** the `<AiWritingBar>` component, the `aiwriting` service + prompts, the
  `/v1/ai-writing/transform` endpoint, the `ai_writing_assistant` feature flag,
  and the `ai_writing_usage` table.

---

## 6. Plan gating & money rules

- The assistant is a **Growth** benefit. Free/Standard shops see no bar (or a
  subtle upsell). No money changes hands here; it's a plan-tier feature, so it's
  governed by the existing subscription billing — **Xtiitch never holds funds**.

---

## 7. Phases

- **Phase 0 — Backend:** `ai_writing_assistant` flag + admin toggle,
  `/v1/ai-writing/transform` (Claude + dev fallback) for the core actions
  (formalize, summarize, casual, expand, fix-grammar, improve-clarity,
  create-from-prompt), Growth gate, `ai_writing_usage` meter. Tested + live.
- **Phase 1 — The bar on one field:** ship `<AiWritingBar>` on the design
  description field end-to-end (preview/replace/insert/copy/discard, confirm
  overwrite, loading/error, remaining-quota). Prove the UX.
- **Phase 2 — Roll out:** attach to announcements, messages, storefront copy,
  notification compose; add title/headline + generate-message actions.
- **Phase 3 — Translate + polish:** translation (English/Twi/Pidgin/French),
  per-field action presets, keyboard shortcuts, streaming output.

---

## 8. Decisions needed before building

1. **Scope of "admin dashboard":** the **business** dashboard (recommended —
   matches the Growth entitlement and the content businesses actually author), or
   also the platform super-admin console?
2. **Monthly quota** for Growth (e.g. 300 transforms/mo) and whether to surface a
   buy-more path later.
3. **Languages** for translate at launch (recommend English + Twi + Pidgin +
   French).
4. **Model:** Claude (already wired) — Haiku for speed/cost on short rewrites,
   Sonnet for longer "create from prompt"? (Recommend Haiku default, Sonnet for
   create/expand.)
