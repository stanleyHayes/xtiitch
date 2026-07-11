# Xtiitch — QA / UAT Verification Checklist

Exhaustive acceptance checklist for the Xtiitch platform (storefront, business dashboard, admin console, and the money/security rails). Use it for QA regression and for UAT sign-off.

**Legend**
- `[ ]` unverified · `[x]` verified · `[!]` failed (log a defect)
- 🔧 = touched in the **July 2026 hardening pass** — verify with extra care (regression-prone).
- **Expected** = the exact behaviour to confirm.

**Environments**
- Prod API: `https://xtiitch-api.onrender.com` · Business dashboard, Admin console, Storefront (per your domains).
- Paystack **test** keys for money flows unless doing a controlled prod smoke test (initialise-only, no real charge).
- Confirm before UAT: migrations at **v84**; `APP_ENV=production`; `JWT_SIGNING_KEY`, `MFA_ENCRYPTION_KEY`, `PAYSTACK_SECRET_KEY`, `CLOUDINARY_URL` set; `ANTHROPIC_API_KEY` set only if the AI add-on should be sellable.

---

## 1. Storefront — customer journey

### 1.1 Discovery & browsing
- [ ] Public shop list shows only stores that are launch-ready (**verified + payout-provisioned**). A store with no payout subaccount does NOT appear.
- [ ] Open a shop; collections and designs render; images load.
- [ ] Open a design detail page; gallery, price, size options render.
- [ ] 🔧 **Colour variations**: switching a swatch swaps the gallery; price/flow unchanged.
- [ ] Per-design **size-band override** shows the overridden label/chart (not the master).
- [ ] Share links: `/design/...` and `/collection/...` redirect to `/d`, `/c`; a bad slug shows a graceful not-found (no crash).

### 1.2 Size, price & the cart
- [ ] Selecting a size band shows the correct band price. **Expected**: price comes from the design's own band, never mixable with another design's cheaper band.
- [ ] Bespoke "from" display amount shows on customisation designs (distinct from the deposit).
- [ ] Add multiple items to the cart; items persist and group **by store**.
- [ ] 🔧 **Note field**: type special instructions on a design, add to cart, check out. **Expected**: the order is placed successfully (NOT a "We couldn't start that payment" 400). The note is captured on the order.
- [ ] Cart with items from **one** store checks out on the single-store rail.
- [ ] Cart with items from **≥2** stores offers "pay for all studios at once".

### 1.3 Checkout & payment (single store)
- [ ] Account-gate: an unauthenticated shopper is required to sign in (WhatsApp/email code) before pay; profile prefills contact.
- [ ] Enter contact, choose **pickup**; total = goods (+ no delivery fee).
- [ ] Choose **delivery**; a valid zone adds its fee once; invalid/no-address is rejected.
- [ ] Pay → redirected to **`checkout.paystack.com`** (NOT `link.paystack.com`). Complete a test payment.
- [ ] After payment, the order is **confirmed** and advances to its first stage; the customer sees a reference.
- [ ] 🔧 **Fee pass-to-buyer OFF (merchant absorbs)**: customer is charged exactly the goods total; merchant subaccount nets goods − commission.
- [ ] 🔧 **Fee pass-to-buyer ON**: customer is charged goods + commission; merchant nets the full goods total.

### 1.4 Marketplace "pay for all" (multi-store)
- [ ] A ≥2-store basket produces one Paystack charge with a **split** across each shop's subaccount.
- [ ] 🔧 Each shop's **`FeePassToBuyer`** is honoured independently (pass-to-buyer shops net full goods; absorb shops net goods − commission). Customer total matches the single-store equivalent per shop.
- [ ] 🔧 Submitting the **same shop twice** in one basket is rejected (invalid input), no duplicate split.
- [ ] On successful payment, **every** order in the group is confirmed; each settled by its own line total.
- [ ] If the combined charge cannot be raised, no un-payable draft orders are left behind.

