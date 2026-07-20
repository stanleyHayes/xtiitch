import { useState } from "react";
import { Link as RouterLink, useFetcher } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { formatGHS } from "../../lib/format";
import type { CheckoutQuote } from "../../lib/api";
import type { CartItem } from "../../lib/cart";
import type { CustomerProfile } from "../../lib/discovery";
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

type CheckoutProps = {
  storeHandle: string;
  items: CartItem[];
  totalMinor: number;
  zones: Zone[];
  profile: CustomerProfile | null;
  // §4.5: the pickup quote from checkout-quote; null when the quote endpoint
  // failed, in which case the page falls back to items + delivery fee only.
  quote: CheckoutQuote | null;
  actionData?: { error?: string } | null;
};

export default function Checkout({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  storeHandle,
  items,
  totalMinor,
  zones,
  profile,
  quote,
  actionData,
}: CheckoutProps) {
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [zoneID, setZoneID] = useState("");
  // Choosing a delivery zone re-prices the SAME basket through checkout-quote
  // (the "quote" action intent), so the fee lines and total on screen are
  // always exactly what the charge will ask for.
  const quoteFetcher = useFetcher<QuoteActionData>();
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
    setFulfilment(value);
    if (value === "delivery") {
      requestZoneQuote(zoneID);
    }
  };
  const onZoneChange = (value: string) => {
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
  // the initiation response's `fees` (same engine, same inputs). The fallback
  // (quote endpoint unreachable) keeps the old items + delivery arithmetic.
  const fallbackDeliveryFee =
    fulfilment === "delivery" && selectedZone ? selectedZone.fee_minor : 0;
  const deliveryFee = activeQuote
    ? activeQuote.delivery_fee_minor
    : fallbackDeliveryFee;
  const payMinor = activeQuote
    ? activeQuote.total_minor
    : totalMinor + fallbackDeliveryFee;

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
          {/* §4.5 fee naming: ONE combined "Transaction fee" line (never a raw
              "Paystack fee") and "Tax (VAT)" as its own line — rendered only
              when non-zero; when the owner absorbs the fees both are 0 and no
              fee lines appear at all. */}
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
          {activeQuote && activeQuote.tax_minor > 0 ? (
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Tax (VAT)
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatGHS(activeQuote.tax_minor)}
              </Typography>
            </Stack>
          ) : null}
          <Divider />
          <Stack direction="row" sx={{ justifyContent: "space-between" }}>
            <Typography sx={{ fontWeight: 900 }}>Total</Typography>
            <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
              {formatGHS(payMinor)}
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

        <CheckoutForm
          storeHandle={storeHandle}
          items={items}
          payMinor={payMinor}
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
