import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import DonutLargeRounded from "@mui/icons-material/DonutLargeRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { formatPercent, percentage } from "../shared/utils";
import { Panel } from "../../components/ui/Panel";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { RevenueBreakdowns } from "./types";

type BreakdownRow = { key: string; label: string; orders: number; revenue_minor: number };

// §14.1 "Revenue breakdowns (by design, collection, order type, delivery/
// pickup)" — Growth+. The same revenue sliced four ways; each lens is a
// share-bar list, laid out 2×2 on desktop and stacked on phones.
export function BreakdownsPanel({
  breakdowns,
}: {
  breakdowns: RevenueBreakdowns | null;
}) {
  const groups: { title: string; rows: BreakdownRow[] }[] = [
    {
      title: "By design",
      rows: (breakdowns?.by_design ?? []).map((row) => ({
        key: row.design_id,
        label: row.title,
        orders: row.orders,
        revenue_minor: row.revenue_minor,
      })),
    },
    {
      title: "By collection",
      rows: (breakdowns?.by_collection ?? []).map((row) => ({
        key: row.collection_id ?? "none",
        label: row.name || "No collection",
        orders: row.orders,
        revenue_minor: row.revenue_minor,
      })),
    },
    {
      title: "By order type",
      rows: (breakdowns?.by_flow ?? []).map((row) => ({
        key: row.flow,
        label: row.flow === "bespoke" ? "Custom" : "Standard",
        orders: row.orders,
        revenue_minor: row.revenue_minor,
      })),
    },
    {
      title: "Delivery vs pickup",
      rows: (breakdowns?.by_fulfilment ?? []).map((row) => ({
        key: row.method,
        label:
          row.method === "delivery"
            ? "Delivery"
            : row.method === "pickup"
              ? "Pickup"
              : row.method,
        orders: row.orders,
        revenue_minor: row.revenue_minor,
      })),
    },
  ];

  return (
    <Panel id="analytics-breakdowns">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <DonutLargeRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Revenue breakdowns</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              The window&apos;s revenue sliced by design, collection, order
              type, and fulfilment.
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
          }}
        >
          {groups.map((group) => (
            <BreakdownGroup key={group.title} group={group} />
          ))}
        </Box>
      </Box>
    </Panel>
  );
}

function BreakdownGroup({ group }: { group: { title: string; rows: BreakdownRow[] } }) {
  const total = group.rows.reduce((sum, row) => sum + row.revenue_minor, 0);
  const shown = group.rows.slice(0, 6);
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha(theme.palette.common.white, 0.03)
            : alpha(theme.palette.common.black, 0.015),
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "baseline" }}
      >
        <Typography sx={{ fontWeight: 900 }}>{group.title}</Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {formatGHS(total)}
        </Typography>
      </Stack>
      {shown.length === 0 ? (
        <Box sx={{ mt: 1 }}>
          <InlineEmptyState
            icon={<DonutLargeRounded sx={{ fontSize: 32 }} />}
            title="No revenue yet"
            helper="This lens fills in as orders settle."
          />
        </Box>
      ) : (
        <Stack spacing={1} sx={{ mt: 1.25 }}>
          {shown.map((row) => (
            <Box key={row.key} sx={{ minWidth: 0 }}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ justifyContent: "space-between", minWidth: 0 }}
              >
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 800, minWidth: 0 }}
                  noWrap
                  title={row.label}
                >
                  {row.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", flexShrink: 0 }}
                >
                  {formatGHS(row.revenue_minor)} · {row.orders}{" "}
                  {row.orders === 1 ? "order" : "orders"}
                </Typography>
              </Stack>
              <Box
                sx={{
                  mt: 0.4,
                  height: 6,
                  borderRadius: 999,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.common.white, 0.08)
                      : alpha(theme.palette.common.black, 0.08),
                  overflow: "hidden",
                }}
              >
                <Box
                  sx={{
                    width: formatPercent(percentage(row.revenue_minor, total)),
                    height: "100%",
                    bgcolor: tokens.burgundy,
                    borderRadius: 999,
                  }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
