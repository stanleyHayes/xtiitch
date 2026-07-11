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
import {
  cartTotalMinor,
  clearStoreItems,
  getCart,
  itemsForStore,
  storeHandlesInCart,
} from "../lib/cart";
import { getSession } from "../lib/session";
import { fetchCustomerProfile } from "../lib/discovery";

// §3b: paying requires a verified customer session. Guests are sent to sign in
// and returned to the same checkout URL (keeping any ?store= selection) with the
// cart intact.
function signInRedirect(url: URL): string {
  return `/account?redirectTo=${encodeURIComponent("/checkout" + url.search)}`;
}

// resolveCheckoutStore picks which store's basket lines this checkout settles:
// the ?store= param, or the sole store when the unified basket has just one.
function resolveCheckoutStore(url: URL, stores: string[]): string {
  const requested = url.searchParams.get("store") ?? "";
  if (requested) {
    return requested;
  }
  return stores.length === 1 ? (stores[0] ?? "") : "";
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Checkout · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { items: allItems } = await getCart(request);
  if (allItems.length === 0) {
    return redirect("/cart");
  }
  const url = new URL(request.url);
  // §3b account gate: a verified customer session is required to pay. Guests are
  // redirected to sign in and returned here (store selection preserved); the cart
  // (its own cookie) survives.
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("customerToken") as string | undefined;
  if (!token) {
    return redirect(signInRedirect(url));
  }
  // §4: settle ONE store's basket lines per charge. Resolve the store and filter
  // to its items; a multi-store basket with no store chosen goes back to the cart
  // to pick a shop to check out.
  const storeHandle = resolveCheckoutStore(url, storeHandlesInCart(allItems));
  const items = storeHandle ? itemsForStore(allItems, storeHandle) : [];
  if (items.length === 0) {
    return redirect("/cart");
  }
  // Prefill the contact fields from the signed-in profile so a verified shopper
  // does not re-type what we already hold.
  const profile = await fetchCustomerProfile(token);
  // Delivery zones are offered when the cart has at least one ready-made piece.
  // Bespoke self-measure deposit lines can pay in the same transaction, but they
  // do not carry delivery fulfilment until the balance/order details are agreed.
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  let zones: { zone_id: string; name: string; fee_minor: number }[] = [];
  if (hasMadeToWear && storeHandle) {
    const page = await api.deliveryZones(storeHandle);
    zones = page?.zones ?? [];
  }
  return {
    storeHandle,
    items,
    totalMinor: cartTotalMinor(items),
    zones,
    profile,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const url = new URL(request.url);
  const { items: allItems } = await getCart(request);
  if (allItems.length === 0) {
    return redirect("/cart");
  }
  // §3b: enforce the account gate on submit too, so a direct POST without a
  // verified session cannot place an order past the loader redirect.
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.get("customerToken")) {
    return redirect(signInRedirect(url));
  }
  // §4: settle exactly one store's lines (same resolution as the loader).
  const storeHandle = resolveCheckoutStore(url, storeHandlesInCart(allItems));
  const items = storeHandle ? itemsForStore(allItems, storeHandle) : [];
  if (items.length === 0) {
    return redirect("/cart");
  }

  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerWhatsApp = String(form.get("customer_whatsapp") ?? "").trim();
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

  // Clear only this store's lines on success; any other stores stay in the basket.
  const startedHeaders = {
    "Set-Cookie": await clearStoreItems(request, storeHandle),
  };
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
      customer_whatsapp: customerWhatsApp,
      customer_email: customerEmail,
      method: "momo",
      note: only.note || undefined,
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
      note: item.note || undefined,
    })),
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_whatsapp: customerWhatsApp,
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
  const { storeHandle, items, totalMinor, zones, profile } = loaderData;
  // Post back to this same store's checkout so the action settles the right
  // store's lines regardless of how <Form> would default the search string.
  const submitAction = `/checkout?store=${encodeURIComponent(storeHandle)}`;
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
          </Stack>
        </Form>
      </Container>
    </Box>
  );
}
