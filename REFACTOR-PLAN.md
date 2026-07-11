# Xtiitch — Modularization & Linting Refactor Plan

> **Audience:** the engineer/agent executing the refactor.
> **Nature of this work:** a **pure, behaviour-preserving refactor** + the introduction of enforced quality gates. **No feature changes, no bug fixes, no SQL changes, no API contract changes.** If you find a bug, write it down — do not fix it in a refactor commit.
> **Prime directive:** every commit must leave `go build ./...`, `go test ./...`, `pnpm check`, and `pnpm test` **green**. If a step can't stay green, it's too big — split it.

---

## 1. Why we're doing this

The codebase is architecturally sound (Go hexagonal: `domain` → `application` (ports) → `adapters` → `bootstrap`; React Router v7 SSR frontends). The problem is **a handful of god-files** and **no Go lint gate**, which together make the money/security-critical code hard to review, test, and change safely.

### 1.1 Evidence (measured)

**Go — production files ≥ 900 lines** (54,311 total prod LOC / 138 files; healthy avg but a fat tail):

| File | Lines | Layer | Problem |
|---|---:|---|---|
| `apps/api/internal/adapters/outbound/postgres/admin_auth_repository.go` | 8025 | adapter | god-repository: ~10 sub-domains in one file |
| `apps/api/internal/application/adminauth/service.go` | 7307 | application | god-service: verifications, businesses, plans, subscriptions/billing, settings, money, users/roles, promotions, affiliates, referrals, marketing, readiness, metrics |
| `apps/api/internal/adapters/inbound/http/adminauth/handler.go` | 5297 | inbound | god-handler mirroring the above |
| `apps/api/internal/application/auth/service.go` | 2006 | application | mixes login/session/MFA/OTP/password + subscription billing + discounts |
| `apps/api/internal/application/checkout/service.go` | 1540 | application | 4 methods flagged by Sonar at cognitive complexity 20–60 |
| `apps/api/internal/adapters/outbound/postgres/business_identity_repository.go` | 1489 | adapter | fat repo |
| `apps/api/internal/application/ports/admin.go` | 1332 | ports | fat interfaces (interface-segregation violation) |
| `apps/api/internal/adapters/outbound/postgres/payment_repository.go` | 1321 | adapter | money-critical; settlement + reconcile + campaigns |
| `apps/api/internal/adapters/inbound/http/catalogue/handler.go` | 1244 | inbound | |
| `apps/api/internal/adapters/inbound/http/auth/handler.go` | 1095 | inbound | |
| `apps/api/internal/adapters/outbound/postgres/order_repository.go` | 1054 | adapter | |
| `apps/api/internal/application/ports/ports.go` | 930 | ports | fat interfaces |

Largest test files (split alongside their subjects): `adminauth/service_test.go` 4989, `auth/service_test.go` 2434, `checkout/service_test.go` 1590.

**Frontend:**

| File | Lines | Problem |
|---|---:|---|
| `apps/admin/app/routes/admin.tsx` | 21,890 | one route file, ~129 sections/components inlined |
| `apps/dashboard/app/routes/dashboard.tsx` | 17,932 | one route file, ~30+ components inlined (`Panel`, `MetricCard`, `OrdersKanban`, `WorkspaceRail`, …) |
| `apps/admin/app/lib/api.ts` | 3746 | one client with every admin call + payload mapper |
| `apps/storefront/app/routes/design.tsx` | 2808 | |
| `apps/marketing/app/components/ui.tsx` | 1834 | |
| `apps/storefront/app/components/storefront.tsx` | 1663 | |
| `apps/marketing/app/routes/home.tsx` | 1319 | |
| `apps/dashboard/app/routes/register.tsx`, `login.tsx`, `billing-onboarding.tsx` | ~900 each | |

### 1.2 Tooling gap
- CI (`.github/workflows/check.yml`) runs `pnpm check` (`eslint . --max-warnings=0` + per-workspace `check`), `pnpm test`, `pnpm sonar`. Sonar's quality gate blocks (`sonar.qualitygate.wait=true`).
- **There is NO Go linter** (no `.golangci.yml`, no `golangci-lint` in CI or Makefile). Go quality is only observed via Sonar after the fact, and **nothing enforces file/function size**. This is the single biggest process gap.
- ESLint is wired but there is **no visible flat config** capping component/file size, and the giant route files pass it.

