# SonarQube Quality Gate

Xtiitch must pass tests and SonarQube quality checks before a feature is considered done.

## Required Local Commands

```sh
pnpm test
pnpm check
pnpm sonar
```

`pnpm check` includes strict linting with zero warnings. Inline lint rule disabling is disabled in the root ESLint config; fix the code or document an architectural exception instead of hiding a rule violation.

`pnpm sonar` requires a configured SonarQube or SonarCloud host and token. For
local Docker SonarQube, run:

```sh
pnpm sonar:local
pnpm sonar
```

`pnpm sonar:local` starts `sonarqube` from `docker-compose.yml`, changes the
default local admin password, generates an analysis token, and stores it in
`.env.sonar.local` (ignored by git). It also creates and selects the
`Xtiitch Local Launch` quality gate for the local project. That local gate
enforces A ratings for new reliability, security, and maintainability issues.
Coverage, duplication, and hotspot-review gates should be re-enabled in CI once
the matching coverage reports and security review workflow are available.

For SonarCloud, set the organization as well:

```sh
SONAR_HOST_URL=https://sonarcloud.io
SONAR_ORGANIZATION=your-sonarcloud-organization
SONAR_TOKEN=your-token
pnpm sonar
```

The `pnpm sonar` wrapper passes `SONAR_ORGANIZATION` to the scanner as
`sonar.organization` for SonarCloud. Self-hosted/local SonarQube does not need
an organization. Keep `sonar-project.properties` project-specific and put real
host/token values in local env or CI secrets.

## Required Coverage Inputs

- Go coverage: `apps/api/coverage.out`
- JavaScript/TypeScript coverage: `coverage/lcov.info` or package-level `coverage/lcov.info`

## Quality Expectations

- No blocker or critical issues.
- No known tenant isolation leaks.
- No known payment idempotency or webhook verification gaps.
- No lint warnings.
- New critical paths must have tests.
- Duplicated logic should be reduced when it hides tenant, money, auth, or state-machine rules.
- Security hotspots must be reviewed before merge.

## Feature Done Means

- Tests pass.
- SonarQube quality gate passes, or the blocker is recorded in `agent_plan.md`.
- The feature includes relevant docs and runbook updates.
- The commit message describes the feature, not just the files changed.
