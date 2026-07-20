import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { tokens } from "../../theme";
import { formatPercent } from "../shared/utils";
import { Panel } from "../../components/ui/Panel";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { DesignPerformanceRow } from "./types";

// §14.1 "Design performance (views, view→order conversion, waiting-list
// demand)" — Growth+. Conversion comes from the API as a 0–1 rate; rows are
// cards rather than a table so nothing overflows a phone (§1.3).
export function DesignPerformancePanel({
  designs,
}: {
  designs: DesignPerformanceRow[];
}) {
  return (
    <Panel id="analytics-design-performance">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <VisibilityRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Design performance</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Storefront views, view→order conversion, and waiting-list demand
              per design.
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 2 }}>
          {designs.length === 0 ? (
            <InlineEmptyState
              icon={<VisibilityRounded sx={{ fontSize: 38 }} />}
              title="No design traffic yet"
              helper="Views, conversions and waiting-list demand track here as customers browse your storefront."
            />
          ) : (
            designs.map((design) => (
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
                  spacing={1}
                  sx={{ alignItems: "baseline", minWidth: 0 }}
                >
                  <Typography
                    sx={{ fontWeight: 900, minWidth: 0, flex: 1 }}
                    noWrap
                    title={design.title}
                  >
                    {design.title}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 900, flexShrink: 0, color: tokens.info }}
                  >
                    {formatPercent(design.conversion_rate * 100)} conversion
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    mt: 1,
                    display: "grid",
                    gap: 1,
                    gridTemplateColumns: "repeat(3, 1fr)",
                  }}
                >
                  {[
                    { label: "Views", value: String(design.views) },
                    { label: "Orders", value: String(design.orders) },
                    {
                      label: "Waiting list",
                      value: String(design.waiting_list),
                    },
                  ].map((stat) => (
                    <Box
                      key={stat.label}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        textAlign: "center",
                        minWidth: 0,
                      }}
                    >
                      <Typography sx={{ fontWeight: 900 }} noWrap>
                        {stat.value}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {stat.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Stack>
      </Box>
    </Panel>
  );
}