---

## 2. Principles (apply to every change)

1. **Behaviour-preserving.** Move code; do not rewrite logic. A reviewer must be able to confirm "same bytes, new home" by diff. No renamed exported symbols, no changed signatures unless the step is explicitly an interface-segregation step (§5.4), and even then the behaviour is identical.
2. **Single Responsibility per file.** One file = one cohesive concern (one sub-domain, one aggregate, one feature). Package stays the same during the mechanical phase (Go allows many files per package).
3. **Dependency Inversion / DI — keep and sharpen it.** The app already injects `ports` interfaces via `Dependencies` structs and constructors. Do **not** introduce globals, service locators, or `init()` wiring. When you split, keep constructor injection; when you segregate interfaces (§5.4) the concrete adapter still satisfies the small interfaces, wired in `bootstrap`.
4. **Interface Segregation.** Fat repository interfaces (`ports/admin.go`, `ports/ports.go`) should become several role interfaces named for their consumer's need (e.g. `AdminSubscriptionStore`, `AdminVerificationStore`). One concrete adapter implements many small interfaces.
5. **File & function budgets (enforced by lint after Phase 3):**
   - Go: file ≤ **600** lines (target ≤ 400); function ≤ **80** lines / **50** statements; cyclomatic ≤ **15**; cognitive ≤ **15** (matches Sonar); ≤ **7** params (use a struct).
   - TS/TSX: file ≤ **400** lines; component/function ≤ **150** lines; one exported component per file for non-trivial components.
   - These are *targets*; a handful of justified exceptions may be `//nolint`-annotated with a reason.
6. **Test-green at every commit** (see §7). Never land a red step.
7. **No behaviour drift proof:** the money/security paths are covered by unit + integration tests and by `QA-UAT-checklist.md`. A refactor that keeps all of them green is your acceptance evidence.

---

## 3. Tooling — introduce enforced gates FIRST (Phase 0)

Do this before moving code, so every subsequent split is measured against the gate. Land the gate **non-blocking first** (report only), fix the code, then flip it to blocking.

### 3.1 Go — add `golangci-lint`

Create `apps/api/.golangci.yml`:

```yaml
run:
  timeout: 5m
  tests: true
linters:
  enable:
    - gofmt
    - goimports
    - govet
    - staticcheck
    - revive           # style / naming / early-return
    - gocyclo          # cyclomatic complexity
    - gocognit         # cognitive complexity (mirror Sonar)
    - funlen           # function length
    - lll              # line length
    - errcheck
    - ineffassign
    - unconvert
    - unparam
    - misspell
    - unused
    - nakedret
    - bodyclose        # http response bodies
    - rowserrcheck     # sql rows.Err()
    - sqlclosecheck    # sql rows/stmt closed
    - gosec            # security — important for a money platform
linters-settings:
  gocyclo: { min-complexity: 15 }
  gocognit: { min-complexity: 15 }
  funlen: { lines: 80, statements: 50 }
  lll: { line-length: 140 }
  revive:
    rules:
      - { name: early-return }
      - { name: unused-parameter }
issues:
  max-issues-per-linter: 0
  max-same-issues: 0
  exclude-rules:
    # generated/integration test helpers can be noisier — narrow, not blanket
    - { path: _integration_test\.go, linters: [funlen, gocognit, gocyclo] }
```

- **File-length is not a golangci-lint linter.** Add a tiny CI guard (§3.3).
- Add a `apps/api/Makefile` target: `lint: ; golangci-lint run ./...`.

### 3.2 Frontend — tighten ESLint (flat config) + Prettier

Add/extend the flat config so size is enforced (per app, or a shared `packages/eslint-config`):

```js
// eslint.config.js additions (per frontend app or shared)
export default [
  // ...existing react/ts config...
  {
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }],
      "complexity": ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
    },
  },
];
```
Start as `warn`, flip the size rules to `error` (which `--max-warnings=0` already treats as blocking) once each app is under budget.

