import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AssignmentTurnedInRounded from "@mui/icons-material/AssignmentTurnedInRounded";
import { tokens } from "../../theme";
import { Section, navItems, AdminLaunchReadiness } from "../shared/types";
import { reportStatusColor } from "../shared/colors";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function LaunchReadinessSection({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  readiness,
  readinessError,
  onSelect,
}: {
  readiness: AdminLaunchReadiness | null;
  readinessError: string | null;
  onSelect: (section: Section) => void;
}) {
  const checks = readiness?.checks ?? [];
  const totalChecks = checks.length;
  const readyCount = readiness?.readyCount ?? 0;
  const watchCount = readiness?.watchCount ?? 0;
  const blockedCount = readiness?.blockedCount ?? 0;
  const readinessScore =
    totalChecks > 0 ? Math.round((readyCount / totalChecks) * 100) : 0;
  const environment = readiness?.environment ?? "unavailable";
  const updatedAt = readiness?.updatedAt
    ? shortTime(readiness.updatedAt)
    : "Not loaded";
  const targetSection = (target: string): Section =>
    navItems.some((item) => item.id === target)
      ? (target as Section)
      : "settings";

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Launch control"
        title="Launch readiness"
        helper="A production gate view for credentials, provider transports, legal review, quality scans, and owner-controlled configuration."
      />
      {readinessError ? (
        <Alert severity="warning">{readinessError}</Alert>
      ) : null}
      {!readiness && !readinessError ? (
        <Alert severity="info">Launch readiness has not loaded yet.</Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        }}
      >
        <MetricCard
          label="Readiness score"
          value={`${readinessScore}%`}
          helper={`${readyCount}/${totalChecks} gates ready`}
          trend={
            blockedCount > 0 ? "Blocked" : watchCount > 0 ? "Watch" : "Ready"
          }
        />
        <MetricCard
          label="Blocked gates"
          value={String(blockedCount)}
          helper="Must clear before launch"
          trend={blockedCount > 0 ? "Action" : "Clear"}
        />
        <MetricCard
          label="Watch gates"
          value={String(watchCount)}
          helper="Need validation or follow-up"
          trend={watchCount > 0 ? "Review" : "Quiet"}
        />
        <MetricCard
          label="Environment"
          value={environment}
          helper={`Updated ${updatedAt}`}
          trend="Config"
        />
      </Box>

      <Panel
        sx={{
          p: { xs: 2, md: 3 },
          borderColor:
            blockedCount > 0
              ? alpha(tokens.danger, 0.24)
              : alpha(tokens.success, 0.22),
          backgroundImage: `
            linear-gradient(90deg, ${
              blockedCount > 0
                ? alpha(tokens.danger, 0.08)
                : alpha(tokens.success, 0.08)
            }, transparent 38%),
            linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
          `,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 1.5,
                display: "grid",
                placeItems: "center",
                bgcolor: alpha(
                  blockedCount > 0 ? tokens.danger : tokens.success,
                  0.12,
                ),
                color: blockedCount > 0 ? tokens.danger : tokens.success,
                flex: "0 0 auto",
              }}
            >
              <AssignmentTurnedInRounded />
            </Box>
            <Box>
              <Typography variant="h6">Production gate posture</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {blockedCount > 0
                  ? `${blockedCount} blocker${blockedCount === 1 ? "" : "s"} need owner follow-up before public launch.`
                  : "No blockers are visible in the loaded readiness feed."}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip
              label={`${readyCount} ready`}
              sx={{
                bgcolor: alpha(tokens.success, 0.12),
                color: tokens.success,
                fontWeight: 900,
              }}
            />
            <Chip
              label={`${watchCount} watch`}
              sx={{
                bgcolor: alpha(tokens.warning, 0.12),
                color: tokens.warning,
                fontWeight: 900,
              }}
            />
            <Chip
              label={`${blockedCount} blocked`}
              sx={{
                bgcolor: alpha(tokens.danger, 0.12),
                color: tokens.danger,
                fontWeight: 900,
              }}
            />
          </Stack>
        </Stack>
      </Panel>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {checks.map((check) => {
          const color = reportStatusColor(check.status);
          return (
            <Panel
              key={check.id}
              sx={{
                p: { xs: 2, md: 2.5 },
                borderColor: alpha(color, 0.22),
                backgroundImage: `
                  linear-gradient(90deg, ${alpha(color, 0.07)}, transparent 34%),
                  linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
                `,
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: alpha(color, 0.12),
                        color,
                        flex: "0 0 auto",
                      }}
                    >
                      <AssignmentTurnedInRounded />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="h6">{check.label}</Typography>
                        <Chip
                          size="small"
                          label={check.status}
                          sx={{
                            bgcolor: alpha(color, 0.12),
                            color,
                            textTransform: "capitalize",
                            fontWeight: 900,
                          }}
                        />
                        <Chip size="small" label={check.category} />
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.65, color: "text.secondary" }}
                      >
                        {check.summary}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    variant={
                      check.status === "blocked" ? "contained" : "outlined"
                    }
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => onSelect(targetSection(check.target))}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                  >
                    {check.targetLabel}
                  </Button>
                </Stack>
                <Divider />
                <Stack spacing={0.75}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {check.detail}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    {check.action}
                  </Typography>
                </Stack>
              </Stack>
            </Panel>
          );
        })}
      </Box>
    </Stack>
  );
}
