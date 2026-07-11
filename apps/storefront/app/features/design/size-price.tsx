import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import type { Design } from "../../lib/api";

export function SizePriceList({ design }: { design: Design }) {
  if (design.prices.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 900 }}>
        Sizes &amp; prices
      </Typography>
      <Stack
        divider={<Divider />}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          overflow: "hidden",
          bgcolor: "rgba(var(--surface-rgb), 0.72)",
        }}
      >
        {design.prices.map((price) => {
          const chart = price.chart ?? [];
          return (
            <Box key={price.size_band_id} sx={{ px: 2, py: 1.25 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", gap: 2 }}
              >
                <Typography>{price.label}</Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {formatGHS(price.price_minor)}
                </Typography>
              </Stack>
              {chart.length > 0 ? (
                <Stack
                  direction="row"
                  sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.75 }}
                >
                  {chart.map((item, index) => (
                    <Box
                      key={index}
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: "divider",
                        fontSize: 12,
                        color: "text.secondary",
                      }}
                    >
                      {item.name}: {item.value} {item.unit}
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

export function DetailSignal({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.1}
      sx={{
        alignItems: "center",
        p: 1.25,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: "rgba(var(--surface-rgb), 0.72)",
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          color: tokens.burgundy,
          bgcolor: alpha(tokens.burgundy, 0.08),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 900 }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 900 }} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
