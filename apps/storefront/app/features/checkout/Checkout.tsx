import { useState } from "react";
import { Link as RouterLink } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { formatGHS } from "../../lib/format";
import type { CartItem } from "../../lib/cart";
import type { CustomerProfile } from "../../lib/discovery";
import CheckoutForm from "./CheckoutForm";

type Zone = {
  zone_id: string;
  name: string;
  fee_minor: number;
};

type CheckoutProps = {
  storeHandle: string;
  items: CartItem[];
  totalMinor: number;
  zones: Zone[];
  profile: CustomerProfile | null;
  actionData?: { error?: string } | null;
};

export default function Checkout({
  storeHandle,
  items,
  totalMinor,
  zones,
  profile,
  actionData,
}: CheckoutProps) {
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [zoneID, setZoneID] = useState("");
  const selectedZone = zones.find((zone) => zone.zone_id === zoneID);
  const deliveryFee =
    fulfilment === "delivery" && selectedZone ? selectedZone.fee_minor : 0;
  const grandTotal = totalMinor + deliveryFee;
  const hasMadeToWear = items.some((item) => item.kind === "made_to_wear");
  const hasBespoke = items.some((item) => item.kind === "bespoke");
  const deliveryOffered = hasMadeToWear && zones.length > 0;

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

        <CheckoutForm
          storeHandle={storeHandle}
          items={items}
          totalMinor={totalMinor}
          zones={zones}
          profile={profile}
          fulfilment={fulfilment}
          onFulfilmentChange={setFulfilment}
          zoneID={zoneID}
          onZoneChange={setZoneID}
          deliveryOffered={deliveryOffered}
        />
      </Container>
    </Box>
  );
}
