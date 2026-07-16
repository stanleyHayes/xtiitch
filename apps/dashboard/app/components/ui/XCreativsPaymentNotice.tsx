import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import { tokens } from "../../theme";

// Shown wherever a payment is started. Xtiitch is a product of XCreativs
// Technologies Ltd, and "XCreativs" — not "Xtiitch" — is the name that appears
// on the Paystack screen and the bank/MoMo statement. Saying so at the point of
// payment prevents an unfamiliar name reading as a fraudulent charge.
export function XCreativsPaymentNotice() {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        alignItems: "flex-start",
        p: 1.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: alpha(tokens.ink, 0.12),
        bgcolor: alpha(tokens.ink, 0.02),
      }}
    >
      <InfoOutlined
        fontSize="small"
        aria-hidden
        sx={{ color: alpha(tokens.ink, 0.5), mt: "2px" }}
      />
      <Typography variant="caption" sx={{ color: alpha(tokens.ink, 0.7) }}>
        Payments show as <strong>XCreativs</strong>, not Xtiitch. Xtiitch is a
        product of XCreativs Technologies Ltd, which handles all payments and
        legals for Xtiitch — so <strong>XCreativs</strong> is the name you&apos;ll
        see while paying and on your statement.
      </Typography>
    </Box>
  );
}