### 3.3 File-length CI guard (both stacks)

Add `scripts/check-file-size.mjs` (fails if any tracked source file exceeds its budget) and call it from `pnpm check`:

```
Go prod .go ≤ 600 lines · Go _test.go ≤ 800 · .ts/.tsx ≤ 400
(allowlist a decreasing set of known-huge files during migration; the allowlist MUST shrink every PR and reach empty at the end.)
```

### 3.4 Wire into CI
- Add a **Go lint** step to `check.yml`: `cd apps/api && golangci-lint run ./...` (use the official `golangci/golangci-lint-action`).
- Keep `pnpm check` (now including the file-size guard).
- Order: run lint **before** tests so a style break fails fast.

**Deliverable of Phase 0:** the gates exist and run in CI in **report-only** mode with an explicit allowlist of the current god-files. No code moved yet.

---

## 4. Execution order (phases)

Do phases in order. Each phase is many small PRs; each PR is independently green and reviewable.

- **Phase 0 — Tooling** (§3): land linters + file-size guard in report-only mode with an allowlist.
- **Phase 1 — Mechanical file splits (Go)** (§5.1–5.3): split each god-file into per-concern files **within the same package**. Pure moves. Remove each file from the allowlist as it drops under budget. Highest safety, highest immediate value.
- **Phase 2 — Complexity reduction (Go)** (§5.5): extract helper functions from the Sonar-flagged high-complexity methods (`checkout`, sweeps). Small, local, test-covered.
- **Phase 3 — Interface segregation (Go, optional but recommended)** (§5.4): split fat `ports` interfaces into role interfaces; optionally extract cohesive sub-domains into sub-packages.
- **Phase 4 — Frontend decomposition** (§6): break the route god-components into feature folders + shared UI primitives.
- **Phase 5 — Flip gates to blocking** (§3): allowlist empty, size rules `error`, Go lint required. Update `sonar` gate if needed.

> Backend and frontend phases are independent and can run in parallel by different people.

---

## 5. Go refactor — target structure & split maps

### 5.0 The Go idiom you'll use in Phase 1
Go allows **many files in one package**. Splitting `adminauth/service.go` into `service_subscriptions.go`, `service_verifications.go`, … requires **zero import changes and zero call-site changes** — the methods still hang off the same `Service` type in `package adminauth`. This is the safest possible refactor. Do this first for all god-files.

Naming convention: keep the base file for the type + constructor (`service.go` keeps `type Service struct`, `Dependencies`, `NewService`, and shared unexported helpers), and move method groups into `service_<concern>.go`. Same for `handler_<concern>.go` and `<domain>_<concern>_repository.go` (or keep one package and use `admin_<concern>_repository.go`).

### 5.1 `adminauth/service.go` (7307) → per-concern files

Split by the sub-domains already visible in the method names. Target ~10 files of 400–800 lines:

| New file | Moves |
|---|---|
| `service.go` | `Service` struct, `Dependencies`, `NewService`, shared unexported helpers (`recordAudit`, `authorizePermission`, `normalize*`, cadence helpers) |
| `service_auth.go` | `Login`, `Refresh`, session/token, `RecordFailedAdminLogin`/`ClearFailedAdminLogin` usage, lockout consts |
| `service_users_roles.go` | `CreateAdminUser`, `UpdateUser*`, `UpdateRole*`, `ReplaceAdminRolePermissions`, preferences, profile, `SignBrandingUpload` |
| `service_verifications.go` | Ghana-Card verification review (approve/reject/hold), `SetRiskReviewStatus`, `SetSettlementReviewHold` |
| `service_businesses.go` | `ListBusinesses*`, `UpdateBusiness*`, business status/hold |
| `service_plans.go` | `ListPlans*`, `UpdatePlan*`, plan packages CRUD |
| `service_subscriptions.go` | `ListSubscription*`, `UpdateSubscription*`, `MarkSubscription*`, `InitializeSubscriptionAuthorization`, `VerifySubscriptionAuthorization`, `RunSubscriptionRecurringSweep`, `RunSubscriptionBillingSweep`, cadence/renewal helpers, reminder emit |
| `service_money.go` | `ReverseMoneyPayment`, money summaries/metrics, replay queue |
| `service_growth.go` | affiliates, referrals, promotions admin, ad campaigns (`Create/Update/List Affiliate*`, `CreateReferral*`, `UpdatePromotion*`, `UpdateAdCampaign`, support tickets) |
| `service_settings.go` | `GetPlatformSettings`, `UpdatePlatformSettings`, `UpdateMarketingFlags`, readiness (`launchReadiness`), `WhatsAppEnabled`/`SMSEnabled` |

