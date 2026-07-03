import { useState } from "react";
import {
  Form,
  Link as RouterLink,
  redirect,
  useNavigation,
} from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
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
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import type { Route } from "./+types/checkout";
import { tokens } from "../theme";
import { formatGHS } from "../lib/format";
import { api } from "../lib/api";
import { cartTotalMinor, clearCart, getCart } from "../lib/cart";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Checkout · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { storeHandle, items } = await getCart(request);
  if (items.length === 0) {
    return redirect("/cart");
  }
  // Delivery zones are offered when the cart has at least one ready-made piece.
  // Bespoke self-measure deposit lines can pay in the same transaction, but they
  // do not carry delivery fulfilment until the balance/order details are agreed.
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  let zones: { zone_id: string; name: string; fee_minor: number }[] = [];
  if (hasMadeToWear && storeHandle) {
    const page = await api.deliveryZones(storeHandle);
    zones = page?.zones ?? [];
  }
  return { storeHandle, items, totalMinor: cartTotalMinor(items), zones };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const { storeHandle, items } = await getCart(request);
  if (items.length === 0) {
    return redirect("/cart");
  }

  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  if (!customerName || !customerEmail) {
    return { error: "Add your name and email to check out." };
  }

  const fulfilment = String(form.get("fulfilment") ?? "pickup");
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  const deliveryZoneID = String(form.get("delivery_zone_id") ?? "").trim();
  const deliveryAddress = String(form.get("delivery_address") ?? "").trim();
  const gpsLocation = String(form.get("gps_location") ?? "").trim();
  if (fulfilment === "delivery" && !hasMadeToWear) {
    return {
      error:
        "Delivery can be selected when your cart includes a ready-made piece.",
    };
  }
  if (fulfilment === "delivery" && (!deliveryZoneID || !deliveryAddress)) {
    return {
      error: "Choose a delivery area and enter the delivery address.",
    };
  }
  const deliveryDestination =
    fulfilment === "delivery" && gpsLocation
      ? `${deliveryAddress}\nGPS: ${gpsLocation}`
      : deliveryAddress;

  const startedHeaders = { "Set-Cookie": await clearCart(request) };
  const failed = {
    error: "We couldn't start that payment. Check your details and try again.",
  };

  // Pickup + a single ready-made piece: the proven single-order checkout. A
  // lone bespoke deposit has no size band, so it must not take this path — it
  // falls through to the group charge below, which settles the deposit.
  const only = items[0];
  if (
    fulfilment !== "delivery" &&
    items.length === 1 &&
    only &&
    only.kind === "made_to_wear"
  ) {
    const response = await api.placeOrder(storeHandle, {
      design_handle: only.design_handle,
      size_band_id: only.size_band_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      method: "momo",
    });
    if (!response.ok) {
      return failed;
    }
    if (response.result.authorization_url) {
      return redirect(response.result.authorization_url, {
        headers: startedHeaders,
      });
    }
    return redirect(`/track/${response.result.order_id}`, {
      headers: startedHeaders,
    });
  }

  // Everything else (several pieces, or delivery): one combined Paystack charge
  // across the cart. Each piece becomes its own order in a checkout group; the
  // single payment's webhook confirms them all. A chosen delivery zone adds its
  // fee to the charge.
  const response = await api.placeCartOrder(storeHandle, {
    items: items.map((item) => ({
      design_handle: item.design_handle,
      size_band_id: item.size_band_id,
      kind: item.kind,
      size_mode: item.size_mode,
      measurements: item.measurements,
    })),
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    method: "momo",
    ...(fulfilment === "delivery"
      ? {
          delivery_zone_id: deliveryZoneID,
          delivery_address: deliveryDestination,
        }
      : {}),
  });
  if (!response.ok) {
    return failed;
  }
  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url, {
      headers: startedHeaders,
    });
  }
  return redirect(`/track/${response.result.order_id}`, {
    headers: startedHeaders,
  });
}

export default function Checkout({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { items, totalMinor, zones } = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const canPayNow = items.length > 0;
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  const hasBespoke = items.some((item) => item.kind === "bespoke");
  const deliveryOffered = hasMadeToWear && zones.length > 0;

  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [zoneID, setZoneID] = useState("");
  const selectedZone = zones.find((zone) => zone.zone_id === zoneID);
  const deliveryFee =
    fulfilment === "delivery" && selectedZone ? selectedZone.fee_minor : 0;
  const grandTotal = totalMinor + deliveryFee;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container sx={{ py: { xs: 4, md: 6 }, maxWidth: "sm" }}>
        <Button
          component={RouterLink}
          to="/cart"
          variant="text"
          startIcon={<ArrowBackRounded />}
          sx={{ px: 0, color: "text.secondary", fontWeight: 800, mb: 2 }}
        >
          Back to cart
        </Button>
        <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
          Secure checkout
        </Typography>

        <Stack
          spacing={1}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            p: 2,
            mb: 2,
          }}
        >
          {items.map((item) => (
            <Stack
              key={item.line_id}
              direction="row"
              sx={{ justifyContent: "space-between" }}
            >
              <Typography variant="body2" noWrap sx={{ pr: 1 }}>
                {item.title}
                {item.kind === "bespoke" ? " (bespoke deposit)" : ""}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(item.amount_minor)}
              </Typography>
            </Stack>
          ))}
          {deliveryFee > 0 ? (
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Delivery{selectedZone ? ` · ${selectedZone.name}` : ""}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(deliveryFee)}
              </Typography>
            </Stack>
          ) : null}
          <Divider />
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 900 }}>Total</Typography>
            <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
              {formatGHS(grandTotal)}
            </Typography>
          </Stack>
        </Stack>

        {actionData?.error ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {actionData.error}
          </Alert>
        ) : null}

        {hasBespoke ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Bespoke pieces are charged as deposits in this cart. The store can
            confirm the remaining balance after reviewing the measurements.
          </Alert>
        ) : null}

        <Form method="post">
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
                    setFulfilment(event.target.value as "pickup" | "delivery")
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
                        onChange={(event) => setZoneID(event.target.value)}
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
            />
            <TextField
              name="customer_email"
              label="Email"
              type="email"
              required
              fullWidth
            />
            <TextField name="customer_phone" label="Phone" fullWidth />
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
          </Stack>
        </Form>
      </Container>
    </Box>
  );
}
