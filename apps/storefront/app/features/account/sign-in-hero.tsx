import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import LocalShippingRounded from "@mui/icons-material/LocalShippingRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { tokens } from "../../theme";

const JOURNEY_PREVIEW = [
  { label: "All your orders", Icon: ReceiptLongRounded },
  { label: "Live progress", Icon: LocalShippingRounded },
  { label: "Easy handover", Icon: CheckCircleRounded },
] as const;

export function SignInHero() {
  return (
    <Box component="header">
      <Stack
        spacing={1.5}
        sx={{ mb: { xs: 2, md: 2.5 }, alignItems: "flex-start" }}
      >
        <Button
          component={RouterLink}
          to="/"
          variant="text"
          startIcon={<ArrowBackRounded />}
          sx={{
            px: 0,
            minHeight: 36,
            color: "text.secondary",
            fontWeight: 800,
            "& .MuiButton-startIcon": { mr: 1, color: "inherit" },
            "&:hover": { bgcolor: "transparent", color: tokens.burgundy },
          }}
        >
          Back to storefront
        </Button>
        <Typography
          variant="caption"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            width: "fit-content",
            px: 1.25,
            py: 0.55,
            borderRadius: 999,
            border: "1px solid",
            borderColor: alpha(tokens.burgundy, 0.16),
            bgcolor: alpha(tokens.burgundy, 0.07),
            color: tokens.burgundy,
            fontWeight: 950,
            letterSpacing: 0.3,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          Customer account
        </Typography>
      </Stack>
      <Typography
        variant="h2"
        component="h1"
        sx={{
          mt: 1,
          maxWidth: 620,
          fontSize: { xs: "2.6rem", md: "4rem" },
        }}
      >
        Your wardrobe, in progress
      </Typography>
      <Typography
        sx={{
          mt: 2,
          color: "text.secondary",
          maxWidth: 560,
          fontSize: { xs: 16, md: 18 },
        }}
      >
        Sign in without a password to follow every order, retry payments and
        keep your studio conversations in one calm place.
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row", lg: "column", xl: "row" }}
        spacing={1}
        sx={{ mt: 3 }}
      >
        {JOURNEY_PREVIEW.map(({ label, Icon }) => (
          <Stack
            key={label}
            direction="row"
            spacing={0.75}
            sx={{
              alignItems: "center",
              px: 1.25,
              py: 0.9,
              borderRadius: 999,
              border: "1px solid",
              borderColor: alpha(tokens.burgundy, 0.13),
              bgcolor: "rgba(var(--surface-rgb), 0.55)",
              color: "text.secondary",
            }}
          >
            <Icon sx={{ fontSize: 18, color: "primary.main" }} />
            <Typography variant="caption" sx={{ fontWeight: 800 }}>
              {label}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 2.5, alignItems: "center", color: tokens.burgundy }}
      >
        <AutoAwesomeRounded fontSize="small" />
        <Typography sx={{ fontWeight: 800 }}>
          Plus 25 free AI searches every month.
        </Typography>
      </Stack>
    </Box>
  );
}
