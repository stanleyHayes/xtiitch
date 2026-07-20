import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import EmojiEventsRounded from "@mui/icons-material/EmojiEventsRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { formatPercent, percentage } from "../shared/utils";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { TopDesignRow } from "./types";

// §14.1 "Top-selling designs" — Starter pinned to top 5 (the API enforces the
// pin; the chip just says so), fuller plans see the longer list. Ranked rows
// with a revenue-share bar read better than a chart on a phone.
export function TopDesignsPanel({
  designs,
  limit,
}: {
  designs: TopDesignRow[];
  limit: number | null;
}) {
  const peakRevenue = Math.max(1, ...designs.map((row) => row.revenue_minor));

  return (
    <Panel id="analytics-top-designs">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "stretch", md: "flex-start" },
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <EmojiEventsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>
                Top-selling designs
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Ranked by revenue across the window.
              </Typography>
            </Box>
          </Stack>
          {limit !== null ? (
            <ToneChip label={`Top ${limit}`} tone={tokens.gold} />
          ) : null}
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {designs.length === 0 ? (
            <InlineEmptyState
              icon={<EmojiEventsRounded sx={{ fontSize: 38 }} />}
              title="No sales yet"
              helper="Your best sellers will rank here once orders come in."
            />
          ) : (
            designs.map((design, index) => (
              <Box
                key={design.design_id}
                sx={{
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? alpha(theme.palette.common.white, 0.03)
                      : alpha(theme.palette.common.black, 0.015),
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{ alignItems: "baseline", minWidth: 0 }}
                >
                  <Typography
                    sx={{
                      fontWeight: 900,
                      color: "text.secondary",
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}.
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 900, minWidth: 0, flex: 1 }}
                    noWrap
                    title={design.title}
                  >
                    {design.title}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, flexShrink: 0 }}>
                    {formatGHS(design.revenue_minor)}
                  </Typography>
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", mt: 0.75 }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: 8,
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
                        width: formatPercent(
                          percentage(design.revenue_minor, peakRevenue),
                        ),
                        height: "100%",
                        bgcolor: "primary.main",
                        borderRadius: 999,
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", flexShrink: 0 }}
                  >
                    {design.orders} {design.orders === 1 ? "order" : "orders"}
                  </Typography>
                </Stack>
              </Box>
            ))
          )}
        </Stack>
      </Box>
    </Panel>
  );
}
