#!/usr/bin/env node
/**
 * File-size budget guard.
 *
 * Fails if any tracked source file exceeds its per-language budget,
 * unless the file is explicitly allowlisted. The allowlist must only
 * shrink over time; the goal is to drive it to empty.
 *
 * Budgets:
 *   - Go production .go (not *_test.go): 600 lines
 *   - Go test *_test.go: 800 lines
 *   - TypeScript / TSX: 400 lines
 *   - Node scripts (.mjs, .js at repo root or in scripts/): 400 lines
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Known oversized files that are being actively split. Remove entries as they
// are refactored; this list must never grow.
const ALLOWLIST = new Set([
  // Go production files
  "apps/api/internal/application/adminauth/service.go",
  "apps/api/internal/application/ports/admin.go",
  "apps/api/internal/application/ports/ports.go",
  "apps/api/internal/application/catalogue/service.go",
  "apps/api/internal/bootstrap/app.go",
  "apps/api/internal/adapters/outbound/postgres/affiliate_repository.go",
  "apps/api/internal/adapters/outbound/postgres/promotion_repository.go",
  // Go test files
  "apps/api/internal/application/catalogue/service_test.go",

  // TypeScript / TSX files
  "apps/admin/app/routes/admin.tsx",
  "apps/dashboard/app/routes/dashboard.tsx",
  "apps/admin/app/lib/api.ts",
  "apps/storefront/app/routes/design.tsx",
  "apps/marketing/app/components/ui.tsx",
  "apps/storefront/app/components/storefront.tsx",
  "apps/marketing/app/routes/home.tsx",
  "apps/marketing/app/components/layout.tsx",
  "apps/storefront/app/routes/account.tsx",
  "apps/dashboard/app/routes/register.tsx",
  "apps/dashboard/app/routes/billing-onboarding.tsx",
  "apps/dashboard/app/routes/login.tsx",
  "apps/admin/app/routes/login.tsx",
  "apps/storefront/app/components/marketplace.tsx",
  "apps/mobile/app/design/[handle].tsx",
  "apps/mobile/app/business/order/[id].tsx",
  "apps/worker/src/senders.ts",
  "apps/storefront/app/routes/track.tsx",
  "apps/dashboard/app/routes/security.tsx",
  "apps/marketing/app/content.ts",
  "apps/marketing/app/routes/growth.tsx",
  "apps/mobile/src/ui.tsx",
  "apps/mobile/app/index.tsx",
  "apps/storefront/app/routes/checkout.tsx",
  "apps/storefront/app/lib/api.ts",
  "apps/marketing/app/root.tsx",
]);

const BUDGETS = [
  { pattern: /_test\.go$/, lines: 800 },
  { pattern: /\.go$/, lines: 600 },
  { pattern: /\.(ts|tsx)$/, lines: 400 },
  { pattern: /\.(mjs|js)$/, lines: 400 },
];

function countLines(filePath) {
  const content = readFileSync(filePath, "utf8");
  let lines = 0;
  for (const char of content) {
    if (char === "\n") lines++;
  }
  // Count the last line even if it has no trailing newline.
  if (content.length > 0 && content.at(-1) !== "\n") lines++;
  return lines;
}

function getTrackedFiles() {
  try {
    const out = execSync("git ls-files", { encoding: "utf8" });
    return out.split("\n").filter(Boolean);
  } catch {
    console.error("Failed to list tracked files; are you in a git repo?");
    process.exit(1);
  }
}

function main() {
  const tracked = getTrackedFiles();
  const violations = [];

  for (const rel of tracked) {
    const ext = path.extname(rel);
    if (!ext) continue;

    const budget = BUDGETS.find((b) => b.pattern.test(rel));
    if (!budget) continue;

    if (!existsSync(rel)) continue;

    const lines = countLines(rel);
    if (lines <= budget.lines) continue;

    if (ALLOWLIST.has(rel)) {
      console.log(
        `ALLOWLISTED  ${rel}: ${lines} lines (budget ${budget.lines})`,
      );
      continue;
    }

    violations.push({ rel, lines, budget: budget.lines });
  }

  if (violations.length > 0) {
    console.error("\nFile-size budget violations:");
    for (const v of violations) {
      console.error(`  ${v.rel}: ${v.lines} lines (budget ${v.budget})`);
    }
    console.error(
      `\n${violations.length} file(s) exceed their budget. Either split them or, if already planned, add them to the allowlist in scripts/check-file-size.mjs.`,
    );
    process.exit(1);
  }

  const allowlisted = Array.from(ALLOWLIST).filter((f) => {
    if (!existsSync(f)) return false;
    const budget = BUDGETS.find((b) => b.pattern.test(f));
    if (!budget) return false;
    return countLines(f) > budget.lines;
  });

  console.log("File-size guard passed.");
  if (allowlisted.length > 0) {
    console.log(
      `  ${allowlisted.length} file(s) remain on the allowlist and will be split in follow-up work.`,
    );
  }
}

main();
