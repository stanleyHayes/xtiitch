import {
  Form,
  Link as RouterLink,
  redirect,
  useNavigation,
} from "react-router";
import type { ReactNode } from "react";
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
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import HomeWorkRounded from "@mui/icons-material/HomeWorkRounded";
import PointOfSaleRounded from "@mui/icons-material/PointOfSaleRounded";
import SecurityRounded from "@mui/icons-material/SecurityRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import type { Route } from "./+types/design";
import {
  api,
  type CustomSizeMode,
  type Design,
  type StoreSummary,
} from "../lib/api";
import { formatGHS, priceLabel } from "../lib/format";
import { tokens } from "../theme";

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
    {
      name: "description",
      content: data?.design.description || `View ${title} on Xtiitch.`,
    },
  ];
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "standard");
  const storeHandle = String(form.get("store_handle") ?? "").trim();
  const customerName = String(form.get("customer_name") ?? "").trim();
  const customerPhone = String(form.get("customer_phone") ?? "").trim();
  const customerEmail = String(form.get("customer_email") ?? "").trim();
  const method =
    String(form.get("method") ?? "momo") === "card" ? "card" : "momo";

  if (intent === "custom") {
    const sizeMode = toCustomSizeMode(String(form.get("size_mode") ?? ""));
    if (!storeHandle || !sizeMode || !customerName || !customerEmail) {
      return {
        standardError: null,
        customError: "Choose a bespoke route and add your name and email.",
      };
    }

    const measurements = collectMeasurements(form);
    if (sizeMode === "self_measure" && Object.keys(measurements).length === 0) {
      return {
        standardError: null,
        customError:
          "Add at least one self-measurement before paying the deposit.",
      };
    }

    const response = await api.placeCustomOrder(storeHandle, {
      design_handle: params.handle,
      size_mode: sizeMode,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      method: sizeMode === "come_to_shop" ? undefined : method,
      measurements: sizeMode === "self_measure" ? measurements : undefined,
    });

    if (!response.ok) {
      return {
        standardError: null,
        customError: customOrderMessage(response.error),
      };
    }

    if (response.result.authorization_url) {
      return redirect(response.result.authorization_url);
    }
    return redirect(`/track/${response.result.order_id}`);
  }

  const sizeBandId = String(form.get("size_band_id") ?? "").trim();
  if (!storeHandle || !sizeBandId || !customerName || !customerEmail) {
    return {
      standardError: "Add your name, email, and size before checkout.",
      customError: null,
    };
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
    return {
      standardError: checkoutMessage(response.error),
      customError: null,
    };
  }

  if (response.result.authorization_url) {
    return redirect(response.result.authorization_url);
  }
  return redirect(`/track/${response.result.order_id}`);
}

function toCustomSizeMode(value: string): CustomSizeMode | null {
  if (
    value === "self_measure" ||
    value === "home_visit" ||
    value === "come_to_shop"
  ) {
    return value;
  }
  return null;
}

