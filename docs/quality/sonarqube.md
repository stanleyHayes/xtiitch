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
SonarCloud, set the organization as well:

```sh
SONAR_HOST_URL=http://localhost:9000
SONAR_ORGANIZATION=your-sonarcloud-organization
SONAR_TOKEN=your-token
pnpm sonar
```

The `pnpm sonar` wrapper passes `SONAR_ORGANIZATION` to the scanner as
`sonar.organization` when it is present. Keep `sonar-project.properties`
project-specific and put the real organization in local env or CI secrets.

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
