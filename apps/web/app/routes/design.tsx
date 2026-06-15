import { Form, Link as RouterLink, redirect, useNavigation } from "react-router";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import type { Route } from "./+types/design";
import { api, type Design } from "../lib/api";
import { formatGHS, priceLabel } from "../lib/format";

export async function loader({ params }: Route.LoaderArgs) {
  const design = await api.design(params.handle);
  if (!design) {
    throw new Response("Design not found", { status: 404 });
  }
  return { design };
}

export function meta({ data }: Route.MetaArgs) {
  const title = data?.design.title ?? "Design";
  return [
    { title: `${title} · Xtiitch` },
    { name: "description", content: data?.design.description || `View ${title} on Xtiitch.` },
  ];
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const storeHandle = String(form.get("store_handle") ?? "").trim();
  const sizeBandId = String(form.get("size_band_id") ?? "").trim();
  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const method = String(form.get("method") ?? "momo") === "card" ? "card" : "momo";

  if (!storeHandle || !sizeBandId || !customerName || !customerEmail) {
    return { error: "Add your name, email, and size before checkout." };
  }

  const response = await api.placeOrder(storeHandle, {
    design_handle: params.handle,
    size_band_id: sizeBandId,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    method,
  });

  if (!response.ok) {
    return { error: checkoutMessage(response.error) };
  }

  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url);
  }
  return redirect(`/track/${response.result.order_id}`);
}

function checkoutMessage(code: string): string {
  switch (code) {
    case "store_not_verified":
      return "This store needs to finish payment verification before it can take online orders.";
    case "invalid_order":
      return "Check the selected size and contact details, then try again.";
    case "not_found":
      return "This design is not available for ordering right now.";
    default:
      return "Checkout could not start. Please try again shortly.";
  }
}

function Gallery({ design }: { design: Design }) {
  const cover = design.images[0];
  return (
    <Box>
      {cover ? (
        <Box
          component="img"
          src={cover}
          alt={design.title}
          sx={{ width: "100%", borderRadius: 3, aspectRatio: "4 / 5", objectFit: "cover" }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{
            width: "100%",
            aspectRatio: "4 / 5",
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(128,0,32,0.08)",
            color: "primary.main",
            fontWeight: 800,
            fontSize: 72,
          }}
        >
          {design.title.slice(0, 1).toUpperCase()}
        </Box>
      )}
      {design.images.length > 1 ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {design.images.slice(1, 5).map((src) => (
            <Box
              key={src}
              component="img"
              src={src}
              alt=""
              sx={{ width: 72, height: 90, objectFit: "cover", borderRadius: 1.5 }}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

export default function DesignPage({ loaderData, actionData }: Route.ComponentProps) {
  const { design } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const store = design.store;
  const canOrder = design.prices.length > 0 && Boolean(store?.handle);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <Link
          component={RouterLink}
          to=".."
          relative="path"
          underline="hover"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 3, color: "text.secondary" }}
        >
          <ArrowBackRounded fontSize="small" /> Back to the store
        </Link>

        <Box
          sx={{
            display: "grid",
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            alignItems: "start",
          }}
        >
          <Gallery design={design} />

          <Box>
            <Typography variant="h4" component="h1">
              {design.title}
            </Typography>
            <Typography variant="h5" sx={{ mt: 1.5, color: "primary.main", fontWeight: 700 }}>
              {priceLabel(design.prices)}
            </Typography>

            {design.customisation_allowed ? (
              <Chip variant="outlined" label="Customisable" sx={{ mt: 2 }} />
            ) : null}

            {design.description ? (
              <Typography sx={{ mt: 3, color: "text.secondary", whiteSpace: "pre-line" }}>
                {design.description}
              </Typography>
            ) : null}

            {design.prices.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Sizes &amp; prices
                </Typography>
                <Stack divider={<Divider />} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  {design.prices.map((price) => (
                    <Stack
                      key={price.size_band_id}
                      direction="row"
                      sx={{ justifyContent: "space-between", px: 2, py: 1.25 }}
                    >
                      <Typography>{price.label}</Typography>
                      <Typography sx={{ fontWeight: 600 }}>{formatGHS(price.price_minor)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : null}

            <Box
              sx={{
                mt: 4,
                p: { xs: 2, sm: 3 },
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
                bgcolor: "background.paper",
              }}
            >
              <Typography variant="h6">Place an order</Typography>
              <Typography sx={{ mt: 0.5, color: "text.secondary" }}>
                Pay securely, then track the order as the studio moves it through red, yellow, and green stages.
              </Typography>
              {actionData?.error ? (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {actionData.error}
                </Alert>
              ) : null}
              {!canOrder ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This design needs a listed size and store connection before it can be ordered online.
                </Alert>
              ) : (
                <Form method="post">
                  <input type="hidden" name="store_handle" value={store?.handle ?? ""} />
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <TextField
                      select
                      name="size_band_id"
                      label="Size"
                      defaultValue={design.prices[0]?.size_band_id ?? ""}
                      required
                      fullWidth
                    >
                      {design.prices.map((price) => (
                        <MenuItem key={price.size_band_id} value={price.size_band_id}>
                          {price.label} · {formatGHS(price.price_minor)}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField name="customer_name" label="Full name" required fullWidth autoComplete="name" />
                    <TextField name="customer_phone" label="Phone" fullWidth autoComplete="tel" />
                    <TextField name="customer_email" label="Email" type="email" required fullWidth autoComplete="email" />
                    <TextField select name="method" label="Payment method" defaultValue="momo" required fullWidth>
                      <MenuItem value="momo">Mobile money</MenuItem>
                      <MenuItem value="card">Card</MenuItem>
                    </TextField>
                    <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                      {isSubmitting ? "Opening checkout..." : "Pay and place order"}
                    </Button>
                  </Stack>
                </Form>
              )}
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
