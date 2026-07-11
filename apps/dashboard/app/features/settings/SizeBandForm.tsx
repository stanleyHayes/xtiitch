import { Form } from "react-router";
import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import TextField from "../../components/form-text-field";
import { SizeBand, SizeChartItem } from "../shared/types";
import { SIZE_CHART_UNITS } from "../shared/constants";

export function SizeBandForm({
  band,
  onCancel,
}: {
  band: SizeBand;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<SizeChartItem[]>(
    (band.chart ?? []).map((row) => ({ ...row })),
  );
  const updateRow = (index: number, patch: Partial<SizeChartItem>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="update_size_band" />
      <input type="hidden" name="size_band_id" value={band.size_band_id} />
      <input type="hidden" name="chart_json" value={JSON.stringify(rows)} />
      <Stack spacing={1.5} sx={{ mt: 0.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            name="label"
            label="Size label"
            size="small"
            defaultValue={band.label}
            required
            fullWidth
          />
          <TextField
            name="sequence"
            label="Order"
            type="number"
            size="small"
            defaultValue={band.sequence}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ width: { sm: 120 } }}
            helperText="0 keeps position"
          />
        </Stack>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          Size chart
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            No measurements yet — add bust, waist, neck, etc.
          </Typography>
        ) : (
          rows.map((row, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <TextField
                label="Measurement"
                size="small"
                value={row.name}
                onChange={(event) =>
                  updateRow(index, { name: event.target.value })
                }
                placeholder="Bust"
                fullWidth
              />
              <TextField
                label="Value"
                size="small"
                value={row.value}
                onChange={(event) =>
                  updateRow(index, { value: event.target.value })
                }
                placeholder="36"
                sx={{ width: 90 }}
              />
              <TextField
                select
                label="Unit"
                size="small"
                value={SIZE_CHART_UNITS.includes(row.unit) ? row.unit : "in"}
                onChange={(event) =>
                  updateRow(index, { unit: event.target.value })
                }
                sx={{ width: 100 }}
              >
                {SIZE_CHART_UNITS.map((unit) => (
                  <MenuItem key={unit} value={unit}>
                    {unit}
                  </MenuItem>
                ))}
              </TextField>
              <Tooltip title="Remove measurement">
                <IconButton
                  aria-label="Remove measurement"
                  onClick={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", width: "100%", mb: 0.25 }}
          >
            Quick add a common measurement
          </Typography>
          {[
            "Bust",
            "Waist",
            "Hip",
            "Neck",
            "Shoulder",
            "Sleeve",
            "Inseam",
            "Length",
            "Chest",
            "Thigh",
          ].map((name) => {
            const already = rows.some(
              (row) => row.name.trim().toLowerCase() === name.toLowerCase(),
            );
            return (
              <Chip
                key={name}
                label={name}
                size="small"
                variant="outlined"
                disabled={already}
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { name, value: "", unit: "in" },
                  ])
                }
              />
            );
          })}
        </Box>
        <Button
          startIcon={<AddRounded />}
          onClick={() =>
            setRows((current) => [
              ...current,
              { name: "", value: "", unit: "in" },
            ])
          }
          sx={{ alignSelf: "flex-start" }}
        >
          Add custom measurement
        </Button>
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save size band
          </Button>
        </Stack>
      </Stack>
    </Form>
  );
}