import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import ShoppingBagRounded from "@mui/icons-material/ShoppingBagRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import type { Design, ReferralCode, StoreSummary } from "../../lib/api";
import type { RewardCodes } from "./types";
import { LoadingButtonLabel, NoteField } from "./common-fields";
import { RewardFields } from "./rewards";

export function StandardOrderPanel({
  design,
  store,
  isSubmitting,
  error,
  rewardCodes,
  referralPreview,
  coverImage,
}: {
  design: Design;
  store?: StoreSummary;
  isSubmitting: boolean;
  error?: string | null;
  rewardCodes: RewardCodes;
  referralPreview?: ReferralCode | null;
  coverImage: string;
}) {
  const onlineOrderingEnabled = store?.online_ordering_enabled !== false;
  const canOrder =
    design.prices.length > 0 && Boolean(store?.handle) && onlineOrderingEnabled;

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: "1px solid",
        borderColor: alpha(tokens.burgundy, 0.14),
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
          <CreditCardRounded />
        </Box>
        <Box>
          <Typography variant="h6">Order a listed size</Typography>
        </Box>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}
      {!canOrder ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {!onlineOrderingEnabled
            ? `${store?.name ?? "This shop"} isn't taking online orders here yet — reach out to the shop directly to place an order.`
            : "This design needs a listed size and store connection before it can be ordered online."}
        </Alert>
      ) : (
        <Form method="post">
          <input
            type="hidden"
            name="store_handle"
            value={store?.handle ?? ""}
          />
          <input type="hidden" name="title" value={design.title} />
          <input type="hidden" name="image" value={coverImage} />
          <input type="hidden" name="kind" value="made_to_wear" />
          <input
            type="hidden"
            name="bands_json"
            value={JSON.stringify(
              design.prices.map((price) => ({
                size_band_id: price.size_band_id,
                label: price.label,
                price_minor: price.price_minor,
              })),
            )}
          />
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              select
              name="size_band_id"
              label="Size"
              defaultValue={design.prices[0]?.size_band_id ?? ""}
              required
              fullWidth
            >
              {design.prices.map((price) => (
                <MenuItem key={price.size_band_id} value={price.size_band_id}>
                  {price.label} · {formatGHS(price.price_minor)}
                </MenuItem>
              ))}
            </TextField>
            <NoteField />
            <RewardFields
              codes={rewardCodes}
              referralPreview={referralPreview}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                type="submit"
                name="intent"
                value="add_to_cart"
                formNoValidate
                variant="outlined"
                size="large"
                startIcon={<ShoppingBagRounded />}
                sx={{ flex: 1 }}
              >
                Add to cart
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
      )}
    </Box>
  );
}