### 1.5 Bespoke deposit & balance
- [ ] Place a bespoke order (self-measure / home-visit / come-to-shop). Deposit (floor GHS 100) is charged; order created.
- [ ] 🔧 With **pass-to-buyer ON**, deposit settlement credits the **deposit only** to `settled_minor` (NOT deposit + fee). Verify the later balance = agreed total − deposit (merchant not shorted by the fee).
- [ ] Merchant sets the agreed total (≥ settled); balance charge is raised; on payment the order settles to full.
- [ ] A second in-flight balance charge for the same order is refused (no double charge).

### 1.6 Home-visit booking
- [ ] Book an available slot; deposit charged; order + booking created.
- [ ] The same slot cannot be double-booked (concurrent attempt rejected).
- [ ] Past slots / blackout days / outside availability windows are not offered.

### 1.7 Order tracking & customer account
- [ ] Track an order by reference; status + stage reflect reality; per-stage SMS/notification received on advance.
- [ ] Sign in with a **WhatsApp** code (and **email** code fallback); OTP is single-use, expires, and locks out after repeated bad codes.
- [ ] Two-phone identity: WhatsApp contact number is distinct from the OTP-verified login phone.
- [ ] 🔧 Two simultaneous first-time orders from the **same new phone** create **one** customer identity (not duplicates).

### 1.8 Promotions / affiliate / referral (if used)
- [ ] A valid promo code discounts the order; an invalid/expired/ineligible one is rejected (never silently ignored).
- [ ] 🔧 A promo with a usage limit cannot be over-consumed by one order on checkout retry.
- [ ] Affiliate/referral attribution records on a paid order and reverses on a payment reversal.

---

## 2. Business dashboard

### 2.1 Onboarding
- [ ] Create a store (signup); handle uniqueness enforced.
- [ ] Business verification: upload Ghana Card (number + front photo); status moves to pending → approved/rejected/hold.

### 2.2 Billing setup (subscription) 🔧
- [ ] **Set up billing** opens **`checkout.paystack.com`** priced at the first period (quarterly/yearly intro), NOT the dead 404 link.
- [ ] Pay by **card** → plan active + recurring; a reusable authorization is stored (renewals auto-charge).
- [ ] Pay by **mobile money** → plan active + recurring, `provider_channel=mobile_money`; **no** reusable auth. **Expected**: the account is picked up by the renewal sweep and **re-prompted** at renewal (NOT silently skipped, NOT auto-charged).
- [ ] Exactly **one** paid invoice is booked for the first period; replaying the callback does **not** double-book.
- [ ] Free plan → paid: **Set up billing** switches the plan (fee gate passes) and charges the first period.
- [ ] Discount code at billing: a **partial** discount prices the checkout down; a **free-period / 100%** code activates immediately with **no** checkout (dashboard shows success, no redirect).
- [ ] Owner-provided customer ref (`CUS_...`) is captured after a paid checkout.

### 2.3 Plan change 🔧
- [ ] **Upgrade**: prorated top-up charged; plan switches immediately; entitlements update.
- [ ] Upgrade **recovery**: if the switch step fails after a successful charge, a retry recovers (verifies the ref, applies the upgrade, does NOT double-charge). Tenant never left paid-but-not-upgraded.
- [ ] **Downgrade**: scheduled for period end; no mid-cycle refund/entitlement change; applied at the next renewal.
- [ ] Upgrade requires active recurring billing; rejected otherwise with a clear message.

### 2.4 Payouts (required)
- [ ] **Set up payouts** creates the MoMo subaccount (MTN/VOD/ATL); until done, the store cannot be checked out from (storefront shows the payout notice / "we couldn't start that payment").
- [ ] After payout setup, storefront checkout works and the store appears in the public list.

### 2.5 AI writing add-on 🔧
- [ ] With `ANTHROPIC_API_KEY` **set** and the admin switch **on**: the add-on page shows a **buy** button; status `available=true`.
- [ ] Purchase → **`checkout.paystack.com`** (not 404); first month charged; add-on **active**; the ✨ assist actually rewrites text.
- [ ] With `ANTHROPIC_API_KEY` **unset** (or admin switch **off**): the add-on page shows an **"isn't available"** notice, no buy button; a direct checkout attempt returns 503; the renewal sweep charges no one.
- [ ] Assist is gated: inactive add-on → 402 / "paid add-on" prompt.

