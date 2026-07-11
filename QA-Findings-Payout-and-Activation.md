# QA Findings — Marketplace Payout Settlement + Split Calculations + Activation Gating

> **Status:** Investigation / side-notes only. **Nothing here is implemented.** This
> document captures QA findings and analysis so they can be turned into scheduled work
> in a later implementation pass.
>
> **Branch:** `qa/payout-and-activation-notes` (isolated git worktree, based on `main`
> @ `116c7af`). Kept separate from the in-flight `refactor/modularization-linting` work.
>
> **Source:** QA testing (payout observation + calculation double-check) and the attached
> `Xtiitch-Update-Activation-Gating.md` spec.

---

## Finding A — Payouts to store owners' MoMo accounts (the timing question)

### A.1 What QA observed
> "The splits do not seem to land in the store owners' MoMo accounts, but I can see them on
> Paystack." (Still being double-checked by QA.)

### A.2 How our split actually works (code walk-through)
1. **Subaccount creation** — [`paystack/client.go:47-64`](apps/api/internal/adapters/outbound/paystack/client.go#L47-L64).
   We create each business's subaccount with `business_name`, `settlement_bank` (the MoMo
   network code MTN/VOD/ATL or a bank code), `account_number`, and `percentage_charge: 0`.
   **We do NOT set a `settlement_schedule`.** → the subaccount inherits Paystack's default.