function collectMeasurements(form: FormData): Record<string, string> {
  const measurements: Record<string, string> = {};
  for (const rawFieldID of form.getAll("measurement_field_id")) {
    const fieldID = String(rawFieldID).trim();
    const value = String(form.get(`measurement_${fieldID}`) ?? "").trim();
    if (fieldID && value) {
      measurements[fieldID] = value;
    }
  }
  return measurements;
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

function customOrderMessage(code: string): string {
  switch (code) {
    case "store_not_verified":
      return "This store needs to finish payment verification before it can take deposit payments.";
    case "store_cannot_take_order":
      return "This store has not enabled this bespoke order route yet.";
    case "invalid_order":
      return "Check the bespoke route, contact details, and measurements, then try again.";
    case "not_found":
      return "This design is not available for bespoke orders right now.";
    default:
      return "The bespoke order could not start. Please try again shortly.";
  }
}

function Gallery({ design }: { design: Design }) {
  const cover = design.images[0] ?? "/images/storefront-atelier-review.webp";
  const hasUploadedCover = Boolean(design.images[0]);
  return (
    <Box sx={{ position: { lg: "sticky" }, top: { lg: 24 } }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: alpha(tokens.ink, 0.08),
          boxShadow: `0 24px 70px ${alpha(tokens.ink, 0.12)}`,
          bgcolor: "background.paper",
        }}
      >
        <Box
          component="img"
          src={cover}
          alt={
            hasUploadedCover
              ? design.title
              : `Studio preview for ${design.title}`
          }
          sx={{
            width: "100%",
            aspectRatio: "4 / 5",
            objectFit: "cover",
            display: "block",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: "auto 0 0",
            height: "34%",
            background: `linear-gradient(0deg, ${alpha(tokens.ink, 0.52)}, transparent)`,
          }}
        />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 14,
            flexWrap: "wrap",
          }}
        >
          <Chip
            icon={<CreditCardRounded />}
            label={priceLabel(design.prices)}
            sx={{
              bgcolor: alpha(tokens.white, 0.92),
              color: tokens.ink,
              fontWeight: 900,
              backdropFilter: "blur(10px)",
              "& .MuiChip-icon": { color: tokens.burgundy },
            }}
          />
          {design.customisation_allowed ? (
            <Chip
              icon={<StraightenRounded />}
              label="Custom fit available"
              sx={{
                bgcolor: alpha(tokens.ink, 0.78),
                color: tokens.white,
                fontWeight: 900,
                backdropFilter: "blur(10px)",
                "& .MuiChip-icon": { color: tokens.white },
              }}
            />
          ) : null}
        </Stack>
      </Box>
      {design.images.length > 1 ? (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.5, flexWrap: "wrap" }}>
          {design.images.slice(1, 5).map((src) => (
            <Box
              key={src}
              component="img"
              src={src}
              alt=""
              sx={{
                width: 72,
                height: 90,
                objectFit: "cover",
                borderRadius: 1.5,
              }}
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

function resolveDepositMinor(design: Design, store: StoreSummary): number {
  return design.deposit_override_minor ?? store.default_deposit_minor;
}

function ContactFields() {
  return (
    <>
      <TextField
        name="customer_name"
        label="Full name"
        required
        fullWidth
        autoComplete="name"
      />
      <TextField
        name="customer_phone"
        label="Phone"
        fullWidth
        autoComplete="tel"
      />
      <TextField
        name="customer_email"
        label="Email"
        type="email"
        required
        fullWidth
        autoComplete="email"
      />
    </>
  );
}

function PaymentMethodField() {
  return (
    <TextField
      select
      name="method"
      label="Payment method"
      defaultValue="momo"
      required
      fullWidth
    >
      <MenuItem value="momo">Mobile money</MenuItem>
      <MenuItem value="card">Card</MenuItem>
    </TextField>
  );
}

function SizePriceList({ design }: { design: Design }) {
  if (design.prices.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 900 }}>
        Sizes &amp; prices
      </Typography>
      <Stack
        divider={<Divider />}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          overflow: "hidden",
          bgcolor: alpha(tokens.white, 0.72),
        }}
      >
        {design.prices.map((price) => (
          <Stack
            key={price.size_band_id}
            direction="row"
            sx={{
              justifyContent: "space-between",
              gap: 2,
              px: 2,
              py: 1.25,
            }}
          >
            <Typography>{price.label}</Typography>
            <Typography sx={{ fontWeight: 800 }}>
              {formatGHS(price.price_minor)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function DetailSignal({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.1}
      sx={{
        alignItems: "center",
        p: 1.25,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        bgcolor: alpha(tokens.white, 0.72),
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "8px",
          display: "grid",
          placeItems: "center",
          color: tokens.burgundy,
          bgcolor: alpha(tokens.burgundy, 0.08),
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 900 }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 900 }} noWrap>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function StandardOrderPanel({
  design,
  store,
  isSubmitting,
  error,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const canOrder = design.prices.length > 0 && Boolean(store?.handle);

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.14),
        borderRadius: "8px",
        bgcolor: "background.paper",
        boxShadow: `0 18px 48px ${alpha(tokens.ink, 0.08)}`,
      }}
    >
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: tokens.white,
            bgcolor: tokens.burgundy,
            flexShrink: 0,
          }}
        >
          <CreditCardRounded />
        </Box>
        <Box>
          <Typography variant="h6">Order a listed size</Typography>
          <Typography sx={{ mt: 0.35, color: "text.secondary" }}>
            Pick a published size, pay online, and track the piece as the studio
            moves it through production.
          </Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}
      {!canOrder ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          This design needs a listed size and store connection before it can be
          ordered online.
        </Alert>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="standard" />
          <input
            type="hidden"
            name="store_handle"
            value={store?.handle ?? ""}
          />
          <Stack spacing={1.5} sx={{ mt: 2 }}>
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
            <ContactFields />
            <PaymentMethodField />
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSubmitting}
              sx={{ alignSelf: "stretch" }}
            >
              {isSubmitting ? "Opening checkout..." : "Pay and place order"}
            </Button>
          </Stack>
        </Form>
      )}
    </Box>
  );
}

