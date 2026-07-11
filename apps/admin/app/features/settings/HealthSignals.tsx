import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import { tokens } from "../../theme";
import { AdminReportItem, Section } from "../shared/types";
import { reportStatusColor } from "../shared/colors";
import { Panel } from "../../components/ui/Panel";

export function HealthSignals({
  signals,
  onSelect,
}: {
  signals: AdminReportItem[];
  onSelect: (section: Section) => void;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {signals.map((signal) => {
        const color = reportStatusColor(signal.status);
        return (
          <Panel
            key={signal.id}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderColor: alpha(color, 0.2),
              backgroundImage: `
                linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 36%),
                linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
              `,
              "&:hover": {
                transform: "translateY(-2px)",
                borderColor: alpha(color, 0.34),
                boxShadow: `0 22px 56px ${alpha(tokens.ink, 0.09)}`,
              },
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
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
                  <SyncRounded />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography variant="h6">{signal.label}</Typography>
                    <Chip
                      size="small"
                      label={signal.status}
                      sx={{
                        bgcolor: alpha(color, 0.12),
                        color,
                        textTransform: "capitalize",
                        fontWeight: 900,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", fontWeight: 900 }}
                    >
                      {signal.value}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.65, color: "text.secondary" }}
                  >
                    {signal.helper}
                  </Typography>
                </Box>
              </Stack>
              <Button
                variant={
                  signal.status === "blocked" ? "contained" : "outlined"
                }
                endIcon={<ArrowForwardRounded />}
                onClick={() => onSelect(signal.target)}
                sx={{ alignSelf: { xs: "flex-start", md: "center" } }}
              >
                {signal.targetLabel}
              </Button>
            </Stack>
          </Panel>
        );
      })}
    </Box>
  );
}
