import { Form, Link as RouterLink, redirect, useNavigation } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import type { Route } from "./+types/checkout-all";
import { tokens } from "../theme";
import { formatGHS } from "../lib/format";
import { api } from "../lib/api";
import {
  cartTotalMinor,
  clearCart,
  getCart,
  itemsForStore,
  storeHandlesInCart,
} from "../lib/cart";
import { getSession } from "../lib/session";
import { fetchCustomerProfile } from "../lib/discovery";

// §3b: a verified customer session is required to pay; §4: "pay once" is only
// for a multi-store basket, so a single store falls back to that store's
// checkout and an empty basket to the cart.
const SIGN_IN_REDIRECT = "/account?redirectTo=/checkout-all";

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Checkout · Xtiitch" },
    { name: "robots", content: "noindex" },
  ];
}

function singleOrEmptyRedirect(stores: string[]): string {
  const only = stores[0];
  return only ? `/checkout?store=${encodeURIComponent(only)}` : "/cart";
}

export async function loader({ request }: Route.LoaderArgs) {
  const { items } = await getCart(request);
  const stores = storeHandlesInCart(items);
  if (stores.length < 2) {
    return redirect(singleOrEmptyRedirect(stores));
  }
  const session = await getSession(request.headers.get("Cookie"));
  const token = session.get("customerToken") as string | undefined;
  if (!token) {
    return redirect(SIGN_IN_REDIRECT);
  }
  const profile = await fetchCustomerProfile(token);
  const groups = stores.map((handle) => {
    const storeItems = itemsForStore(items, handle);
    return {
      handle,
      items: storeItems,
      subtotalMinor: cartTotalMinor(storeItems),
    };
  });
  return { groups, totalMinor: cartTotalMinor(items), profile };
}

export async function action({ request }: Route.ActionArgs) {
  const { items } = await getCart(request);
  const stores = storeHandlesInCart(items);
  if (stores.length < 2) {
    return redirect(singleOrEmptyRedirect(stores));
  }
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.get("customerToken")) {
    return redirect(SIGN_IN_REDIRECT);
  }

  const form = await request.formData();
  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerWhatsApp = String(form.get("customer_whatsapp") ?? "").trim();
  if (!customerName || !customerEmail) {
    return { error: "Add your name and email to check out." };
  }

  const response = await api.placeMarketplaceOrder({
    stores: stores.map((handle) => ({
      store_handle: handle,
      items: itemsForStore(items, handle).map((item) => ({
        design_handle: item.design_handle,
        size_band_id: item.size_band_id,
        kind: item.kind,
        size_mode: item.size_mode,
        measurements: item.measurements,
        note: item.note || undefined,
      })),
    })),
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_whatsapp: customerWhatsApp,
    customer_email: customerEmail,
    method: "momo",
  });
  if (!response.ok) {
    return {
      error: "We couldn't start that payment. Check your details and try again.",
    };
  }

  const startedHeaders = { "Set-Cookie": await clearCart(request) };
  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url, {
      headers: startedHeaders,
    });
  }
  return redirect("/account", { headers: startedHeaders });
}

export default function CheckoutAll({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { groups, totalMinor, profile } = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

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
        <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
          Pay for every studio at once
        </Typography>
        <Typography sx={{ color: "text.secondary", mb: 2 }}>
          One payment covers your whole basket; each studio is paid its share
          directly. Pieces are collected from each studio (pickup).
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
          {groups.map((group) => (
            <Stack
              key={group.handle}
              direction="row"
              sx={{ justifyContent: "space-between" }}
            >
              <Typography variant="body2" noWrap sx={{ pr: 1 }}>
                {group.handle} · {group.items.length} item
                {group.items.length === 1 ? "" : "s"}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(group.subtotalMinor)}
              </Typography>
            </Stack>
          ))}
          <Divider />
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 900 }}>Total</Typography>
            <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
              {formatGHS(totalMinor)}
            </Typography>
          </Stack>
        </Stack>

        {actionData?.error ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {actionData.error}
          </Alert>
        ) : null}

        <Form method="post">
          <Stack spacing={1.5}>
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
              helperText="Each studio uses this to chat with you about your order."
              fullWidth
              defaultValue={profile?.whatsapp_phone ?? ""}
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              startIcon={<LockRounded />}
              disabled={submitting}
              sx={{
                bgcolor: tokens.burgundy,
                "&:hover": { bgcolor: alpha(tokens.burgundy, 0.85) },
              }}
            >
              {submitting
                ? "Starting payment…"
                : `Pay ${formatGHS(totalMinor)} with Paystack`}
            </Button>
          </Stack>
        </Form>
      </Container>
    </Box>
  );
}
