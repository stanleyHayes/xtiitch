import { Form } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import SaveRounded from "@mui/icons-material/SaveRounded";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";

export function PayoutSetupPanel({
  provisioned,
  error,
  success,
}: {
  provisioned: boolean;
  error?: string;
  success?: string;
}) {
  return (
    <Panel id="payouts" sx={{ mt: 2 }}>
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ alignItems: "center", justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <PaymentsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Payout details</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                The mobile money number your settlements are paid out to.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={provisioned ? "Set up" : "Needs setup"}
            tone={provisioned ? "#1b7f4d" : tokens.burgundy}
          />
        </Stack>
        {success ? (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Form method="post">
          <input type="hidden" name="intent" value="setup_payout" />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mt: 2, alignItems: { sm: "center" } }}
          >
            <TextField
              name="settlement_bank"
              label="Network"
              select
              required
              defaultValue="MTN"
              sx={{ minWidth: { sm: 160 } }}
              fullWidth
            >
              <MenuItem value="MTN">MTN MoMo</MenuItem>
              <MenuItem value="VOD">Telecel (Vodafone) Cash</MenuItem>
              <MenuItem value="ATL">AT (AirtelTigo) Money</MenuItem>
            </TextField>
            <TextField
              name="settlement_account"
              label="Mobile money number"
              placeholder="024 000 0000"
              required
              fullWidth
            />
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveRounded />}
              sx={{ alignSelf: { xs: "stretch", sm: "auto" }, flexShrink: 0 }}
            >
              Save payout details
            </Button>
          </Stack>
        </Form>
      </Box>
    </Panel>
  );
}