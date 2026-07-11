import { useState } from "react";
import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import PointOfSaleRounded from "@mui/icons-material/PointOfSaleRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import type { AvailabilitySlot, CustomSizeMode, Design, ReferralCode, StoreSummary } from "../../lib/api";
import { formatGHS } from "../../lib/format";
import { tokens } from "../../theme";
import type { RewardCodes } from "./types";
import { ContactFields, LoadingButtonLabel, NoteField } from "./common-fields";
import { MeasurementInputs } from "./measurements";
import { RewardFields } from "./rewards";
import { VisitSlotFields } from "./visit-slot-fields";
import { customRoutes, type CustomRoute } from "./bespoke-routes";
import { resolveDepositMinor } from "./utils";

// Self-measure bespoke: fill the size chart, leave a note, then Add to Cart or
// Pay Now. Like the made-to-wear form, it carries no contact fields — personal
// details are collected at checkout.
function SelfMeasureForm({
  design,
  store,
  isSubmitting,
  rewardCodes,
  referralPreview,
  coverImage,
}: {
  design: Design;
  store: StoreSummary;
  isSubmitting: boolean;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  coverImage: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="store_handle" value={store.handle} />
      <input type="hidden" name="size_mode" value="self_measure" />
      <input type="hidden" name="title" value={design.title} />
      <input type="hidden" name="image" value={coverImage} />
      <input type="hidden" name="kind" value="bespoke" />
      <input
        type="hidden"
        name="deposit_minor"
        value={resolveDepositMinor(design, store)}
      />
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        <MeasurementInputs store={store} />
        <NoteField />
        <RewardFields codes={rewardCodes} referralPreview={referralPreview} />
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: "stretch" }}
        >
          <Button
            type="submit"
            name="intent"
            value="add_to_cart"
            formNoValidate
            variant="outlined"
            size="large"
            startIcon={<StraightenRounded />}
            disabled={isSubmitting}
            sx={{ flex: 1 }}
          >
            Add deposit to cart
          </Button>
          <Button
            type="submit"
            name="intent"
            value="buy_now"
            variant="contained"
            size="large"
            disabled={isSubmitting}
            sx={{
              flex: 1,
              "&.Mui-disabled": {
                bgcolor: tokens.burgundy,
                color: tokens.white,
                opacity: 0.72,
              },
            }}
          >
            {isSubmitting ? (
              <LoadingButtonLabel label="Opening checkout" />
            ) : (
              "Pay now"
            )}
          </Button>
        </Stack>
      </Stack>
    </Form>
  );
}

// Home-visit and come-to-shop keep their existing one-shot submit actions
// (booking / reservation). These API routes require the shopper's contact
// details up front and have no checkout step, so they still collect name and
// email here (payment method now defaults to mobile money server-side).
function CustomRouteForm({
  route,
  design,
  store,
  isSubmitting,
  rewardCodes,
  referralPreview,
  visitSlots,
  coverImage,
}: {
  route: CustomRoute;
  design: Design;
  store: StoreSummary;
  isSubmitting: boolean;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  visitSlots: AvailabilitySlot[];
  coverImage: string;
}) {
  if (!route.enabled) {
    return (
      <Alert severity="info" sx={{ mt: 1.5 }}>
        {route.disabledReason}
      </Alert>
    );
  }
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="custom" />
      <input type="hidden" name="store_handle" value={store.handle} />
      <input type="hidden" name="size_mode" value={route.mode} />
      <input type="hidden" name="title" value={design.title} />
      <input type="hidden" name="image" value={coverImage} />
      <input type="hidden" name="kind" value="bespoke" />
      <input
        type="hidden"
        name="deposit_minor"
        value={resolveDepositMinor(design, store)}
      />
      <Stack spacing={1.5} sx={{ mt: 1.5 }}>
        {route.mode === "home_visit" ? (
          <VisitSlotFields slots={visitSlots} />
        ) : null}
        {route.mode === "come_to_shop" ? (
          <Alert severity="info">
            Reserve now, then visit {store.name} to have your measurements taken
            and settle payment in person.
          </Alert>
        ) : null}
        <NoteField />
        <ContactFields />
        {route.takesPayment ? (
          <RewardFields
            codes={rewardCodes}
            referralPreview={referralPreview}
            includePromo={route.mode !== "home_visit"}
          />
        ) : null}
        <Button
          type="submit"
          variant={route.takesPayment ? "contained" : "outlined"}
          size="large"
          disabled={isSubmitting}
          sx={{
            "&.Mui-disabled": route.takesPayment
              ? {
                  bgcolor: tokens.burgundy,
                  color: tokens.white,
                  opacity: 0.72,
                }
              : {
                  borderColor: alpha(tokens.burgundy, 0.42),
                  color: tokens.burgundy,
                  opacity: 0.72,
                },
          }}
        >
          {isSubmitting ? (
            <LoadingButtonLabel label="Submitting request" />
          ) : (
            route.buttonLabel
          )}
        </Button>
      </Stack>
    </Form>
  );
}