Split `service_test.go` (4989) the same way (`service_subscriptions_test.go`, …); move the shared fakes/harness (`fakeAdminUsers`, `fakeAdminBusinesses`, `newTestServiceWithBusinesses`, `sequenceIDs`) into a `service_test_helpers_test.go`.

### 5.2 `admin_auth_repository.go` (8025) → per-concern repo files

Same package (`postgres`), same `AdminAuthRepository` receiver. Split into `admin_<concern>_repository.go` mirroring §5.1: `admin_auth_repository.go` (base + role/query helpers, `subscriptionInvoiceOpen`/`subscriptionInvoiceRefTaken`/`pgError` helpers), `admin_subscriptions_repository.go` (issue/mark/verify invoices, recurring, `UpdateAdminSubscription`, `IssueAdminSubscriptionInvoice`, `MarkAdminSubscriptionInvoicePaid/Failed`), `admin_money_repository.go` (`ReverseAdminMoneyPayment` + the reversal CTE), `admin_verifications_repository.go`, `admin_businesses_repository.go`, `admin_plans_repository.go`, `admin_users_repository.go`, `admin_settings_repository.go` (platform settings get/update + `scanAdminPlatformSettingsRecord`), `admin_growth_repository.go`. Split the 1274-line integration test alongside.

### 5.3 `adminauth/handler.go` (5297) → per-concern handler files

Same `Handler` receiver + `package adminauth` (inbound). Keep `Register(router)` + shared request/response helpers + `authError` in `handler.go`; move each group of endpoints + their request/response DTOs into `handler_<concern>.go` matching §5.1. Keep the route registrations together in `Register` (so the route table stays readable) but the handler funcs live in their concern files.

Also split the other fat handlers the same way: `catalogue/handler.go` (1244), `auth/handler.go` (1095).

### 5.4 Interface segregation (Phase 3) — `ports/admin.go` (1332) & `ports/ports.go` (930)

The fat interfaces (`AdminBusinessRepository`, `AdminUserRepository`, `BusinessIdentityRepository`) each carry ~20–30 methods — a consumer needing 3 methods depends on 30. Split into **role interfaces per concern**, e.g.:

```go
// ports/admin_subscriptions.go
type AdminSubscriptionStore interface {
    IssueAdminSubscriptionInvoice(...) (...)
    MarkAdminSubscriptionInvoicePaid(...) (...)
    // ... only subscription methods
}
// ports/admin_money.go
type AdminMoneyStore interface { ReverseAdminMoneyPayment(...) (...) }
```

The concrete `AdminAuthRepository` still satisfies all of them (Go structural typing — no change to the adapter). Then narrow each service file to depend on the small interface it needs (either as a typed field or by keeping the wide field but documenting the seam). **Do this only after Phase 1** so the moves and the interface changes aren't tangled in one diff. Keep `bootstrap` wiring identical (the same concrete value is assigned to the narrower field).

Also split `ports.go`/`admin.go` into `ports_<concern>.go` files (types + interfaces grouped by domain) even without changing method sets — that alone gets them under budget.

### 5.5 Complexity reduction (Phase 2)

Sonar flags these (cognitive complexity in parentheses) — extract cohesive private helpers, keep behaviour identical:

