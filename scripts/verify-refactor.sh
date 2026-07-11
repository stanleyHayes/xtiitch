#!/usr/bin/env bash
#
# verify-refactor.sh — prove a behaviour-preserving refactor kept everything working.
#
# A pure refactor must NOT change: the HTTP route table, the public Go API surface,
# the frontend route manifests, or the set of tests. This captures those as a
# "baseline" before you start, then on every step re-captures and DIFFS them — any
# difference means the "pure move" wasn't pure. It also runs the full quality gate.
#
#   scripts/verify-refactor.sh baseline   # run ONCE on the pre-refactor commit
#   scripts/verify-refactor.sh check      # run after each refactor PR (and in CI)
#   scripts/verify-refactor.sh surface    # only re-capture + diff the surface (fast)
#
# Exit 0 = refactor verified (gates green + zero surface drift). Non-zero = investigate.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="$ROOT/apps/api"
BASE="$ROOT/.refactor-baseline"
MODE="${1:-check}"
FAIL=0
step() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓ %s\033[0m\n' "$1"; }
bad()  { printf '  \033[31m✗ %s\033[0m\n' "$1"; FAIL=1; }

capture_surface() { # $1 = output dir
  local out="$1"; mkdir -p "$out"
  # 1) HTTP route table: METHOD PATH, sorted+unique.
  grep -rhoE '\.(Get|Post|Put|Patch|Delete)\("(/[^"]*)"' "$API/internal/adapters/inbound/http/" 2>/dev/null \
    | sed -E 's/\.([A-Za-z]+)\("(.*)"/\1 \2/' | sort -u > "$out/routes.txt"
  # 2) Public Go API surface: exported types + funcs in application/ports/domain.
  grep -rhoE '^(func [A-Z][A-Za-z0-9_]*|func \([a-z_]+ [*]?[A-Za-z0-9_]+\) [A-Z][A-Za-z0-9_]*|type [A-Z][A-Za-z0-9_]*)' \
    "$API/internal/application" "$API/internal/domain" 2>/dev/null | sort -u > "$out/exports.txt"
  # 3) Frontend route manifests, verbatim (route table must not move).
  : > "$out/frontend-routes.txt"
  find "$ROOT/apps" -path '*/app/routes.ts' 2>/dev/null | sort | while read -r f; do
    echo "### ${f#$ROOT/}"; cat "$f"; done >> "$out/frontend-routes.txt"
  # 4) Test inventory: no test may be silently dropped by a move.
  { grep -rhoE '^func Test[A-Za-z0-9_]+' --include='*_test.go' "$API" 2>/dev/null
    grep -rhoE '(it|test|describe)\((["'"'"'`])[^"'"'"'`]+' "$ROOT/apps" \
      --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' --include='*.spec.tsx' 2>/dev/null
  } | sort -u > "$out/tests.txt"
}

diff_surface() {
  [ -d "$BASE" ] || { bad "no baseline found — run: scripts/verify-refactor.sh baseline (on the pre-refactor commit)"; return; }
  local tmp; tmp="$(mktemp -d)"; capture_surface "$tmp"
  for f in routes exports frontend-routes tests; do
    if diff -u "$BASE/$f.txt" "$tmp/$f.txt" > "/tmp/refactor-$f.diff" 2>/dev/null; then
      ok "$f unchanged ($(wc -l < "$tmp/$f.txt" | tr -d ' ') entries)"
    else
      bad "$f DRIFTED — a pure refactor must not change this. See /tmp/refactor-$f.diff:"
      sed 's/^/      /' "/tmp/refactor-$f.diff" | head -40
    fi
  done
  rm -rf "$tmp"
}

run_go_gate() {
  step "Go quality gate (apps/api)"
  ( cd "$API" || exit 1
    if [ -n "$(gofmt -l . 2>/dev/null)" ]; then echo "unformatted:"; gofmt -l . | sed 's/^/      /'; exit 3; fi ) \
    && ok "gofmt clean" || bad "gofmt found unformatted files (run: gofmt -w .)"
  ( cd "$API" && go vet ./... ) >/dev/null 2>&1 && ok "go vet" || bad "go vet failed (run: cd apps/api && go vet ./...)"
  ( cd "$API" && go build ./... ) >/dev/null 2>&1 && ok "go build" || bad "go build failed"
  ( cd "$API" && go test ./... ) >/tmp/refactor-gotest.log 2>&1 && ok "go test ./... ($(grep -c '^ok' /tmp/refactor-gotest.log) packages ok)" \
    || { bad "go test failed — see /tmp/refactor-gotest.log"; grep -E 'FAIL|panic' /tmp/refactor-gotest.log | head -15 | sed 's/^/      /'; }
  LINTER="$(command -v golangci-lint || true)"
  if [ -x "$HOME/go/bin/golangci-lint" ]; then LINTER="$HOME/go/bin/golangci-lint"; fi
  if [ -n "$LINTER" ] && [ -x "$LINTER" ]; then
    ( cd "$API" && "$LINTER" run ./... ) >/tmp/refactor-lint.log 2>&1 && ok "golangci-lint" \
      || { bad "golangci-lint failed — see /tmp/refactor-lint.log"; tail -20 /tmp/refactor-lint.log | sed 's/^/      /'; }
  else
    printf '  \033[33m! golangci-lint not installed — skipped (install per REFACTOR-PLAN §3.1)\033[0m\n'
  fi
}

run_size_gate() {
  step "File-size budget"
  if [ -f "$ROOT/scripts/check-file-size.mjs" ]; then
    node "$ROOT/scripts/check-file-size.mjs" && ok "all files within budget (allowlist shrinking)" || bad "file-size budget exceeded"
  else
    printf '  \033[33m! scripts/check-file-size.mjs missing — skipped (create per REFACTOR-PLAN §3.3)\033[0m\n'
  fi
}

run_frontend_gate() {
  step "Frontend gate"
  if command -v pnpm >/dev/null 2>&1; then
    ( cd "$ROOT" && pnpm -w check ) >/tmp/refactor-pnpm-check.log 2>&1 && ok "pnpm check (eslint + workspace)" \
      || { bad "pnpm check failed — see /tmp/refactor-pnpm-check.log"; tail -20 /tmp/refactor-pnpm-check.log | sed 's/^/      /'; }
    if [ "${SKIP_FRONTEND_TESTS:-}" != "1" ]; then
      ( cd "$ROOT" && pnpm -w test ) >/tmp/refactor-pnpm-test.log 2>&1 && ok "pnpm test" \
        || { bad "pnpm test failed — see /tmp/refactor-pnpm-test.log"; tail -20 /tmp/refactor-pnpm-test.log | sed 's/^/      /'; }
    else printf '  \033[33m! frontend tests skipped (SKIP_FRONTEND_TESTS=1)\033[0m\n'; fi
  else
    printf '  \033[33m! pnpm not found — frontend gate skipped\033[0m\n'
  fi
}

case "$MODE" in
  baseline)
    step "Capturing behaviour baseline → .refactor-baseline/"
    capture_surface "$BASE"
    printf '  routes=%s exports=%s frontend-routes=%s tests=%s\n' \
      "$(wc -l < "$BASE/routes.txt" | tr -d ' ')" "$(wc -l < "$BASE/exports.txt" | tr -d ' ')" \
      "$(wc -l < "$BASE/frontend-routes.txt" | tr -d ' ')" "$(wc -l < "$BASE/tests.txt" | tr -d ' ')"
    ok "baseline captured. Commit .refactor-baseline/ (or keep it out of git and re-run on the base commit)."
    ;;
  surface)
    step "Surface drift check (routes / exports / frontend-routes / tests)"; diff_surface ;;
  check)
    step "Surface drift check"; diff_surface
    run_go_gate; run_size_gate; run_frontend_gate ;;
  *) echo "usage: $0 {baseline|check|surface}"; exit 2 ;;
esac

echo
if [ "$FAIL" -eq 0 ]; then printf '\033[1;32m✅ VERIFY PASSED — gates green, zero behaviour-surface drift.\033[0m\n'
else printf '\033[1;31m❌ VERIFY FAILED — see the ✗ items above.\033[0m\n'; fi
exit "$FAIL"
