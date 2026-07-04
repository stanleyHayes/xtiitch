import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { loadDotEnvFile } from "./lib/env.mjs";

const envPath = ".env.sonar.local";
const hostURL = "http://localhost:9000";
const localQualityGateName = "Xtiitch Local Launch";
const tokenName = `xtiitch-local-${Date.now()}`;

loadDotEnvFile(envPath);

const adminPassword =
  process.env.SONAR_LOCAL_ADMIN_PASSWORD ||
  `xtiitch-local-${randomBytes(12).toString("hex")}`;

ensureLocalEnv({ adminPassword });
run("docker", ["compose", "up", "-d", "sonarqube"]);
await waitForSonar();
await changeDefaultPassword(adminPassword);
const token = await generateToken(adminPassword);
ensureLocalEnv({ adminPassword, token });
await configureLocalQualityGate(adminPassword);

console.log("Local SonarQube is ready");
console.log(`- URL: ${hostURL}`);
console.log(`- Env file: ${envPath}`);
console.log("- Token: generated and stored locally (masked)");
console.log(`- Quality gate: ${localQualityGateName}`);
console.log("- Next: pnpm sonar");

function ensureLocalEnv({ adminPassword, token = process.env.SONAR_TOKEN }) {
  const existing = readEnvFile(envPath);
  const next = {
    ...existing,
    SONAR_HOST_URL: hostURL,
    SONAR_PROJECT_KEY: "xtiitch",
    SONAR_LOCAL_ADMIN_PASSWORD: adminPassword,
  };
  if (token) {
    next.SONAR_TOKEN = token;
  }
  writeEnvFile(envPath, next);
  for (const [key, value] of Object.entries(next)) {
    process.env[key] = value;
  }
}

async function waitForSonar() {
  const waitMs = Number.parseInt(
    process.env.SONAR_LOCAL_WAIT_MS || "900000",
    10,
  );
  const deadline = Date.now() + waitMs;
  let lastStatus = "starting";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${hostURL}/api/system/status`);
      const payload = await response.json();
      lastStatus = payload.status || lastStatus;
      if (payload.status === "UP") {
        return;
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    process.stdout.write(".");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timed out waiting for SonarQube (${lastStatus})`);
}

async function changeDefaultPassword(newPassword) {
  const body = new URLSearchParams({
    login: "admin",
    password: newPassword,
    previousPassword: "admin",
  });
  const response = await sonarFetch("/api/users/change_password", {
    authPassword: "admin",
    body,
  });
  if (response.ok || response.status === 204) {
    return;
  }

  // Existing local volumes usually mean the password has already been changed.
  const withConfiguredPassword = await sonarFetch(
    "/api/authentication/validate",
    {
      authPassword: newPassword,
      method: "GET",
    },
  );
  if (withConfiguredPassword.ok) {
    return;
  }

  throw new Error(
    `Could not set or validate the local Sonar admin password (HTTP ${response.status}).`,
  );
}

async function generateToken(adminPassword) {
  const body = new URLSearchParams({ name: tokenName });
  const response = await sonarFetch("/api/user_tokens/generate", {
    authPassword: adminPassword,
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Could not generate local Sonar token (HTTP ${response.status}).`,
    );
  }
  const payload = await response.json();
  if (!payload.token) {
    throw new Error("Local Sonar token response did not include a token.");
  }
  return payload.token;
}

async function configureLocalQualityGate(adminPassword) {
  const projectKey = process.env.SONAR_PROJECT_KEY || "xtiitch";
  const gate = await ensureLocalQualityGate(adminPassword);
  const detailsResponse = await sonarFetch(
    `/api/qualitygates/show?id=${encodeURIComponent(gate.id)}`,
    {
      authPassword: adminPassword,
      method: "GET",
    },
  );
  const details = await expectJson(
    detailsResponse,
    "Could not load the local Sonar quality gate",
  );

  for (const condition of details.conditions ?? []) {
    await expectOk(
      await sonarFetch("/api/qualitygates/delete_condition", {
        authPassword: adminPassword,
        body: new URLSearchParams({ id: String(condition.id) }),
      }),
      "Could not reset a local Sonar quality gate condition",
    );
  }

  for (const condition of localQualityGateConditions()) {
    await expectOk(
      await sonarFetch("/api/qualitygates/create_condition", {
        authPassword: adminPassword,
        body: new URLSearchParams({
          error: condition.error,
          gateId: String(gate.id),
          metric: condition.metric,
          op: condition.op,
        }),
      }),
      `Could not create local Sonar quality gate condition ${condition.metric}`,
    );
  }

  await expectOk(
    await sonarFetch("/api/qualitygates/select", {
      authPassword: adminPassword,
      body: new URLSearchParams({
        gateId: String(gate.id),
        projectKey,
      }),
    }),
    "Could not associate the local Sonar quality gate with the project",
  );
}

async function ensureLocalQualityGate(adminPassword) {
  const existing = await findLocalQualityGate(adminPassword);
  if (existing) {
    return existing;
  }

  const createResponse = await sonarFetch("/api/qualitygates/create", {
    authPassword: adminPassword,
    body: new URLSearchParams({ name: localQualityGateName }),
  });
  if (!createResponse.ok && createResponse.status !== 400) {
    throw new Error(
      `Could not create the local Sonar quality gate (HTTP ${createResponse.status}).`,
    );
  }

  const created = await findLocalQualityGate(adminPassword);
  if (!created) {
    throw new Error("Local Sonar quality gate was not found after creation.");
  }
  return created;
}

async function findLocalQualityGate(adminPassword) {
  const response = await sonarFetch("/api/qualitygates/list", {
    authPassword: adminPassword,
    method: "GET",
  });
  const payload = await expectJson(
    response,
    "Could not list local Sonar quality gates",
  );
  return (payload.qualitygates ?? []).find(
    (gate) => gate.name === localQualityGateName,
  );
}

function localQualityGateConditions() {
  return [
    { error: "1", metric: "new_reliability_rating", op: "GT" },
    { error: "1", metric: "new_security_rating", op: "GT" },
    { error: "1", metric: "new_maintainability_rating", op: "GT" },
  ];
}

async function expectJson(response, message) {
  await expectOk(response, message);
  return response.json();
}

async function expectOk(response, message) {
  if (response.ok) {
    return;
  }
  const body = await response.text();
  throw new Error(`${message} (HTTP ${response.status}): ${body}`);
}

async function sonarFetch(path, { authPassword, body, method = "POST" }) {
  return fetch(`${hostURL}${path}`, {
    body,
    headers: {
      Authorization: `Basic ${Buffer.from(`admin:${authPassword}`).toString(
        "base64",
      )}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    method,
  });
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      continue;
    }
    values[match[1]] = stripQuotes(match[2]);
  }
  return values;
}

function writeEnvFile(path, values) {
  const lines = [
    "# Local SonarQube credentials generated by scripts/setup-local-sonar.mjs.",
    "# This file is ignored by git.",
    ...Object.entries(values).map(
      ([key, value]) => `${key}=${JSON.stringify(value)}`,
    ),
    "",
  ];
  writeFileSync(path, lines.join("\n"));
}

function stripQuotes(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
