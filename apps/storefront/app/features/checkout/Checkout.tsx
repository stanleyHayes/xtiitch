import { useEffect, useState } from "react";
import { Link as RouterLink, useFetcher, useRevalidator } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import { formatGHS } from "../../lib/format";
import type { CheckoutQuote } from "../../lib/api";
import type { CartItem } from "../../lib/cart";
import type { CustomerProfile } from "../../lib/discovery";
import { checkoutTaxLine } from "../../lib/checkout-fees";
import CheckoutForm from "./CheckoutForm";

type Zone = {
  zone_id: string;
  name: string;
  fee_minor: number;
};

type QuoteActionData = {
  quote: CheckoutQuote | null;
  zoneID: string;
};

// Where the customer stands on returning from Paystack (the checkout loader
// verifies the ?reference= Paystack appended to the callback):
// - "succeeded": charge confirmed — basket cleared, success panel shows.
// - "pending": Paystack still has an open attempt — cart intact, but a second
//   charge stays blocked until the first resolves.
// - "retry": payment failed/abandoned — normal checkout, cart intact, Pay Now
//   active, plus a nothing-was-charged banner.
// - "unconfirmed": the verify call itself failed — same non-trapping checkout
//   with a softer "we couldn't confirm" banner.
// - null: a fresh visit, no payment return involved.
export type PaymentState =
  | "succeeded"
  | "pending"
  | "retry"
  | "unconfirmed"
  | null;

type CheckoutProps = {
  storeHandle: string;
  items: CartItem[];
  totalMinor: number;
  zones: Zone[];
  profile: CustomerProfile | null;
  // §4.5: the pickup quote from checkout-quote; null when the quote endpoint
  // failed, in which case the page blocks payment with a retry instead of
  // rendering a bill that could silently drop passed-down tax/fee lines.
  quote: CheckoutQuote | null;
  paymentState: PaymentState;
  pendingDeliveryZoneID?: string;
  actionData?: { error?: string } | null;
};

