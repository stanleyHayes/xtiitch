import { Form } from "react-router";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { alpha } from "@mui/material/styles";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { MeasurementField } from "../shared/types";
import { fieldUnits } from "../shared/constants";

export function MeasurementFieldRow({ field }: { field: MeasurementField }) {
  const updateFormID = `measurement-field-update-${field.field_id}`;
  const deleteFormID = `measurement-field-delete-${field.field_id}`;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: {
          xs: "1fr",
          md: "minmax(0, 1fr) 96px 110px 104px",
        },
        alignItems: "center",
        py: 1.5,
        px: { xs: 2, md: 2.5 },
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Form id={updateFormID} method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="update_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
        <TextField
          name="label"
          label="Field"
          defaultValue={field.label}
          size="small"
          required
        />
        <TextField
          name="unit"
          label="Unit"
          select
          defaultValue={field.unit}
          size="small"
        >
          {fieldUnits.map((unit) => (
            <MenuItem key={unit.value} value={unit.value}>
              {unit.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          name="sequence"
          label="Order"
          type="number"
          defaultValue={field.sequence}
          size="small"
          slotProps={{ htmlInput: { min: 0 } }}
          required
        />
      </Form>
      <Form id={deleteFormID} method="post" style={{ display: "contents" }}>
        <input type="hidden" name="intent" value="delete_measurement_field" />
        <input type="hidden" name="field_id" value={field.field_id} />
      </Form>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{
          gridColumn: { xs: "1 / -1", md: "auto" },
          alignItems: "center",
          justifyContent: { xs: "flex-start", md: "flex-end" },
          minWidth: 0,
          flexWrap: "nowrap",
        }}
      >
        <Tooltip title="Save field">
          <IconButton
            type="submit"
            form={updateFormID}
            color="primary"
            aria-label={`Save ${field.label}`}
            sx={{
              width: 44,
              height: 44,
              flex: "0 0 auto",
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.2),
              bgcolor: alpha(tokens.burgundy, 0.07),
              "&:hover": {
                bgcolor: alpha(tokens.burgundy, 0.13),
              },
            }}
          >
            <SaveRounded />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete field">
          <IconButton
            type="submit"
            form={deleteFormID}
            color="error"
            aria-label={`Delete ${field.label}`}
            sx={{
              width: 44,
              height: 44,
              flex: "0 0 auto",
              border: "1px solid",
              borderColor: (theme) => alpha(theme.palette.error.main, 0.24),
              bgcolor: (theme) => alpha(theme.palette.error.main, 0.06),
              "&:hover": {
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.12),
              },
            }}
          >
            <DeleteOutlineRounded />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}