import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import { tokens } from "../../../theme";
import type { OrderSummary } from "../../shared/types";
import { whatsappHref } from "../../shared/utils";
import { InfoStrip } from "../../studio/InfoStrip";
import { moneyProgress, paymentLabel, paymentTone } from "../utils";

export function OrderItems({
  order,
  showMoneyDetails,
}: {
  order: OrderSummary;
  showMoneyDetails: boolean;
}) {
  const payTone = paymentTone(order);
  const whatsappLink = whatsappHref(
    order.customer_whatsapp,
    order.customer_phone,
  );

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.25,
        gridTemplateColumns: "1fr",
        "@container (min-width: 720px)": {
          gridTemplateColumns: "1fr 1fr",
        },
      }}
    >
      <InfoStrip
        icon={<PaymentsRounded />}
        tone={payTone}
        title={paymentLabel(order)}
        helper={
          showMoneyDetails
            ? moneyProgress(order)
            : "Payment detail visible to owners and admins"
        }
      />
      <InfoStrip
        icon={<PhoneRounded />}
        tone={tokens.info}
        title={order.customer_phone || "No phone captured"}
        helper={order.customer_email || "No email captured"}
      />
      {whatsappLink ? (
        <Button
          component="a"
          href={whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          variant="contained"
          size="small"
          fullWidth
          startIcon={<WhatsApp />}
          sx={{
            mt: 1,
            bgcolor: "#25D366",
            color: "#0a3d20",
            fontWeight: 700,
            "&:hover": { bgcolor: "#1EBE57" },
          }}
        >
          Chat on WhatsApp
          {order.customer_whatsapp ? ` · ${order.customer_whatsapp}` : ""}
        </Button>
      ) : null}
    </Box>
  );
}
