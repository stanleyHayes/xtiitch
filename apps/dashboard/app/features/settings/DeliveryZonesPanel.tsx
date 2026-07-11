import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import TextField from "../../components/form-text-field";
import { DeliveryZone } from "../shared/types";
import { Panel } from "../../components/ui/Panel";

export function DeliveryZonesPanel({
  zones,
  error,
  success,
}: {
  zones: DeliveryZone[];
  error?: string;
  success?: string;
}) {
  return (
    <Panel id="delivery-zones" sx={{ mt: 2 }}>
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box sx={{ color: "primary.main" }}>
            <LocalShippingRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900 }}>Delivery zones</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              The areas you deliver to and the fee added at checkout. Customers
              choose a zone and pay its fee with their order.
            </Typography>
          </Box>
        </Stack>

        {success ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {zones.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              No zones yet — add your first delivery area below.
            </Typography>
          ) : (
            zones.map((zone) => (
              <Box
                key={zone.zone_id}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.5,
                }}
              >
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="update_delivery_zone"
                  />
                  <input type="hidden" name="zone_id" value={zone.zone_id} />
                  <input type="hidden" name="sequence" value={zone.sequence} />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{ alignItems: { sm: "center" } }}
                  >
                    <TextField
                      name="name"
                      label="Zone name"
                      defaultValue={zone.name}
                      size="small"
                      fullWidth
                      required
                    />
                    <TextField
                      name="fee"
                      label="Fee (GHS)"
                      type="number"
                      defaultValue={String(zone.fee_minor / 100)}
                      size="small"
                      required
                      sx={{ maxWidth: { sm: 160 } }}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox name="active" defaultChecked={zone.active} />
                      }
                      label="Visible"
                    />
                    <Button type="submit" variant="outlined" size="small">
                      Save
                    </Button>
                  </Stack>
                </Form>
                <Box sx={{ mt: 1 }}>
                  <Form method="post">
                    <input
                      type="hidden"
                      name="intent"
                      value="delete_delivery_zone"
                    />
                    <input type="hidden" name="zone_id" value={zone.zone_id} />
                    <Button
                      type="submit"
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlineRounded fontSize="small" />}
                    >
                      Remove
                    </Button>
                  </Form>
                </Box>
              </Box>
            ))
          )}

          <Divider />
          <Typography sx={{ fontWeight: 800 }}>Add a zone</Typography>
          {/* Re-key on the zone count so the inputs clear after a zone is added. */}
          <Form method="post" key={zones.length}>
            <input type="hidden" name="intent" value="create_delivery_zone" />
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.25}
              sx={{ alignItems: { sm: "center" } }}
            >
              <TextField
                name="name"
                label="Zone name"
                placeholder="e.g. Accra Central"
                size="small"
                fullWidth
                required
              />
              <TextField
                name="fee"
                label="Fee (GHS)"
                type="number"
                size="small"
                required
                sx={{ maxWidth: { sm: 160 } }}
              />
              <Button type="submit" variant="contained" size="small">
                Add zone
              </Button>
            </Stack>
          </Form>
        </Stack>
      </Box>
    </Panel>
  );
}