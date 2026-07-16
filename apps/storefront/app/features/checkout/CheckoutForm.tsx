import { Form, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import { tokens } from "../../theme";
import { XCreativsPaymentNotice } from "../../components/xcreativs-payment-notice";
import { formatGHS } from "../../lib/format";
import type { CartItem } from "../../lib/cart";
import type { CustomerProfile } from "../../lib/discovery";

type Zone = {
  zone_id: string;
  name: string;
  fee_minor: number;
};

type CheckoutFormProps = {
  storeHandle: string;
  items: CartItem[];
  totalMinor: number;
  zones: Zone[];
  profile: CustomerProfile | null;
  fulfilment: "pickup" | "delivery";
  onFulfilmentChange: (value: "pickup" | "delivery") => void;
  zoneID: string;
  onZoneChange: (value: string) => void;
  deliveryOffered: boolean;
};

export default function CheckoutForm({
  storeHandle,
  items,
  totalMinor,
  zones,
  profile,
  fulfilment,
  onFulfilmentChange,
  zoneID,
  onZoneChange,
  deliveryOffered,
}: CheckoutFormProps) {
  const submitAction = `/checkout?store=${encodeURIComponent(storeHandle)}`;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const canPayNow = items.length > 0;

  const selectedZone = zones.find((zone) => zone.zone_id === zoneID);
  const deliveryFee =
    fulfilment === "delivery" && selectedZone ? selectedZone.fee_minor : 0;
  const grandTotal = totalMinor + deliveryFee;

  return (
    <Form method="post" action={submitAction}>
      <Stack spacing={1.5}>
        {deliveryOffered ? (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2,
            }}
          >
            <Typography sx={{ fontWeight: 800, mb: 1 }}>
              How would you like it?
            </Typography>
            <RadioGroup
              name="fulfilment"
              value={fulfilment}
              onChange={(event) =>
                onFulfilmentChange(event.target.value as "pickup" | "delivery")
              }
            >
              <FormControlLabel
                value="pickup"
                control={<Radio />}
                label="Pick up from the studio (free)"
              />
              <FormControlLabel
                value="delivery"
                control={<Radio />}
                label="Deliver to me"
              />
            </RadioGroup>
            {fulfilment === "delivery" ? (
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <FormControl fullWidth required>
                  <InputLabel id="delivery-zone-label">
                    Delivery area
                  </InputLabel>
                  <Select
                    labelId="delivery-zone-label"
                    name="delivery_zone_id"
                    label="Delivery area"
                    value={zoneID}
                    onChange={(event) => onZoneChange(event.target.value)}
                  >
                    {zones.map((zone) => (
                      <MenuItem key={zone.zone_id} value={zone.zone_id}>
                        {zone.name} — {formatGHS(zone.fee_minor)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  name="delivery_address"
                  label="Delivery address"
                  placeholder="House number, street, area, landmark"
                  required
                  fullWidth
                  multiline
                  minRows={2}
                />
                <TextField
                  name="gps_location"
                  label="GPS location (optional)"
                  placeholder="GA-123-4567 or Google Maps link"
                  fullWidth
                />
              </Stack>
            ) : null}
          </Box>
        ) : null}

        <TextField
          name="customer_name"
          label="Full name"
          required
          fullWidth
          defaultValue={profile?.display_name ?? ""}
        />
        <TextField
          name="customer_email"
          label="Email"
          type="email"
          required
          fullWidth
          defaultValue={profile?.email ?? ""}
        />
        <TextField
          name="customer_phone"
          label="Phone"
          helperText="For calls and SMS order updates."
          fullWidth
          defaultValue={profile?.phone ?? ""}
        />
        <TextField
          name="customer_whatsapp"
          label="WhatsApp number"
          placeholder="e.g. 024 123 4567"
          helperText="The store owner uses this to chat with you about your order (incl. bespoke pricing)."
          fullWidth
          defaultValue={profile?.whatsapp_phone ?? ""}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          startIcon={<LockRounded />}
          disabled={submitting || !canPayNow}
          sx={{
            bgcolor: tokens.burgundy,
            "&:hover": { bgcolor: alpha(tokens.burgundy, 0.85) },
          }}
        >
          {submitting
            ? "Starting payment…"
            : `Pay ${formatGHS(grandTotal)} with Paystack`}
        </Button>
        {/* "XCreativs" is the name that appears at payment, which is unfamiliar
            to a shopper who only knows Xtiitch — say so here, at the moment of
            payment, so it reads as expected rather than as a wrong charge. */}
        <XCreativsPaymentNotice />
      </Stack>
    </Form>
  );
}