type CustomRoute = {
  mode: CustomSizeMode;
  title: string;
  helper: string;
  icon: ReactNode;
  enabled: boolean;
  disabledReason?: string;
  takesPayment: boolean;
  showMeasurements: boolean;
  buttonLabel: string;
};

function customRoutes(
  store: StoreSummary,
  depositLabel: string,
): CustomRoute[] {
  const measurementFields = store.measurement_fields;

  return [
    {
      mode: "self_measure",
      title: "Self-measure",
      helper: `Send the fit details you already have and pay the ${depositLabel} bespoke deposit.`,
      icon: <StraightenRounded />,
      enabled:
        store.settings.measurements_enabled && measurementFields.length > 0,
      disabledReason: !store.settings.measurements_enabled
        ? "Self-measure is not enabled for this store yet."
        : "This store needs to add measurement fields first.",
      takesPayment: true,
      showMeasurements: true,
      buttonLabel: "Pay bespoke deposit",
    },
    {
      mode: "home_visit",
      title: "Home visit",
      helper: `Start the request with the ${depositLabel} deposit, then the store captures measurements during the visit.`,
      icon: <HomeWorkRounded />,
      enabled: true,
      takesPayment: true,
      showMeasurements: false,
      buttonLabel: "Pay visit deposit",
    },
    {
      mode: "come_to_shop",
      title: "Come to the shop",
      helper:
        "Reserve the request now, then visit the store for measurement and payment arrangements.",
      icon: <StorefrontRounded />,
      enabled: true,
      takesPayment: false,
      showMeasurements: false,
      buttonLabel: "Reserve shop measurement",
    },
  ];
}

function MeasurementInputs({ store }: { store: StoreSummary }) {
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

function CustomRouteForm({
  route,
  store,
  isSubmitting,
}: {
  route: CustomRoute;
  store: StoreSummary;
  isSubmitting: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: route.enabled
          ? alpha(tokens.ink, 0.09)
          : alpha(tokens.ink, 0.06),
        borderRadius: "8px",
        bgcolor: route.enabled
          ? alpha(tokens.white, 0.86)
          : alpha(tokens.ink, 0.025),
      }}
    >
      <Stack direction="row" spacing={1.1} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: route.enabled ? tokens.burgundy : "text.disabled",
            bgcolor: route.enabled
              ? alpha(tokens.burgundy, 0.08)
              : alpha(tokens.ink, 0.04),
            flexShrink: 0,
          }}
        >
          {route.icon}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography sx={{ fontWeight: 950 }}>{route.title}</Typography>
            <Chip
              size="small"
              label={route.takesPayment ? "Deposit" : "No online payment"}
              sx={{
                height: 24,
                bgcolor: route.takesPayment
                  ? alpha(tokens.burgundy, 0.08)
                  : alpha(tokens.success, 0.1),
                color: route.takesPayment ? tokens.burgundy : tokens.success,
                fontWeight: 900,
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
            {route.helper}
          </Typography>
        </Box>
      </Stack>

      {!route.enabled ? (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {route.disabledReason}
        </Alert>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="custom" />
          <input type="hidden" name="store_handle" value={store.handle} />
          <input type="hidden" name="size_mode" value={route.mode} />
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {route.showMeasurements ? (
              <MeasurementInputs store={store} />
            ) : null}
            <ContactFields />
            {route.takesPayment ? <PaymentMethodField /> : null}
            <Button
              type="submit"
              variant={route.takesPayment ? "contained" : "outlined"}
              size="large"
              disabled={isSubmitting}
              sx={{ alignSelf: "stretch" }}
            >
              {isSubmitting ? "Submitting request..." : route.buttonLabel}
            </Button>
          </Stack>
        </Form>
      )}
    </Box>
  );
}

