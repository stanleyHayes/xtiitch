import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { StoreSummary } from "../../lib/api";

export function MeasurementInputs({ store }: { store: StoreSummary }) {
  const fields = [...store.measurement_fields].sort(
    (a, b) => a.sequence - b.sequence,
  );

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: "8px",
        bgcolor: alpha(tokens.burgundy, 0.045),
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.1),
      }}
    >
      <Typography sx={{ fontWeight: 900, mb: 1 }}>
        Add at least one measurement
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {fields.map((field, index) => (
          <Box key={field.field_id}>
            <input
              type="hidden"
              name="measurement_field_id"
              value={field.field_id}
            />
            <TextField
              name={`measurement_${field.field_id}`}
              label={`${field.label} (${field.unit})`}
              required={index === 0}
              fullWidth
              slotProps={{
                htmlInput: { inputMode: "decimal" },
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