### 2.6 Design studio (catalogue)
- [ ] Create/edit collections and designs; plan design-limit enforced (over-limit blocked).
- [ ] Size bands + measurement fields; per-design size-band override CRUD.
- [ ] Colour variations CRUD + reorder (plan-capped).
- [ ] Bespoke display amount + deposit override.

### 2.7 Orders & fulfilment
- [ ] Orders board renders the full four stages; filter by status.
- [ ] Advance an order through stages; per-stage customer notification fires.
- [ ] 🔧 Advancing is safe under concurrency (no double-fire of fulfilment side effects / handover auto-arrange).
- [ ] Cancel an order where allowed; illegal transitions rejected.

### 2.8 Money
- [ ] **Money summary** totals reconcile (succeeded payments; reversed excluded).
- [ ] **Manual/offline takings**: recorded **fee-free** (no commission), never routed through Paystack.
- [ ] Payments list shows through-platform charges with commission.

### 2.9 Availability, handovers, promotions, settings
- [ ] Availability windows (daily/weekly/monthly + specific-date) + blackout days behave on dashboard + storefront.
- [ ] Pickup & delivery handovers arrange/track (courier + note).
- [ ] Promotions CRUD; scope/targets; applied to price correctly.
- [ ] Store settings: customization, delivery zones, fee pass-to-buyer toggle, verification.

### 2.10 Team, billing & security
- [ ] Add/remove team users; only owner/admin manage users; cannot mint a second owner; cannot demote/disable the owner.
- [ ] Owner transfer requires owner + confirmation.
- [ ] MFA enrol/verify/disable; TOTP replay guard; MFA lockout after 5 bad codes / 15 min.
- [ ] Password change; strength enforced.
- [ ] 🔧 **Login lockout**: after **10** consecutive wrong passwords the account is locked ~15 min → login returns **429 `account_locked`** even with the correct password; a successful login later clears the counter.

---

## 3. Admin console

### 3.1 Access & security
- [ ] Admin login (email + password); role-scoped permissions enforced.
- [ ] 🔧 **Admin login lockout**: after **5** consecutive wrong passwords the account locks ~15 min (429 `account_locked`); cleared on success.
- [ ] A support/lower role is forbidden from operator-only actions.

### 3.2 Verifications & businesses
- [ ] Review Ghana Card verifications (approve / reject / hold with reason).
- [ ] Manage business status (block/hold/active); blocked stores are gated.

