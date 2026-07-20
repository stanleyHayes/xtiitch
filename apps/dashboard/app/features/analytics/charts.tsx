import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";

// §14.1 trend rendering. No chart library exists in this app (ReportsPanel
// hand-rolls its bars), so the analytics charts are hand-rolled too: stacked
// div bars in a grid, with horizontal scrolling when the bucket count would
// squeeze columns below a phone-usable width (§1.3 mobile-first).

export type ChartSegment = {
  value: number;
  tone: string;
  label: string;
};

export type ChartBar = {
  key: string;
  label: string;
  segments: ChartSegment[];
};

export function StackedBarChart({
  bars,
  formatValue,
  barHeight = 120,
}: {
  bars: ChartBar[];
  // Formats the per-bar total shown above each column (formatGHS for money,
  // String for counts).
  formatValue: (value: number) => string;
  barHeight?: number;
}) {
  const totals = bars.map((bar) =>
    bar.segments.reduce((sum, segment) => sum + segment.value, 0),
  );
  const peak = Math.max(1, ...totals);
  // The legend is the segment union in first-seen order, totals across bars.
  const legend = new Map<string, { tone: string; total: number }>();
  for (const bar of bars) {
    for (const segment of bar.segments) {
      const entry = legend.get(segment.label);
      legend.set(segment.label, {
        tone: segment.tone,
        total: (entry?.total ?? 0) + segment.value,
      });
    }
  }
  const minColumnWidth = 40;
  const scrollable = bars.length * minColumnWidth > 560;

  return (
    <Box>
      <Box sx={{ overflowX: scrollable ? "auto" : "hidden", pb: 0.5 }}>
        <Box
          sx={{
            display: "grid",
            gap: 1,
            gridTemplateColumns: `repeat(${Math.max(bars.length, 1)}, minmax(${minColumnWidth}px, 1fr))`,
            alignItems: "end",
            minHeight: barHeight + 58,
            minWidth: scrollable ? bars.length * minColumnWidth : undefined,
          }}
        >
          {bars.map((bar, barIndex) => {
            const total = totals[barIndex] ?? 0;
            const height = Math.max(
              total > 0 ? 12 : 4,
              Math.round((total / peak) * barHeight),
            );
            return (
              <Stack
                key={bar.key}
                spacing={0.75}
                sx={{
                  minWidth: 0,
                  alignItems: "stretch",
                  justifyContent: "flex-end",
                }}
              >
                <Typography
                  variant="caption"
                  title={formatValue(total)}
                  sx={{
                    color: "text.secondary",
                    textAlign: "center",
                    minHeight: 30,
                    display: "grid",
                    alignItems: "end",
                    fontSize: "0.68rem",
                    lineHeight: 1.25,
                  }}
                >
                  {total > 0 ? formatValue(total) : "—"}
                </Typography>
                <Stack
                  spacing={0}
                  sx={{
                    height,
                    borderRadius: 1.25,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: (theme) =>
                      total > 0
                        ? alpha(theme.palette.primary.main, 0.25)
                        : theme.palette.divider,
                    justifyContent: "flex-end",
                    bgcolor: (theme) =>
                      total > 0
                        ? "transparent"
                        : theme.palette.mode === "dark"
                          ? alpha(theme.palette.common.white, 0.06)
                          : alpha(theme.palette.common.black, 0.06),
                  }}
                >
                  {bar.segments.map((segment) =>
                    segment.value > 0 ? (
                      <Box
                        key={segment.label}
                        sx={{
                          height: `${Math.max(4, (segment.value / Math.max(total, 1)) * 100)}%`,
                          bgcolor: segment.tone,
                        }}
                      />
                    ) : null,
                  )}
                </Stack>
                <Typography
                  variant="caption"
                  title={bar.label}
                  sx={{
                    color: "text.secondary",
                    fontWeight: 800,
                    textAlign: "center",
                    whiteSpace: "normal",
                    fontSize: "0.66rem",
                    lineHeight: 1.25,
                  }}
                >
                  {bar.label}
                </Typography>
              </Stack>
            );
          })}
        </Box>
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: "wrap" }}>
        {[...legend.entries()].map(([label, entry]) => (
          <Stack
            key={label}
            direction="row"
            spacing={0.75}
            sx={{ alignItems: "center" }}
          >
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                bgcolor: entry.tone,
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {label} {formatValue(entry.total)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
