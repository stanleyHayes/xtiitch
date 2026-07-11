import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";

const accents = ["#800020", "#315f8f", "#2f6b4f", "#b87914"] as const;

const growthLoop = [
  {
    title: "Create the offer",
    body: "Set promo rules, approve a referral programme, register an affiliate, or schedule a sponsored slot.",
    Icon: LocalOfferRoundedIcon,
  },
  {
    title: "Share the link",
    body: "Customers or partners land on a storefront, design page, or labelled sponsored placement.",
    Icon: StorefrontRoundedIcon,
  },
  {
    title: "Let checkout decide",
    body: "Checkout validates the code or attribution, calculates the real payable amount, and records the pending ledger item.",
    Icon: ReceiptLongRoundedIcon,
  },
  {
    title: "Finalize after payment",
    body: "Rewards, redemptions, and partner commissions become real only after the provider confirms payment.",
    Icon: PaidRoundedIcon,
  },
];

export function GrowthLoop() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
        gap: { xs: 2, md: 0 },
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "rgba(var(--surface-rgb), 0.84)",
        boxShadow: "0 26px 70px -56px rgba(21,17,26,0.56)",
      }}
    >
      {growthLoop.map((step, index) => {
        const accent = accents[index % accents.length];
        return (
          <Box
            key={step.title}
            sx={{
              position: "relative",
              p: { xs: 2.5, md: 3 },
              minHeight: 250,
              borderRight: {
                xs: "none",
                md: index === growthLoop.length - 1 ? "none" : "1px solid",
              },
              borderBottom: {
                xs: index === growthLoop.length - 1 ? "none" : "1px solid",
                md: "none",
              },
              borderColor: "divider",
              overflow: "hidden",
            }}
          >
            <Typography
              aria-hidden
              component="p"
              sx={{
                position: "absolute",
                right: 16,
                top: 10,
                fontFamily: "inherit",
                fontSize: 72,
                lineHeight: 1,
                color: `${accent}12`,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </Typography>
            <Box
              aria-hidden
              sx={{
                width: 44,
                height: 44,
                mb: 2,
                borderRadius: 1,
                display: "grid",
                placeItems: "center",
                bgcolor: `${accent}12`,
                color: accent,
                border: "1px solid",
                borderColor: `${accent}28`,
              }}
            >
              <step.Icon fontSize="small" />
            </Box>
            <Typography variant="h5" component="h3">
              {step.title}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              {step.body}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
