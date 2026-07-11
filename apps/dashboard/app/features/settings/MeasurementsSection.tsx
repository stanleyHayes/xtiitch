import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AddRounded from "@mui/icons-material/AddRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import { Form } from "react-router";
import { Panel } from "../../components/ui/Panel";
import { EmptyState } from "../../components/ui/EmptyState";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import TextField from "../../components/form-text-field";
import { MeasurementFieldRow } from "../studio/MeasurementFieldRow";
import { fieldUnits } from "../shared/constants";
import type { MeasurementField } from "../shared/types";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";

export function MeasurementsSection({
  measurementFields,
  pagedMeasurementFields,
  measurementFieldPage,
  measurementFieldPageCount,
  setMeasurementFieldPage,
  nextFieldSequence,
  fieldError,
}: {
  measurementFields: MeasurementField[];
  pagedMeasurementFields: MeasurementField[];
  measurementFieldPage: number;
  measurementFieldPageCount: number;
  setMeasurementFieldPage: (page: number) => void;
  nextFieldSequence: number;
  fieldError?: string;
}) {
  return (
    <Panel id="measurements">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center" }}
        >
          <Box sx={{ color: "primary.main" }}>
            <StraightenRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Measurement setup</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Define the fields used for self, visit, and shop measurements.
            </Typography>
          </Box>
        </Stack>
        {fieldError ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {fieldError}
          </Alert>
        ) : null}
        <Form method="post" key={measurementFields.length}>
          <input
            type="hidden"
            name="intent"
            value="create_measurement_field"
          />
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "minmax(0, 1fr) 96px 96px",
              },
            }}
          >
            <TextField
              name="label"
              label="Field label"
              placeholder="Chest"
              size="small"
              required
            />
            <TextField
              name="unit"
              label="Unit"
              select
              defaultValue="in"
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
              defaultValue={nextFieldSequence}
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
              required
            />
          </Box>
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddRounded />}
            sx={{ mt: 1.5 }}
          >
            Add field
          </Button>
        </Form>
      </Box>

      {measurementFields.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <EmptyState
            icon={<StraightenRounded sx={{ fontSize: 38 }} />}
            title="No measurement fields yet"
            helper="Add fields such as chest, waist, sleeve, and length before staff record visit or shop measurements."
          />
        </Box>
      ) : (
        <>
          {pagedMeasurementFields.map((field) => (
            <MeasurementFieldRow key={field.field_id} field={field} />
          ))}
          <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
            <PaginationFooter
              count={measurementFieldPageCount}
              label="measurement fields"
              page={measurementFieldPage}
              total={measurementFields.length}
              onChange={setMeasurementFieldPage}
            />
          </Box>
        </>
      )}
    </Panel>
  );
}
