#!/usr/bin/env node
import { performance } from "node:perf_hooks";

const options = parseArgs(process.argv.slice(2));
const storefrontBase = cleanBase(
  option("storefront-url") ||
    process.env.STOREFRONT_BASE_URL ||
    "http://127.0.0.1:3402",
);
const apiBase = apiV1Base(
  option("api-url") || process.env.XTIITCH_API_URL || "http://127.0.0.1:8080",
);
const handle = option("handle") || process.env.STOREFRONT_HANDLE || "demo-atelier";
const totalRequests = positiveInt(option("requests") || process.env.STOREFRONT_LOAD_REQUESTS, 80);
const concurrency = positiveInt(option("concurrency") || process.env.STOREFRONT_LOAD_CONCURRENCY, 8);
const timeoutMs = positiveInt(option("timeout-ms") || process.env.STOREFRONT_LOAD_TIMEOUT_MS, 5000);
const maxP95Ms = positiveInt(option("max-p95-ms") || process.env.STOREFRONT_LOAD_MAX_P95_MS, 2000);

console.log("Xtiitch storefront/catalogue load smoke");
console.log(`storefront: ${storefrontBase}`);
console.log(`api:        ${apiBase}`);
console.log(`store:      ${handle}`);
console.log(`requests:   ${totalRequests} @ concurrency ${concurrency}\n`);

const storePage = await fetchJSON(`${apiBase}/public/stores/${encodeURIComponent(handle)}`);
const storeName = storePage.store?.name || handle;
const design =
  option("design") ||
  process.env.STOREFRONT_DESIGN_HANDLE ||
  storePage.designs?.[0]?.handle ||
  "";
const collection =
  option("collection") ||
  process.env.STOREFRONT_COLLECTION_HANDLE ||
  storePage.collections?.[0]?.handle ||
  "";
const searchQuery =
  option("query") ||
  process.env.STOREFRONT_SEARCH_QUERY ||
  storePage.designs?.[0]?.title?.split(/\s+/)[0] ||
  "a";

const targets = [
  {
    name: "api store catalogue",
    url: `${apiBase}/public/stores/${encodeURIComponent(handle)}`,
    json: true,
    assert: (json) => Array.isArray(json.designs) && json.store?.handle === handle,
  },
  {
    name: "api store search",
    url: `${apiBase}/public/stores/${encodeURIComponent(handle)}/search?q=${encodeURIComponent(searchQuery)}`,
    json: true,
    assert: (json) => Array.isArray(json.designs) && json.store?.handle === handle,
  },
  {
    name: "storefront store page",
    url: `${storefrontBase}/store/${encodeURIComponent(handle)}`,
    includes: storeName,
  },
  {
    name: "storefront search page",
    url: `${storefrontBase}/store/${encodeURIComponent(handle)}?q=${encodeURIComponent(searchQuery)}`,
    includes: storeName,
  },
  {
    name: "storefront tracking lookup",
    url: `${storefrontBase}/track`,
    includes: "Customer tracking",
  },
];

if (design) {
  targets.push(
    {
      name: "api design detail",
      url: `${apiBase}/public/designs/${encodeURIComponent(design)}`,
      json: true,
      assert: (json) => json.handle === design,
    },
    {
      name: "storefront design detail",
      url: `${storefrontBase}/d/${encodeURIComponent(design)}`,
      includes: storeName,
    },
  );
}

if (collection) {
  targets.push(
    {
      name: "api collection detail",
      url: `${apiBase}/public/collections/${encodeURIComponent(collection)}`,
      json: true,
      assert: (json) => json.collection?.handle === collection,
    },
    {
      name: "storefront collection page",
      url: `${storefrontBase}/c/${encodeURIComponent(collection)}`,
      includes: storeName,
    },
  );
}

await warmUp(targets);
const results = await runLoad(targets);
const failures = results.filter((result) => result.error);
const durations = results
  .filter((result) => !result.error)
  .map((result) => result.durationMs)
  .sort((a, b) => a - b);
const targetStats = summarizeByTarget(results);
const p95 = percentile(durations, 0.95);

for (const stat of targetStats) {
  const status = stat.failures > 0 ? "fail" : "ok";
  console.log(
    `[${status}] ${stat.name}: ${stat.count - stat.failures}/${stat.count} ok, p50=${formatMs(
      stat.p50,
    )}, p95=${formatMs(stat.p95)}, max=${formatMs(stat.max)}`,
  );
}

console.log(
  `\noverall: ${results.length - failures.length}/${results.length} ok, p50=${formatMs(
    percentile(durations, 0.5),
  )}, p95=${formatMs(p95)}, max=${formatMs(durations.at(-1) ?? 0)}`,
);

if (failures.length > 0) {
  console.error("\nFailures:");
  for (const failure of failures.slice(0, 10)) {
    console.error(`- ${failure.name}: ${failure.error}`);
  }
  process.exitCode = 1;
} else if (p95 > maxP95Ms) {
  console.error(`\nP95 ${formatMs(p95)} exceeded budget ${formatMs(maxP95Ms)}.`);
  process.exitCode = 1;
} else {
  console.log(`P95 stayed within ${formatMs(maxP95Ms)}.`);
}

function parseArgs(args) {
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    if (inlineValue !== undefined) {
      parsed.set(key, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed.set(key, nextValue);
      index += 1;
    } else {
      parsed.set(key, "true");
    }
  }
  return parsed;
}

function option(name) {
  return options.get(name)?.trim();
}

function cleanBase(value) {
  return value.replace(/\/+$/, "");
}

function apiV1Base(value) {
  const base = cleanBase(value);
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchJSON(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }
  return response.json();
}

async function warmUp(targets) {
  await Promise.all(targets.map((target) => hitTarget(target)));
}

async function runLoad(targets) {
  const jobs = Array.from({ length: totalRequests }, (_, index) => targets[index % targets.length]);
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await hitTarget(jobs[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
  );
  return results;
}

async function hitTarget(target) {
  const started = performance.now();
  try {
    const response = await fetchWithTimeout(target.url);
    const body = await response.text();
    const durationMs = performance.now() - started;

    if (!response.ok) {
      return {
        durationMs,
        error: `status ${response.status}`,
        name: target.name,
      };
    }

    if (target.json) {
      const payload = JSON.parse(body);
      if (target.assert && !target.assert(payload)) {
        return {
          durationMs,
          error: "json assertion failed",
          name: target.name,
        };
      }
    } else if (target.includes && !body.includes(target.includes)) {
      return {
        durationMs,
        error: `missing expected text "${target.includes}"`,
        name: target.name,
      };
    }

    return { durationMs, name: target.name };
  } catch (error) {
    return {
      durationMs: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
      name: target.name,
    };
  }
}

async function fetchWithTimeout(url) {
  return fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function summarizeByTarget(results) {
  const groups = new Map();
  for (const result of results) {
    const group = groups.get(result.name) ?? [];
    group.push(result);
    groups.set(result.name, group);
  }

  return Array.from(groups, ([name, group]) => {
    const successes = group
      .filter((result) => !result.error)
      .map((result) => result.durationMs)
      .sort((a, b) => a - b);
    return {
      count: group.length,
      failures: group.length - successes.length,
      max: successes.at(-1) ?? 0,
      name,
      p50: percentile(successes, 0.5),
      p95: percentile(successes, 0.95),
    };
  });
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }
  const index = Math.ceil(values.length * ratio) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))];
}

function formatMs(value) {
  return `${Math.round(value)}ms`;
}
