import { Link as RouterLink } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { tokens } from "../../theme";

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
          startIcon={<StorefrontRounded />}
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
        Sign in to track orders
      </Typography>
      <Typography
        sx={{
          mt: 2,
          color: "text.secondary",
          maxWidth: 560,
          fontSize: { xs: 16, md: 18 },
        }}
      >
        Your phone or email, no password. Signing in keeps your order
        history in one place and unlocks more natural-language AI searches
        across every Xtiitch shop.
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 2.5, alignItems: "center", color: tokens.burgundy }}
      >
        <AutoAwesomeRounded fontSize="small" />
        <Typography sx={{ fontWeight: 800 }}>
          25 free AI searches a month, signed in.
        </Typography>
      </Stack>
    </Box>
  );
}
