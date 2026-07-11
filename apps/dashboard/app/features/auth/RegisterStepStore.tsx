import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import TextField from "../../components/form-text-field";

export function RegisterStepStore({
  businessName,
  onBusinessNameChange,
  handle,
  onHandleChange,
  handleStatus,
  handleOk,
  handleUnavailable,
}: {
  businessName: string;
  onBusinessNameChange: (value: string) => void;
  handle: string;
  onHandleChange: (value: string) => void;
  handleStatus:
    | "idle"
    | "checking"
    | "available"
    | "taken"
    | "reserved"
    | "error";
  handleOk: boolean;
  handleUnavailable: boolean;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField
        name="business_name"
        label="Business name"
        required
        autoComplete="organization"
        fullWidth
        value={businessName}
        onChange={(e) => onBusinessNameChange(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <StorefrontRounded fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField
        name="business_handle"
        label="Store handle"
        required
        fullWidth
        value={handle}
        onChange={(e) => onHandleChange(e.target.value)}
        error={(handle.length > 0 && !handleOk) || handleUnavailable}
        color={handleStatus === "available" ? "success" : undefined}
        focused={handleStatus === "available" ? true : undefined}
        helperText={
          handle.length > 0 && !handleOk
            ? "Lowercase letters, numbers and dashes only."
            : handleStatus === "checking"
              ? "Checking availability…"
              : handleStatus === "available"
                ? `✓ ${handle.trim().toLowerCase()}.xtiitch.com is available`
                : handleStatus === "taken"
                  ? "That store handle is already taken — try another."
                  : handleStatus === "reserved"
                    ? "That handle is reserved — please choose another."
                    : "Becomes <handle>.xtiitch.com"
        }
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">@</InputAdornment>
            ),
          },
        }}
      />
    </Stack>
  );
}
