import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadDotEnvFile } from "./lib/env.mjs";

loadDotEnvFile(".env.sonar.local");
loadDotEnvFile(".env");

const hostURL = process.env.SONAR_HOST_URL?.trim();
const organization = process.env.SONAR_ORGANIZATION?.trim();
const projectKey = process.env.SONAR_PROJECT_KEY?.trim();
const token = process.env.SONAR_TOKEN?.trim();
const args = [];
const scannerSettings = createScannerSettings({
  hostURL,
  organization,
  projectKey,
  token,
});

args.push(`-Dproject.settings=${scannerSettings.path}`);

const command =
  process.platform === "win32" ? "sonar-scanner.cmd" : "sonar-scanner";
const scannerEnv = { ...process.env };
delete scannerEnv.SONAR_TOKEN;

const child = spawn(command, args, {
  env: scannerEnv,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  scannerSettings.cleanup();
  if (signal) {
    console.error(`sonar-scanner exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  scannerSettings.cleanup();
  console.error(`sonar-scanner failed to start: ${error.message}`);
  process.exit(1);
});

function createScannerSettings({ hostURL, organization, projectKey, token }) {
  const directory = mkdtempSync(join(tmpdir(), "xtiitch-sonar-"));
  const path = join(directory, "sonar-project.properties");
  const lines = [
    readFileSync("sonar-project.properties", "utf8").trimEnd(),
    "",
    `sonar.projectBaseDir=${escapePropertyValue(process.cwd())}`,
  ];
  if (hostURL) {
    lines.push(`sonar.host.url=${escapePropertyValue(hostURL)}`);
  }
  if (token) {
    const authProperty = /sonarcloud\.io/i.test(hostURL ?? "")
      ? "sonar.token"
      : "sonar.login";
    lines.push(`${authProperty}=${escapePropertyValue(token)}`);
  }
  if (organization && /sonarcloud\.io/i.test(hostURL ?? "")) {
    lines.push(`sonar.organization=${escapePropertyValue(organization)}`);
  }
  if (projectKey) {
    lines.push(`sonar.projectKey=${escapePropertyValue(projectKey)}`);
  }
  writeFileSync(path, `${lines.join("\n")}\n`);
  return {
    cleanup: () => rmSync(directory, { force: true, recursive: true }),
    path,
  };
}

function escapePropertyValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}