export function BespokeCustomise({
  design,
  store,
  isSubmitting,
  error,
  rewardCodes,
  referralPreview,
  visitSlots,
  coverImage,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  visitSlots: AvailabilitySlot[];
  coverImage: string;
}) {
  const [selectedMode, setSelectedMode] = useState<CustomSizeMode | null>(null);

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
  const routes = store ? customRoutes(store, depositLabel, visitSlots) : [];
  const activeRoute =
    routes.find((route) => route.mode === selectedMode) ?? null;

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.16),
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
          <PointOfSaleRounded />
        </Box>
        <Box>
          <Typography variant="h6">Customise this piece</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Choose how you&apos;d like to be measured. The bespoke deposit is
            the same for every option.
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
        <>
          <Stack
            direction="row"
            spacing={1}
            sx={{
              mt: 2,
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.5,
              borderRadius: "8px",
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.14),
              bgcolor: alpha(tokens.burgundy, 0.05),
            }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <PointOfSaleRounded sx={{ color: tokens.burgundy }} />
              <Typography sx={{ fontWeight: 900 }}>Bespoke deposit</Typography>
            </Stack>
            <Typography sx={{ fontWeight: 950, color: "primary.main" }}>
              {depositLabel}
            </Typography>
          </Stack>

          <Typography sx={{ fontWeight: 900, mt: 2, mb: 1 }}>
            How would you like to be measured?
          </Typography>
          <Box
            sx={{
              display: "grid",
              gap: 1,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            {routes.map((route) => {
              const selected = route.mode === selectedMode;
              return (
                <Button
                  key={route.mode}
                  type="button"
                  onClick={() => setSelectedMode(route.mode)}
                  variant={selected ? "contained" : "outlined"}
                  startIcon={route.icon}
                  aria-pressed={selected}
                  sx={{
                    justifyContent: "flex-start",
                    textTransform: "none",
                    fontWeight: 900,
                    px: 1.5,
                    py: 1.25,
                  }}
                >
                  {route.title}
                </Button>
              );
            })}
          </Box>

          {activeRoute ? (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", mb: 0.5 }}
              >
                {activeRoute.helper}
              </Typography>
              {activeRoute.mode === "self_measure" ? (
                <SelfMeasureForm
                  design={design}
                  store={store}
                  isSubmitting={isSubmitting}
                  rewardCodes={rewardCodes}
                  referralPreview={referralPreview}
                  coverImage={coverImage}
                />
              ) : (
                <CustomRouteForm
                  route={activeRoute}
                  design={design}
                  store={store}
                  isSubmitting={isSubmitting}
                  rewardCodes={rewardCodes}
                  referralPreview={referralPreview}
                  visitSlots={visitSlots}
                  coverImage={coverImage}
                />
              )}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Select an option above to continue.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
