import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import { tokens } from "../../theme";
import TextField from "../../components/form-text-field";
import { Panel, SectionHeader } from "../../components/ui";
import { AuditEvent, AuditFilter, auditFilters } from "../shared/types";
import { shortTime, auditColor } from "../shared";

export function AuditSection({
  auditEvents,
  auditLogError,
}: {
  auditEvents: AuditEvent[];
  auditLogError: string | null;
}) {
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(auditEvents);
  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");
  const [auditPage, setAuditPage] = useState(1);

  useEffect(() => {
    setAuditLog(auditEvents);
  }, [auditEvents]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditFilter]);

  const filteredAuditLog =
    auditFilter === "all"
      ? auditLog
      : auditLog.filter((event) => event.severity === auditFilter);

  const auditPageCount = Math.max(1, Math.ceil(filteredAuditLog.length / 12));
  const pagedAuditLog = filteredAuditLog.slice(
    (auditPage - 1) * 12,
    auditPage * 12,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Operator accountability"
        title="Audit log"
        helper="Every sensitive operator decision should be attributable, reviewable, and ready for compliance export."
      />
      {auditLogError ? (
        <Alert severity="warning">{auditLogError}</Alert>
      ) : null}
      <Panel sx={{ p: 2 }}>
        <TextField
          select
          label="Severity"
          value={auditFilter}
          onChange={(event) =>
            setAuditFilter(event.target.value as AuditFilter)
          }
          sx={{ minWidth: { xs: "100%", sm: 220 } }}
        >
          {auditFilters.map((filter) => (
            <MenuItem key={filter.value} value={filter.value}>
              {filter.label}
            </MenuItem>
          ))}
        </TextField>
      </Panel>
      <Stack spacing={1.5}>
        {pagedAuditLog.map((event) => (
          <Panel
            key={event.id}
            sx={{
              p: 2,
              borderColor: alpha(auditColor(event.severity), 0.18),
              backgroundImage: `linear-gradient(90deg, ${alpha(
                auditColor(event.severity),
                0.065,
              )}, transparent 36%)`,
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: alpha(auditColor(event.severity), 0.32),
                boxShadow: `0 18px 48px ${alpha(tokens.ink, 0.085)}`,
              },
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ justifyContent: "space-between", minWidth: 0 }}
            >
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "flex-start", minWidth: 0 }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: alpha(auditColor(event.severity), 0.12),
                    color: auditColor(event.severity),
                    flex: "0 0 auto",
                  }}
                >
                  <HistoryRounded />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography sx={{ fontWeight: 900 }}>
                      {event.action}
                    </Typography>
                    <Chip
                      size="small"
                      label={event.severity}
                      sx={{
                        bgcolor: alpha(auditColor(event.severity), 0.12),
                        color: auditColor(event.severity),
                        textTransform: "capitalize",
                      }}
                    />
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {event.target} · {event.actor}
                  </Typography>
                  <Typography
                    sx={{ mt: 0.75, overflowWrap: "anywhere" }}
                  >
                    {event.detail}
                  </Typography>
                </Box>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {shortTime(event.createdAt)}
              </Typography>
            </Stack>
          </Panel>
        ))}
      </Stack>
      {auditPageCount > 1 ? (
        <Stack sx={{ alignItems: "center", pt: 0.5 }}>
          <Pagination
            count={auditPageCount}
            page={auditPage}
            onChange={(_event, value) => setAuditPage(value)}
            color="primary"
            shape="rounded"
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
