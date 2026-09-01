import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "../../components/form-text-field";
import type { Design } from "../../lib/api";
import { SizeBand } from "../shared/types";
import { moneyInputValue } from "../orders/utils";

export function DesignPricesSection({
  design,
  sizeBands,
  error,
}: {
  design: Design;
  sizeBands: SizeBand[];
  error?: string;
}) {
  const priceByBand = new Map(
    design.prices.map((price) => [price.size_band_id, price]),
  );
  return (
    <Box sx={{ mt: 1 }}>
      <Typography sx={{ fontWeight: 900, mb: 1 }}>Size band prices</Typography>
      {error ? (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      {sizeBands.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Add size bands under Catalogue to price this design.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {sizeBands.map((band) => (
            <Form method="post" key={band.size_band_id}>
              <input type="hidden" name="intent" value="set_design_price" />
              <input type="hidden" name="design_id" value={design.design_id} />
              <input
                type="hidden"
                name="size_band_id"
                value={band.size_band_id}
              />
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {band.label}
                </Typography>
                <TextField
                  name="price_ghs"
                  size="small"
                  label="Actual price"
                  defaultValue={moneyInputValue(
                    priceByBand.get(band.size_band_id)?.actual_price_minor ?? null,
                  )}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">GHS</InputAdornment>
                      ),
                    },
                    htmlInput: { inputMode: "decimal" },
                  }}
                  sx={{ width: 150 }}
                />
                <TextField
                  name="discounted_price_ghs"
                  size="small"
                  label="Discounted price"
                  defaultValue={moneyInputValue(
                    priceByBand.get(band.size_band_id)?.discounted_price_minor ?? null,
                  )}
                  helperText="Optional; must be lower"
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">GHS</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
                  sx={{ width: 170 }}
                />
                <Button type="submit" size="small" variant="outlined">
                  Save
                </Button>
              </Stack>
            </Form>
          ))}
        </Stack>
      )}
    </Box>
  );
}