| Method | File | Complexity | Suggested extraction |
|---|---|---:|---|
| `PlaceCartOrder` | `checkout/service.go:360` | 60 | extract `buildCartLines`, `resolveDelivery`, `persistCartGroup`, `raiseCartCharge` |
| `PlaceMarketplaceOrder` | `checkout/service.go:617` | 23 | extract per-store validation + `buildMarketplaceStoreGroup` is already separate; pull the customer/compensation logic into helpers |
| `PlaceHomeVisitBooking` | `checkout/service.go:~940` | 37 | extract slot validation, booking persistence, charge |
| `PlaceStandardOrder` | `checkout/service.go:172` | 20 | extract pricing + persistence helpers |
| `RunSubscriptionRecurringSweep` | `adminauth/service.go` | high | extract `chargeOneRenewal`, `handleChargeOutcome` |

`auth/service.go` (2006): split into `service.go` (type/deps/ctor), `service_login.go` (login/session/MFA/OTP/password/lockout/owner-transfer), `service_subscription.go` (init/verify/discounts/plan-change/proration), `service_identity.go` (identity doc/verification). This also naturally lowers per-file complexity.

---

## 6. Frontend refactor — target structure & split maps

**Target layout per app** (React Router v7 SSR; keep loaders/actions in the route, move UI + logic out):

```
app/
  routes/<route>.tsx        # route only: meta, loader, action, and a thin composition of feature components
  features/<feature>/       # one folder per feature area
    <Feature>Panel.tsx      # one exported component per file
    use<Feature>.ts         # hooks (client state, form handling)
    <feature>.types.ts      # local types
  components/ui/            # shared presentational primitives (Panel, MetricCard, SectionHeader, ToneChip, PaginationFooter, EmptyState, chips, fields)
  lib/                      # api client(s), formatters, guards (already exists)
```

**DI/props discipline:** components receive data via **props** from the route loader (already the pattern); do not add module-level singletons or reach into the api client from deep components. Data fetching stays in the route `loader`/`action`; mutations post to the route `action`. Extract reusable data-shaping into `lib/` pure functions or `features/*/use*.ts` hooks.

### 6.1 `apps/dashboard/app/routes/dashboard.tsx` (17,932)

It already contains named components — extract them file-by-file. Concrete first moves (verified present in the file):

| Extract to | Components |
|---|---|
| `components/ui/` | `Panel`, `SectionHeader`, `MetricCard`, `ToneChip`, `PaginationFooter`, `EmptyState`, `PlanGatedControl`, `StyledDateTimeField`, `StyledTimeField`, `HeaderSignal`, `PriorityRibbon` |
| `features/shell/` | `WorkspaceRail`, `WorkspaceTopBar`, `WorkspaceHeader` |
| `features/overview/` | `ManagementOverviewPanel`, `StoreReadinessPanel`, `TodayFocusPanel` |
| `features/billing/` | `BillingSetupBanner` (+ related billing widgets) |
| `features/orders/` | `OrdersKanban`, `OrdersWorkspace` |
| `features/<studio/money/availability/handovers/promotions/settings/team>/` | the remaining section panels |
| `routes/dashboard.tsx` | keep only `meta`, `loader`, `action`, the top-level `Dashboard()` that composes the panels, and the section-routing state |

Extract the loader/action data types into `features/*/types` and any big helper reducers into `features/*/use*.ts`.

### 6.2 `apps/admin/app/routes/admin.tsx` (21,890) & `apps/admin/app/lib/api.ts` (3746)

Same treatment, mirroring the admin sub-domains (verifications, businesses, plans, subscriptions, settings, money, readiness, users). The route keeps `loader`/`action`; each admin section becomes `features/<section>/`. Split `lib/api.ts` into `lib/api/<domain>.ts` (one file of calls + payload mappers per domain: `api/subscriptions.ts`, `api/money.ts`, `api/settings.ts`, …) re-exported from `lib/api/index.ts` so imports don't churn.

### 6.3 Others (lower priority, same pattern)
`storefront/app/routes/design.tsx` (2808) → split product gallery / size+price / variations / bespoke into `features/design/*`. `marketing/app/components/ui.tsx` (1834) → split into `components/ui/*`. `storefront/app/components/storefront.tsx` (1663), `marketing/app/routes/home.tsx` (1319), `dashboard/app/routes/{register,login,billing-onboarding}.tsx` (~900 each) → extract sub-components + hooks.

---