function BespokeOrderPanel({
  design,
  store,
  isSubmitting,
  error,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const unavailableMessage = !store?.handle
    ? "This design needs a store connection before it can take bespoke requests."
    : !design.customisation_allowed
      ? "This design is set up for listed-size orders only."
      : !store.settings.bespoke_enabled
        ? "This store has not enabled bespoke requests yet."
        : "";

  const depositLabel = store
    ? formatGHS(resolveDepositMinor(design, store))
    : "the deposit";
  const routes = store ? customRoutes(store, depositLabel) : [];

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.1),
        borderRadius: "8px",
        bgcolor: alpha(tokens.white, 0.92),
      }}
    >
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "8px",
            display: "grid",
            placeItems: "center",
            color: tokens.burgundy,
            bgcolor: alpha(tokens.burgundy, 0.08),
            flexShrink: 0,
          }}
        >
          <PointOfSaleRounded />
        </Box>
        <Box>
          <Typography variant="h6">Request a bespoke fit</Typography>
          <Typography sx={{ mt: 0.35, color: "text.secondary" }}>
            Choose how the store should capture your measurements. Deposit
            routes redirect to checkout; shop measurement starts tracking
            immediately.
          </Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}
      {unavailableMessage || !store ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {unavailableMessage}
        </Alert>
      ) : (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {routes.map((route) => (
            <CustomRouteForm
              key={route.mode}
              route={route}
              store={store}
              isSubmitting={isSubmitting}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function DesignPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { design } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const store = design.store;
  const brand = store?.brand_color || tokens.burgundy;
  const storeHref = store?.handle ? `/store/${store.handle}` : "/";
  const depositLabel = store
    ? formatGHS(resolveDepositMinor(design, store))
    : "Deposit";
  const fitRouteLabel = design.customisation_allowed
    ? "Listed size or bespoke"
    : "Listed sizes";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        backgroundImage: `linear-gradient(${alpha(brand, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(brand, 0.035)} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      <Container sx={{ py: { xs: 3, md: 5 } }}>
        <Link
          component={RouterLink}
          to={storeHref}
          underline="hover"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            mb: 3,
            color: "text.secondary",
          }}
        >
          <ArrowBackRounded fontSize="small" /> Back to{" "}
          {store?.name ?? "the store"}
        </Link>

        <Box
          sx={{
            display: "grid",
            gap: { xs: 3, lg: 4 },
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.95fr) 1.05fr" },
            alignItems: "start",
          }}
        >
          <Gallery design={design} />

          <Box sx={{ minWidth: 0 }}>
            <Box
              sx={{
                p: { xs: 2.25, md: 3 },
                borderRadius: "8px",
                bgcolor: alpha(tokens.white, 0.92),
                border: "1px solid",
                borderColor: alpha(tokens.ink, 0.08),
                boxShadow: `0 18px 60px ${alpha(tokens.ink, 0.08)}`,
              }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }}
              >
                {store ? (
                  <Chip
                    icon={<StorefrontRounded />}
                    label={store.name}
                    sx={{
                      bgcolor: alpha(brand, 0.08),
                      color: brand,
                      fontWeight: 900,
                      "& .MuiChip-icon": { color: brand },
                    }}
                  />
                ) : null}
                <Chip
                  icon={<SecurityRounded />}
                  label="Secure Xtiitch checkout"
                  sx={{
                    bgcolor: alpha(tokens.ink, 0.06),
                    color: tokens.ink,
                    fontWeight: 900,
                    "& .MuiChip-icon": { color: tokens.ink },
                  }}
                />
              </Stack>

              <Typography variant="h3" component="h1">
                {design.title}
              </Typography>
              <Typography
                variant="h5"
                sx={{ mt: 1, color: "primary.main", fontWeight: 900 }}
              >
                {priceLabel(design.prices)}
              </Typography>

              {design.description ? (
                <Typography
                  sx={{
                    mt: 2.25,
                    color: "text.secondary",
                    whiteSpace: "pre-line",
                    fontSize: { md: 17 },
                  }}
                >
                  {design.description}
                </Typography>
              ) : null}

              <Box
                sx={{
                  mt: 2.5,
                  display: "grid",
                  gap: 1.25,
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                <DetailSignal
                  icon={<CreditCardRounded />}
                  label="Price"
                  value={priceLabel(design.prices)}
                />
                <DetailSignal
                  icon={<PointOfSaleRounded />}
                  label="Deposit"
                  value={design.customisation_allowed ? depositLabel : "N/A"}
                />
                <DetailSignal
                  icon={<StraightenRounded />}
                  label="Fit route"
                  value={fitRouteLabel}
                />
              </Box>

              <Box sx={{ mt: 2.5 }}>
                <SizePriceList design={design} />
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", xl: "0.95fr 1.05fr" },
                alignItems: "start",
              }}
            >
              <StandardOrderPanel
                design={design}
                store={store}
                isSubmitting={isSubmitting}
                error={actionData?.standardError}
              />
              <BespokeOrderPanel
                design={design}
                store={store}
                isSubmitting={isSubmitting}
                error={actionData?.customError}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
