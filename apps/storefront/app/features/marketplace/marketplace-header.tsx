import { Form, Link as RouterLink } from "react-router";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ShoppingBagOutlined from "@mui/icons-material/ShoppingBagOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";

export function MarketplaceHeader() {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="xl" sx={{ py: 1.15 }}>
        <Stack
          direction="row"
          spacing={{ xs: 1, md: 2 }}
          sx={{ alignItems: "center" }}
        >
          <Stack
            component={RouterLink}
            to="/"
            direction="row"
            spacing={1}
            sx={{
              alignItems: "center",
              color: "text.primary",
              textDecoration: "none",
            }}
          >
            <Box
              component="img"
              src="/favicon.svg"
              alt=""
              sx={{
                width: 38,
                height: 38,
                borderRadius: 1.25,
                display: "block",
              }}
            />
            <Typography sx={{ fontSize: { xs: 18, sm: 21 }, fontWeight: 900 }}>
              Xtiitch
            </Typography>
          </Stack>

          <Box
            sx={{
              width: "1px",
              height: 28,
              bgcolor: "divider",
              display: { xs: "none", sm: "block" },
            }}
          />
          <Typography
            sx={{ fontWeight: 800, display: { xs: "none", sm: "block" } }}
          >
            Marketplace
          </Typography>

          <Form method="get" action="/discover" style={{ marginLeft: "auto" }}>
            <TextField
              name="q"
              size="small"
              placeholder="Search studios"
              aria-label="Search studios and designs"
              sx={{
                width: { md: 210 },
                display: { xs: "none", md: "block" },
                "& .MuiOutlinedInput-root": { bgcolor: "transparent" },
                "& fieldset": { borderColor: "transparent" },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Form>

          <Box
            sx={{
              width: "1px",
              height: 28,
              bgcolor: "divider",
              display: { xs: "none", md: "block" },
            }}
          />
          <Button
            component={RouterLink}
            to="/cart"
            variant="text"
            startIcon={<ShoppingBagOutlined />}
            sx={{ color: "text.primary", px: { xs: 1, sm: 1.5 }, minWidth: 0 }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              Cart
            </Box>
          </Button>
          <Button
            component={RouterLink}
            to="/account"
            variant="text"
            startIcon={<AccountCircleRounded />}
            sx={{ color: "text.primary", px: { xs: 1, sm: 1.5 }, minWidth: 0 }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              Account
            </Box>
          </Button>
          <IconButton
            component={RouterLink}
            to="/discover"
            aria-label="Search marketplace"
            sx={{
              display: { xs: "inline-flex", md: "none" },
              color: tokens.burgundy,
              bgcolor: alpha(tokens.burgundy, 0.08),
            }}
          >
            <SearchRounded />
          </IconButton>
        </Stack>
      </Container>
    </Box>
  );
}