### 3.3 Plans, subscriptions & billing
- [ ] Plans & packages CRUD (archive with reason; never hard-delete).
- [ ] Subscriptions view: MRR/commission tiles, lifecycle attention.
- [ ] **Create auth** → opens a **checkout** for the cadence renewal; **Verify auth** books a **paid** invoice + captures the authorization (advances the period so the sweep won't double-charge).
- [ ] 🔧 **Verify auth replay** (double-click / callback + manual): does **not** issue a second invoice or advance the period twice.
- [ ] **Run charges** (recurring sweep): card subs silently charged; **MoMo** subs get a re-pay reminder (not a silent charge).
- [ ] 🔧 **Sweep timeout recovery**: a charge that times out after the card was actually debited is marked **paid** (verified), not failed — next cycle does NOT re-charge.
- [ ] **Run sweep** fails overdue invoices + cancels expired-grace subs; invoices Issue/Mark paid/Mark failed behave.

### 3.4 Platform settings 🔧
- [ ] **AI writing add-on available** toggle: turning it **off** hides the buy button for all stores, blocks add-on checkout, and stops renewals; turning it **on** restores it (only where the AI is configured). Change takes effect without a redeploy.
- [ ] Maintenance mode, brand logo, marketing flags, verification SLA, payout threshold persist.

### 3.5 Money reversal 🔧
- [ ] Reverse a succeeded payment: payment → `reversed`; promo/affiliate/referral rows voided; **the order's `settled_minor` is reduced** by the reversed amount (order + ledger agree). Confirm the operator note that a **Paystack refund is a separate manual step**.

### 3.6 Readiness & other tools
- [ ] Launch-readiness score/gates render; blocked/watch counts correct.
- [ ] Platform metrics, audit log entries recorded for admin actions.

---

## 4. Payments & money rails (cross-cutting)

- [ ] **Webhook signature**: a forged/invalid-signature webhook is rejected; a valid one settles.
- [ ] **Webhook idempotency**: re-delivering the same event has no additional effect (settle-once).
- [ ] 🔧 **Webhook amount reconciliation**: a `charge.success` reporting **less** than the expected amount does NOT settle the order as fully paid.
- [ ] **Single-store split**: `transaction_charge` = commission to platform; merchant subaccount gets the rest; commission floor+cap + VAT internally consistent (`Net + VAT == Gross`).
- [ ] **Marketplace split** reconciles: Σ subaccount net + platform commission == total; no rounding leak.
- [ ] **Subscription lifecycle**: intro → renewal figures; VAT grossing consistent between charge and booked invoice.
- [ ] 🔧 **AI add-on renewal**: deterministic per-period reference — an overlapping / retried sweep does **not** double-charge; a transport error **defers** (retries same ref) rather than revoking.
- [ ] 🔧 **Discount cap**: two concurrent checkouts of a last-slot code cannot both redeem (cap enforced atomically under the code lock, counting applied + recent-pending).
- [ ] **Offline takings** never touch Paystack and carry zero commission.

---

## 5. Security & multi-tenancy

- [ ] **Tenant isolation**: a business token cannot read/write another tenant's data (orders, designs, subscriptions, payments) — RLS fail-closed.
- [ ] Tokens are scoped from the verified JWT `business_id`/role, never a client-supplied value.
- [ ] **JWT**: only HS256 accepted (no `alg=none`/confusion); issuer, audience, expiry, and per-scope `typ` enforced; token types (access/admin/customer/mfa) not swappable.
- [ ] 🔧 **Prod config guard**: with a non-`production` env value (`prod`, `staging`, unset-on-a-real-deploy) the API refuses to start on the default JWT signing key / dev stubs. (Confirm prod itself starts cleanly with real secrets.)
- [ ] 🔧 **DB-role RLS assertion**: on a non-local env, the API refuses to start if the connected DB role is a superuser / can `BYPASSRLS`.
- [ ] Rate limiting: per-IP limiter active; combined with the new per-account login lockout.
- [ ] Logout/refresh: refresh rotation is single-use; logout revokes the server session (access token expires within its short TTL).

---

## 6. Data integrity, concurrency & migrations

- [ ] 🔧 Migrations **000081–000084** apply cleanly on a fresh DB and forward from the current prod schema; API boots after `migrate up`.
- [ ] Idempotency on double-submit / retry: subscription activation, add-on activation, plan upgrade, promotion reserve, balance charge — none double-charge or double-book.
- [ ] Concurrency: discount cap, customer-by-phone, stage advance, promotion reserve behave under simultaneous requests.
- [ ] No orphaned drafts/customers after a failed/compensated checkout.

---

## 7. Regression smoke (fast pass before sign-off)

- [ ] Storefront: browse → add note → checkout → pay (test) → order confirmed.
- [ ] Business: set up billing (MoMo) → active + one invoice; set up payouts → store live.
- [ ] Admin: toggle AI add-on off → business sees it unavailable; toggle on → available.
- [ ] Security: 10 bad business logins → `account_locked`; correct password after unlock → success.
- [ ] Money: reverse a payment → order `settled_minor` drops; money summary excludes it.

---

### Sign-off
- QA lead: __________________  Date: ________  Result: PASS / FAIL
- UAT owner: ________________  Date: ________  Result: PASS / FAIL
- Notes / open defects: ______________________________________________