## 7. Definition of Done — per PR

Every PR (a single file's split or a single interface's segregation) must:
1. Be a **pure move / mechanical extraction** — reviewer confirms no logic change by diff.
2. Keep `go build ./...` **and** `go test ./...` green (backend) — run before pushing.
3. Keep `pnpm -w check` + the relevant app's `pnpm --filter <app> test` green (frontend).
4. Not change any exported symbol name, HTTP route, SQL, or JSON shape (except a Phase-3 interface-segregation PR, which changes *interface definitions* only, never behaviour).
5. Remove the touched file(s) from the file-size allowlist (§3.3) — the allowlist only ever shrinks.
6. Be scoped to **one file / one concern**. Do not batch unrelated splits.
7. Commit message: `refactor(<area>): split <file> — <concern> (no behaviour change)`.

## 8. Verification / acceptance (whole effort)
- `golangci-lint run ./...` passes with the §3.1 config (allowlist empty).
- ESLint size rules pass as errors; `pnpm check` green.
- File-size guard passes with an **empty** allowlist.
- Full `go test ./...`, `pnpm test`, and Sonar quality gate green.
- Re-run the money/security items in `QA-UAT-checklist.md` (or at least the automated subset) to confirm no behaviour drift.
- No file over budget: Go ≤ 600, TS/TSX ≤ 400 (justified `//nolint`/eslint-disable exceptions counted and listed).

## 9. Risks & mitigations
- **`adminauth`, `payment_repository`, `checkout` are money/security-critical.** Mitigation: mechanical moves only in Phase 1–2; the extensive unit + integration tests and `QA-UAT-checklist.md` are the regression net. Never combine a move with a logic tweak.
- **Merge conflicts on the god-files** while multiple PRs are in flight. Mitigation: split one god-file to completion (a short series of PRs) before starting another; coordinate ownership.
- **Interface segregation churn** (Phase 3) can ripple to `bootstrap`. Mitigation: keep the concrete adapter satisfying every small interface; change only field *types*, not wiring values; do it after Phase 1/2.
- **Frontend loader/action coupling.** Mitigation: keep data fetching in the route; extract only presentational components + pure helpers first; hooks later.
- **"While I'm here" scope creep.** Mitigation: §2.1 and §7 — bugs get logged, not fixed here.

## 10. Suggested sequencing for the executing agent (checklist)
1. [ ] Phase 0: add `.golangci.yml`, ESLint size rules, `check-file-size.mjs` (report-only + allowlist), CI Go-lint step. Confirm CI still green.
2. [ ] Phase 1a: split `adminauth/service.go` → 10 files (§5.1) + its test file. Green. Allowlist −1.
3. [ ] Phase 1b: split `admin_auth_repository.go` (§5.2) + integration test. Green.
4. [ ] Phase 1c: split `adminauth/handler.go` (§5.3). Green.
5. [ ] Phase 1d: split `auth/service.go` (§5.5) + `checkout/service.go` file-level, `business_identity_repository.go`, `payment_repository.go`, `order_repository.go`, `catalogue/handler.go`, `auth/handler.go`, `ports/{admin,ports}.go` by concern.
6. [ ] Phase 2: extract complexity hotspots (§5.5) until gocognit/gocyclo pass.
7. [ ] Phase 3 (optional): interface segregation (§5.4).
8. [ ] Phase 4: frontend — `dashboard.tsx`, then `admin.tsx` + `lib/api.ts`, then the rest (§6).
9. [ ] Phase 5: allowlist empty → flip all size gates to blocking; confirm CI red on a deliberate over-budget file, then green.

---

### Appendix A — quick commands
- Go file sizes: `find apps/api -name '*.go' ! -name '*_test.go' | xargs wc -l | sort -rn | head -30`
- Go complexity (after install): `golangci-lint run --disable-all -E gocognit,gocyclo,funlen ./...`
- Frontend sizes: `find apps/<app>/app -name '*.tsx' -o -name '*.ts' | xargs wc -l | sort -rn | head -20`
- Behaviour safety net: `cd apps/api && go build ./... && go test ./...` ; `pnpm check && pnpm test`
