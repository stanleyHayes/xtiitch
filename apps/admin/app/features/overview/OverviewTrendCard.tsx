import { useId } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Panel } from "../../components/ui/Panel";
import { OverviewDaySeries } from "./types";



export function OverviewTrendCard({
  title,
  subtitle,
  total,
  series,
  color,
  emptyLabel = "No activity in this window yet.",
}: {
  title: string;
  subtitle: string;
  total: string;
  series: OverviewDaySeries[];
  color: string;
  emptyLabel?: string;
}) {
  const rawId = useId();
  const gradientId = `ovtrend-${rawId.replace(/[:]/g, "")}`;
  const height = 96;
  const max = Math.max(1, ...series.map((point) => point.value));
  const lastIndex = series.length - 1;
  const coords = series.map((point, index) => {
    const x = lastIndex > 0 ? (index / lastIndex) * 100 : 0;
    const y = height - 4 - (point.value / max) * (height - 12);
    return { x, y };
  });
  const linePoints = coords
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const areaPoints = `0,${height} ${linePoints} 100,${height}`;
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {subtitle}
          </Typography>
        </Box>
        <Typography variant="h6" sx={{ color, whiteSpace: "nowrap" }}>
          {total}
        </Typography>
      </Stack>
      {series.length === 0 ? (
        <Box
          sx={{
            height,
            display: "grid",
            placeItems: "center",
            borderRadius: 1.5,
            border: "1px dashed",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {emptyLabel}
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            component="svg"
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            sx={{ width: "100%", height, display: "block" }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#${gradientId})`} />
            <polyline
              points={linePoints}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </Box>
          <Stack
            direction="row"
            sx={{ justifyContent: "space-between", mt: 0.75 }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {series[0]?.label}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {series[lastIndex]?.label}
            </Typography>
          </Stack>
        </>
      )}
    </Panel>
  );
}