// eslint-disable-next-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
export default function Checkout({
  storeHandle,
  items,
  zones,
  profile,
  quote,
  paymentState,
  pendingDeliveryZoneID = "",
  actionData,
}: CheckoutProps) {
  const recoveryLocked = paymentState !== null && paymentState !== "succeeded";
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">(
    pendingDeliveryZoneID ? "delivery" : "pickup",
  );
  const [zoneID, setZoneID] = useState(pendingDeliveryZoneID);
  // Choosing a delivery zone re-prices the SAME basket through checkout-quote
  // (the "quote" action intent), so the fee lines and total on screen are
  // always exactly what the charge will ask for.
  const quoteFetcher = useFetcher<QuoteActionData>();
  const revalidator = useRevalidator();
  // Browser Back can restore the pre-Paystack checkout from bfcache without a
  // network request. Revalidate that restored document so the loader checks the
  // pending reference stored with the cart and renders the true provider state.
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        revalidator.revalidate();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [revalidator]);
  const submitAction = `/checkout?store=${encodeURIComponent(storeHandle)}`;
  const requestZoneQuote = (zone: string) => {
    if (!zone) {
      return;
    }
    const body = new FormData();
    body.set("intent", "quote");
    body.set("delivery_zone_id", zone);
    quoteFetcher.submit(body, { method: "post", action: submitAction });
  };
  const onFulfilmentChange = (value: "pickup" | "delivery") => {
    if (recoveryLocked) {
      return;
    }
    setFulfilment(value);
    if (value === "delivery") {
      requestZoneQuote(zoneID);
    }
  };
  const onZoneChange = (value: string) => {
    if (recoveryLocked) {
      return;
    }
    setZoneID(value);
    requestZoneQuote(value);
  };

  const selectedZone = zones.find((zone) => zone.zone_id === zoneID);
  // The active quote: pickup quote for pickup; the matching zone quote once
  // the fetcher returns it (the pickup quote shows through while it loads).
  const zoneQuote =
    quoteFetcher.data && quoteFetcher.data.zoneID === zoneID
      ? quoteFetcher.data.quote
      : null;
  const activeQuote = fulfilment === "delivery" && zoneID ? zoneQuote : quote;

  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  const hasBespoke = items.some((item) => item.kind === "bespoke");
  const deliveryOffered = hasMadeToWear && zones.length > 0;

  // Amounts derive from ONE source — the quote — so what is displayed matches
  // the initiation response's `fees` (same engine, same inputs). There is NO
  // items-only fallback total: when the quote cannot be loaded the page shows
  // an inline error with a retry and blocks payment, so a passed-down tax/fee
  // line can never silently drop off the bill.
  const quoting = quoteFetcher.state !== "idle" || revalidator.state !== "idle";
  const quoteFailed = !activeQuote && !quoting;
  const fallbackDeliveryFee =
    fulfilment === "delivery" && selectedZone ? selectedZone.fee_minor : 0;
  const deliveryFee = activeQuote
    ? activeQuote.delivery_fee_minor
    : fallbackDeliveryFee;
  const payMinor = activeQuote ? activeQuote.total_minor : null;
  const taxLine = checkoutTaxLine(activeQuote);
  const retryQuote = () => {
    if (fulfilment === "delivery" && zoneID) {
      requestZoneQuote(zoneID);
    } else {
      revalidator.revalidate();
    }
  };

  // Verified payment success (the loader confirmed the reference with the API
  // and cleared this store's basket lines): a clean success state replaces the
  // form — no stale "submitting" button, no way to pay the same basket twice.
  if (paymentState === "succeeded") {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Container sx={{ py: { xs: 4, md: 6 }, maxWidth: "sm" }}>
          <Stack spacing={2} sx={{ textAlign: "center", pt: 6 }}>
            <CheckCircleRounded
              sx={{ fontSize: 56, color: "success.main", mx: "auto" }}
            />
            <Typography variant="h4" component="h1">
              Payment successful
            </Typography>
            <Typography sx={{ color: "text.secondary" }}>
              Your payment was confirmed and your order is in. The studio will
              take it from here — you can follow progress from your account.
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "center", pt: 1 }}
            >
              <Button component={RouterLink} to="/account" variant="contained">
                View your orders
              </Button>
              <Button component={RouterLink} to="/cart" variant="outlined">
                Back to cart
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>
    );
  }

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

        {paymentState === "retry" ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your payment wasn&apos;t completed — nothing was charged. You can
            try again whenever you&apos;re ready.
          </Alert>
        ) : null}
        {paymentState === "pending" ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Paystack is still confirming your previous payment attempt. Your
            cart is safe, and we won&apos;t start another charge until it
            resolves. Refresh shortly to check again.
          </Alert>
        ) : null}
        {paymentState === "unconfirmed" ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            We couldn&apos;t confirm your payment just now. If you completed it,
            it will reflect in your account shortly. Refresh before trying again
            so we can confirm Paystack&apos;s status first.
          </Alert>
        ) : null}

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
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(item.amount_minor * item.quantity)}
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
          {/* §4.5 fee naming: ONE combined "Transaction fee" line (never a raw
              "Paystack fee") and a separate "Tax fee" only when the store has
              chosen to pass tax down to the customer. Absorbed tax is not a
              customer charge and therefore renders no row. */}
          {activeQuote && activeQuote.transaction_fee_minor > 0 ? (
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Transaction fee
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(activeQuote.transaction_fee_minor)}
              </Typography>
            </Stack>
          ) : null}
          {taxLine ? (
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {taxLine.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(taxLine.amountMinor)}
              </Typography>
            </Stack>
          ) : null}
          {/* No quote, no total: rather than rendering a bill that could
              silently miss passed-down tax/fee lines, fail loudly with a
              retry and keep payment blocked until the full quote loads. */}
          {quoteFailed ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={retryQuote}>
                  Retry
                </Button>
              }
            >
              We couldn&apos;t load the full bill, so taxes and fees may be
              missing. Retry — we never charge without showing the complete
              total.
            </Alert>
          ) : (
            <>
              <Divider />
              <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                <Typography sx={{ fontWeight: 900 }}>Total</Typography>
                <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
                  {payMinor !== null ? formatGHS(payMinor) : "…"}
                </Typography>
              </Stack>
            </>
          )}
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

        <CheckoutForm
          storeHandle={storeHandle}
          items={items}
          payMinor={payMinor}
          paymentPending={paymentState === "pending"}
          recoveryLocked={recoveryLocked}
          zones={zones}
          profile={profile}
          fulfilment={fulfilment}
          onFulfilmentChange={onFulfilmentChange}
          zoneID={zoneID}
          onZoneChange={onZoneChange}
          deliveryOffered={deliveryOffered}
        />
      </Container>
    </Box>
  );
}
