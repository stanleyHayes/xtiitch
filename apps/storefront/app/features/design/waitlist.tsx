import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { alpha } from "@mui/material/styles";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import type { Design, StoreSummary } from "../../lib/api";
import { LoadingButtonLabel } from "./common-fields";

export function WaitlistPanel({
  store,
  design,
  isSubmitting,
  error,
  success,
}: {
  store?: StoreSummary;
  design: Design;
  isSubmitting: boolean;
  error: string | null | undefined;
  success: boolean | undefined;
}) {
  if (!store?.waitlist_enabled) {
    return null;
  }
  const brand = store.brand_color || tokens.burgundy;
  return (
    <Box
      sx={{
        mt: 2,
        p: { xs: 2.25, md: 2.75 },
        borderRadius: "8px",
        bgcolor: "rgba(var(--surface-rgb), 0.92)",
        border: "1px solid",
        borderColor: alpha(brand, 0.2),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
        <GroupsRounded sx={{ color: brand }} />
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Join the waiting list
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Sold out or made to order? Leave your details and {store.name} will
        reach out when {design.title} is ready to order.
      </Typography>
      {success ? (
        <Alert severity="success">
          You are on the list — {store.name} will be in touch.
        </Alert>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="waitlist" />
          <input type="hidden" name="store_handle" value={store.handle} />
          <Stack spacing={1.5}>
            <TextField
              name="customer_name"
              label="Your name"
              size="small"
              required
              fullWidth
            />
            <TextField
              name="customer_contact"
              label="Phone or email"
              size="small"
              required
              fullWidth
            />
            <TextField
              name="note"
              label="Note (optional)"
              size="small"
              fullWidth
              multiline
              minRows={2}
              placeholder="Size, colour, timing…"
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? undefined : <GroupsRounded />}
              sx={{
                bgcolor: brand,
                "&:hover": { bgcolor: brand },
                "&.Mui-disabled": {
                  bgcolor: brand,
                  color: tokens.white,
                  opacity: 0.72,
                },
              }}
            >
              {isSubmitting ? (
                <LoadingButtonLabel label="Joining list" />
              ) : (
                "Notify me"
              )}
            </Button>
          </Stack>
        </Form>
      )}
    </Box>
  );
}
