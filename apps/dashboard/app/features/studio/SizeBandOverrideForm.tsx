import { useFetcher } from "react-router";
import { useRef } from "react";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { SizeBand, DesignSizeBandOverride, DesignExtrasData, SizeChartItem } from "../shared/types";
import { ToneChip } from "../../components/ui/ToneChip";
import { SIZE_CHART_UNITS } from "../shared/constants";

export function SizeBandOverrideForm({
  band,
  override,
  actionUrl,
  write,
}: {
  band: SizeBand;
  override: DesignSizeBandOverride | undefined;
  actionUrl: string;
  write: ReturnType<typeof useFetcher<DesignExtrasData>>;
}) {
  const startChart =
    override?.chart_set && override.chart.length > 0
      ? override.chart
      : band.chart;
  // Rows carry a stable client id so React keys survive add/remove/reorder of
  // the editable measurement chart without falling back to array-index keys.
  const nextRowId = useRef(0);
  const [rows, setRows] = useState<(SizeChartItem & { id: number })[]>(() => {
    const seed =
      startChart.length > 0 ? startChart : [{ name: "", value: "", unit: "in" }];
    return seed.map((item) => ({ ...item, id: nextRowId.current++ }));
  });

  const updateRow = (id: number, patch: Partial<SizeChartItem>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const clearOverride = () => {
    const body = new FormData();
    body.set("op", "clear_override");
    body.set("band_id", band.size_band_id);
    write.submit(body, { method: "post", action: actionUrl });
  };

  const overridden = Boolean(override && (override.label || override.chart_set));

  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <write.Form method="post" action={actionUrl}>
        <input type="hidden" name="op" value="set_override" />
        <input type="hidden" name="band_id" value={band.size_band_id} />
        <input type="hidden" name="chart_set" value="1" />
        <Stack spacing={1.25}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              {band.label}
            </Typography>
            {overridden ? (
              <ToneChip label="Overridden" tone={tokens.burgundy} />
            ) : null}
          </Stack>
          <TextField
            name="label"
            label="Label for this design"
            placeholder={band.label}
            defaultValue={override?.label ?? ""}
            size="small"
            helperText="Leave blank to use the master band label."
          />
          <Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Measurement chart
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              {rows.map((row) => (
                <Stack
                  key={row.id}
                  direction="row"
                  spacing={0.75}
                  sx={{ alignItems: "center" }}
                >
                  <TextField
                    name="chart_name"
                    label="Part"
                    value={row.name}
                    onChange={(event) =>
                      updateRow(row.id, { name: event.target.value })
                    }
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    name="chart_value"
                    label="Value"
                    value={row.value}
                    onChange={(event) =>
                      updateRow(row.id, { value: event.target.value })
                    }
                    size="small"
                    sx={{ width: 96 }}
                  />
                  <TextField
                    name="chart_unit"
                    label="Unit"
                    select
                    value={row.unit || "in"}
                    onChange={(event) =>
                      updateRow(row.id, { unit: event.target.value })
                    }
                    size="small"
                    sx={{ width: 90 }}
                  >
                    {SIZE_CHART_UNITS.map((unit) => (
                      <MenuItem key={unit} value={unit}>
                        {unit}
                      </MenuItem>
                    ))}
                  </TextField>
                  <IconButton
                    size="small"
                    aria-label="Remove row"
                    onClick={() =>
                      setRows((current) =>
                        current.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button
                type="button"
                size="small"
                startIcon={<AddRounded />}
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { name: "", value: "", unit: "in", id: nextRowId.current++ },
                  ])
                }
                sx={{ alignSelf: "flex-start" }}
              >
                Add measurement
              </Button>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            {overridden ? (
              <Button
                type="button"
                size="small"
                variant="outlined"
                onClick={clearOverride}
              >
                Reset to master
              </Button>
            ) : null}
            <Button type="submit" size="small" variant="contained">
              Save override
            </Button>
          </Stack>
        </Stack>
      </write.Form>
    </Box>
  );
}