2. **Combined split charge** — [`paystack/client.go:82-103`](apps/api/internal/adapters/outbound/paystack/client.go#L82-L103).
   One `/transaction/initialize` with `split.type = "flat"`, `bearer_type = "all-proportional"`,
   and one `{subaccount, share}` entry per shop. Each subaccount's `share` = that shop's **net**;
   the platform (main account) keeps the remainder (= summed commission).
3. **Per-shop figures** — [`checkout/service.go:715-841`](apps/api/internal/application/checkout/service.go#L715-L841)
   (`buildMarketplaceStoreGroup`).

### A.3 Why "shows on Paystack but not yet in MoMo" is *expected*, not necessarily a bug
Paystack separates **recording a split** from **paying it out**:

- The split **credits the subaccount's Paystack balance immediately** — that's what QA sees on
  the Paystack dashboard.
- The **actual payout to the MoMo wallet follows Paystack's settlement schedule**, which is a
  separate, time-delayed process:
  - **Auto payout = T+1** — one **business day** after the transaction, excluding **weekends and
    public holidays**. (Confirmed via Paystack docs/support — see Sources.)
  - Per-subaccount schedule can be `auto` (T+1), `weekly`, `monthly`, or `manual` (paid only on
    request). We never set it, so it defaults to the account's schedule (normally auto/T+1).

**Most likely explanations, in order — this is the checklist QA should run:**

| # | Hypothesis | How to confirm | If true |
|---|-----------|----------------|---------|
| 1 | **Test mode.** QA paid with Paystack **test** keys. Test transactions show on the dashboard but **never settle real money to a real MoMo.** | Check whether the key used was `pk_test_…`/`sk_test_…`. Look for the "Test Mode" banner on the Paystack dashboard. | Expected behaviour, **not a bug.** Retest in live mode with a small real amount. |
| 2 | **T+1 not elapsed.** Checked the MoMo the same day / over a weekend / public holiday. | Note the transaction time vs now; count **business** days. | Wait for the next working day and re-check. |
| 3 | **Subaccount schedule ≠ auto.** The subaccount was set to `manual`/`weekly` on the dashboard. | Paystack dashboard → the subaccount → settlement schedule. | Set to `auto`, or trigger a manual settlement. Consider setting `settlement_schedule` explicitly at creation (see A.4). |
| 4 | **KYC / first-settlement hold.** New Paystack account or unverified settlement account; Paystack holds the **first** settlement pending verification. | Paystack dashboard → Settlements → any "pending/withheld" state or KYC prompts. | Complete KYC; first payout often takes longer than steady-state. |
| 5 | **Wrong `settlement_bank`/`account_number`.** MoMo network code or number mismatched at subaccount creation. | Re-resolve the subaccount on Paystack; compare the settlement account to the owner's real MoMo. | Recreate/patch the subaccount with the correct network + number. (We already send `settlement_bank`; verify the *value* per owner.) |

### A.4 What our code does / does not control
- ✅ We correctly send `settlement_bank` + `account_number` so Paystack knows **where** to pay.
- ❌ We do **not** set **when** (`settlement_schedule`) — we rely on the Paystack default.
- ⚠️ The internal **"settlement review hold"** ([`adminauth/service.go:3991+`](apps/api/internal/application/adminauth/service.go#L3991),
  `SetSettlementReviewHold`) is **bookkeeping only** — it is **never consulted when building
  the charge/split** (verified: not referenced in the checkout/payments charge path). So it does
  **not** stop Paystack from settling a subaccount, and it does **not** explain money not landing.
  Conversely, it gives operators a *false sense* of holding funds it cannot actually hold.

### A.5 Recommendations (for the later implementation doc — not done here)
1. **Set `settlement_schedule` explicitly** on subaccount creation (default `"auto"`) so payout
   cadence is deterministic and not dependent on dashboard defaults. One line in
   `CreateBusinessSubaccount` ([`paystack/client.go:54`](apps/api/internal/adapters/outbound/paystack/client.go#L54)).
2. **Surface settlement status to the owner** — pull Paystack's settlement/settlement-transaction
   endpoints and show "Paid out on {date}" vs "Pending (expected {T+1 date})" in the dashboard, so
   owners aren't confused by the same gap QA hit.
3. **Reconcile the internal hold with reality** — either wire the "settlement review hold" to an
   action that *actually* defers payout (e.g., set the subaccount to `manual` while held, release
   to `auto`), or relabel it clearly as an internal review flag that does not move money.
4. **Document the T+1 expectation** in the owner-facing help + QA runbook so "not instant" is known.

---

## Finding B — Split & commission calculations (QA's "double-check the calculations")

**Verdict: the math is internally consistent and matches the Pricing Book. One doc-string
imprecision to fix.**

### B.1 Commission formula
[`domain/money/commission.go`](apps/api/internal/domain/money/commission.go):
`commission = floor(amount × basisPoints / 10000)`, then **capped at GHS 50 (5000 pesewas)**.
Floors in the merchant's favour; negatives → 0.

### B.2 The cap is **per design/item**, then summed — *intentional*
[`checkout/service.go:439-442`](apps/api/internal/application/checkout/service.go#L439-L442) documents this:
> "the Xtiitch fee is charged and capped at GHS 50 **per design**, then summed — so a bulk cart
> is **not** capped once on the whole total (Pricing Book §3 / P0.6a)."

- Single-store cart: passes `LineAmountsMinor` → caps per design, sums.
- Marketplace: [`service.go:770`](apps/api/internal/application/checkout/service.go#L770)/[`801`](apps/api/internal/application/checkout/service.go#L801)
  `commission += money.Commission(lineAmount, bps)` → **same** per-design cap-then-sum.
- ✅ **Consistent** across both paths.

⚠️ **Doc nit (not a money bug):** `commission.go:5` says "never … more than GHS 50 … on **one
payment**." The real rule is **per design**, so a multi-design order can carry >GHS 50 total
commission by design. Reword the comment to "per design (item), then summed" to match P0.6a.

### B.3 Marketplace split reconciliation — worked example (live-validated shape)
Two shops, MoMo, pickup. `netMinor = total − commission` when the merchant **absorbs** the fee;
`netMinor = total` when the merchant **passes the fee to the buyer** (buyer pays commission on top)
— [`service.go:826-833`](apps/api/internal/application/checkout/service.go#L826-L833).

| Shop | Goods total | Commission | Fee mode | Subaccount share (net) | Buyer pays for shop |
|------|------------:|-----------:|----------|-----------------------:|--------------------:|
| adwoa | 52000 | 520 | absorb | 51480 (`total − comm`) | 52000 |
| accra | 29000 | 435 | pass-to-buyer | 29000 (`total`) | 29435 |
| **Combined charge** | | | | | **81435** |

- Σ subaccount shares = 51480 + 29000 = **80480**.
- Platform remainder = 81435 − 80480 = **955** = Σ commission (520 + 435). ✅ reconciles.
- Paystack processing fee is spread `all-proportional` across all parties (merchants bear their
  share of the fee, mirroring single-store `bearer=subaccount`).
- Combined charge amount = `Σ (net + commission)` — [`service.go:691`](apps/api/internal/application/checkout/service.go#L691).

### B.4 Guards worth knowing (already correct)
- Duplicate shop in one basket is rejected (would double-credit / provider error) —
  [`service.go:636-638`](apps/api/internal/application/checkout/service.go#L636-L638).
- Every shop must be `Verified` **and** have a `SubaccountRef` or the basket is refused —
  [`service.go:731-733`](apps/api/internal/application/checkout/service.go#L731-L733).
- Basket is all-or-nothing: any per-shop failure discards all committed groups (`compensate`).

---

## Finding D — Paystack processing fee: 3-way split per plan

> **✅ RESOLVED — NO CHANGE (stakeholder decision, 2026-07-11).** The **store owner bears** both the
> **1.95%** Paystack processing fee **and** the **~GHS 1** MoMo payout fee. The current code is
> correct as-is (`bearer: subaccount` / `all-proportional`) — **do not implement any fee-pass.**
> The proposal in D.3/D.4 below was **considered and rejected**; it is kept only as reference for
> how the fees flow. This finding is closed.

### D.1 The three cuts on one payment
1. **Xtiitch commission** — per plan, capped GHS 50/design ([`commission.go`](apps/api/internal/domain/money/commission.go)).
2. **Paystack processing fee** — **Ghana: flat 1.95%**, mobile money or card, **no percentage cap**
   (settled in GHS). Plus a **~GHS 1 payout fee** when Paystack settles to a MoMo wallet (separate,
   per-settlement, not per-order). Sources below.
3. **Store owner** — receives the remainder.

Per-plan commission rates (migration
[`000064_pricing_book_commissions.up.sql`](infra/migrations/000064_pricing_book_commissions.up.sql)):
Free **3.0%** (300bps) · Starter **1.5%** (150bps) · Growth **1.0%** (100bps) · Studio **0.5%** (50bps).

### D.2 Current behaviour — the **owner absorbs** the Paystack fee
Single-store checkout uses `bearer: "subaccount"` and marketplace uses `bearer_type:
"all-proportional"` ([`paystack/client.go:101-107`](apps/api/internal/adapters/outbound/paystack/client.go#L101-L107)),
so the 1.95% comes out of the owner's payout today.

### D.3 Worked example — one GHS 200.00 (20000 pesewas) garment
Paystack fee = 1.95% × 20000 = **390 pesewas (GHS 3.90)**. GHS 50 cap doesn't bite at this size.

**Today (owner absorbs the fee), customer pays GHS 200.00:**

| Plan | Xtiitch | Paystack | Owner nets |
|------|--------:|---------:|-----------:|
| Free (3.0%) | 6.00 | 3.90 | **190.10** |
| Starter (1.5%) | 3.00 | 3.90 | **193.10** |
| Growth (1.0%) | 2.00 | 3.90 | **194.10** |
| Studio (0.5%) | 1.00 | 3.90 | **195.10** |

**~~Proposed (fee added to the customer's bill)~~ — REJECTED, kept for reference only.** Gross up so
exactly the goods amount survives Paystack's cut: `charge = goods ÷ (1 − 0.0195)` → 20000 ÷ 0.9805 =
**20398 pesewas (GHS 203.98)**; Paystack takes GHS 3.98. This model was **not adopted** — stakeholders
chose to keep the owner bearing the fee (see the RESOLVED banner above):

| Plan | Xtiitch | Paystack | Owner nets |
|------|--------:|---------:|-----------:|
| Free (3.0%) | 6.00 | 3.98 | **194.00** |
| Starter (1.5%) | 3.00 | 3.98 | **197.00** |
| Growth (1.0%) | 2.00 | 3.98 | **198.00** |
| Studio (0.5%) | 1.00 | 3.98 | **199.00** |

Owner keeps the ~GHS 3.90 previously lost to Paystack; the customer covers it. Independent of the
existing **"pass commission to buyer"** toggle (`FeePassToBuyer`) — if both are on, the customer
pays goods + commission + Paystack fee and the owner receives the full goods price.

### D.4 Implementation notes ~~(for the later pass)~~ — N/A, proposal rejected
> These notes are moot given the RESOLVED decision (owner bears the fee, no change). Retained only
> so the reasoning is on record if the decision is ever revisited.
- **Gross-up formula (Ghana):** `chargeMinor = ceil(netMinor / (1 − 0.0195))`; the fee add-on =
  `chargeMinor − netMinor`. Ghana has **no flat component or cap**, so this single formula is exact
  (unlike Nigeria's capped/flat structure — keep the rate/formula config-driven per country).
- Apply to **both** single-store (`InitiateCharge`) and marketplace (`InitiateMarketplaceCharge`)
  so behaviour is consistent; the split `share`/`transaction_charge` values stay the owner's/
  platform's intended nets while the grossed-up total covers the fee.
- **Make the fee rate configurable** (don't hard-code 1.95%) — Paystack can change it, and card vs
  MoMo could diverge.
- **Validate against a Paystack test transaction** that the owner nets exactly goods − commission
  after settlement, as the existing code comments already require for split shapes.
- **Decide the GHS 1 MoMo payout fee**: recommend the owner absorbs it (tiny, per-settlement) rather
  than grossing it into every order.
- Show the fee as a line item at checkout ("Payment processing fee: GHS X.XX") so the customer sees
  why the total is above the sticker price.

### D.5 Sources
- [Paystack Ghana pricing (1.95%)](https://paystack.com/gh/pricing) ·
  [Transactions pricing](https://support.paystack.com/en/articles/2130306) ·
  [Transfers/payout pricing (GHS 1 MoMo)](https://support.paystack.com/en/articles/2130370)

---

## Finding C — Paid-plan **activation gating** (from the attached spec)

Captured from `Xtiitch-Update-Activation-Gating.md`. **This is a real gap found in live testing:
a paid plan can currently be used without ever being paid for, and there is no clear path to
activate.** Ties into **Pricing Book Priority 0** (the Paystack subscription/upgrade payment):
activation = completing that first payment.

### C.1 Core rule
- **Free plan** → no activation, immediate access (unchanged).
- **Paid plan (Starter / Growth / Studio)** → account is **NOT active until first payment
  completes**. Until then the user **cannot use core features**, and every attempt routes them to
  activate.

### C.2 Required behaviour (implementation targets)
1. **Status = "Pending Activation" (explicitly not active).** Fix at the source: **do not grant
   paid entitlements until the plan is paid.** (Current bug: paid-but-unpaid behaves as active.)
2. **Persistent activation banner** on every page/load while pending; not permanently dismissible
   (at most hidden for the current view, returns on reload). Names the plan + "Activate now" → the
   activation page.
3. **Feature gating** — block uploading designs, storefront setup, and other core paid actions
   while pending. Blocked action → clear prompt "Activate your [Starter] plan to start using
   Xtiitch" → button to the activation page. Dashboard stays navigable so activation is reachable.
4. **A findable activation page** — completes payment via **Paystack** for the chosen plan, shows
   plan + first-purchase price (per Pricing Book), reachable from banner, every blocked-action
   prompt, and billing. **No dead ends.**
5. **Fix the upgrade/plans flow** — for a pending user the primary CTA is **Activate** (their plan),
   not Upgrade; the "activate your Starter plan first" message must **link** to activation (never a
   dead end); at activation let the user **confirm or change** which paid plan they activate.
6. **Free-plan users** unchanged.
7. **On successful payment** → status **Active**, banner gone, all gates lift, features unlock
   immediately.

### C.3 Acceptance criteria (copy into the implementation ticket)
- [ ] Paid-plan signup without payment is **Pending Activation**, not active — no paid feature works.
- [ ] Pending user **cannot upload designs / use core features**; each attempt routes to activation.
- [ ] Activation banner **persists** while pending and **cannot be permanently removed**.
- [ ] A clear **activation page** completes Paystack payment and activates the plan.
- [ ] Plans flow shows **"Activate"** for the pending plan and **never dead-ends**; user can
      activate and optionally change the plan.
- [ ] **Free-plan** users have immediate access, no activation step.
- [ ] On successful payment the account **activates instantly** and all gates lift.

### C.4 Recommended (flagged for product decision)
Add a **"Start on Free instead"** option on the activation page so a not-ready-to-pay user can drop
to Free rather than dead-end. (Product's call; core rule still gates paid plans until activated.)

### C.5 Implementation note
This depends on the **same Paystack subscription/upgrade payment path required by Pricing Book
Priority 0** (the standard-checkout flow that replaced the dead direct-debit link). Activation is
"complete that first payment" — make that path work end-to-end and hang the gating off the
resulting Active status. Entitlement grant must move from *signup* to *first-payment-success*.

---

## How QA can verify (quick runbook)
**Payout timing (Finding A):** 1) confirm live vs test key; 2) after a **live** MoMo payment, note
the time; 3) check the owner's MoMo on the **next business day**; 4) if still missing, check the
Paystack dashboard subaccount **settlement schedule** and **Settlements** tab for pending/KYC holds.

**Calculations (Finding B):** reproduce the B.3 example — buyer total should equal `Σ(net+commission)`,
each subaccount receives its `net`, platform receives `Σ commission`; a multi-item order's commission
is the **sum of per-item capped fees**, not a single GHS 50 cap.

**Activation gating (Finding C):** sign up on a paid plan, defer payment → must be **Pending
Activation** with everything gated and activation always reachable; pay → activates instantly.

---

## Sources
- [Split Payments — Paystack Developer Documentation](https://paystack.com/docs/payments/split-payments/)
- [Getting your money — Paystack Support (settlement timing)](https://support.paystack.com/en/articles/2125314)
- [Transaction splits — Paystack Support](https://support.paystack.com/en/articles/2132802)
- [Subaccount API — Paystack Developer Documentation](https://paystack.com/docs/api/subaccount/)
- Attached QA spec: `Xtiitch-Update-Activation-Gating.md`
