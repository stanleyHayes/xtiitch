import { spawn } from "node:child_process";

const args = [];
const organization = process.env.SONAR_ORGANIZATION?.trim();
const projectKey = process.env.SONAR_PROJECT_KEY?.trim();

if (organization) {
  args.push(`-Dsonar.organization=${organization}`);
}

if (projectKey) {
  args.push(`-Dsonar.projectKey=${projectKey}`);
}

const command = process.platform === "win32" ? "sonar-scanner.cmd" : "sonar-scanner";
const child = spawn(command, args, {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`sonar-scanner exited from signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(`sonar-scanner failed to start: ${error.message}`);
  process.exit(1);
});
