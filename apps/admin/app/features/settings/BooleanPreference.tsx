import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { getXtiitchThemeColors } from "@xtiitch/design-tokens";



export function BooleanPreference({
  name,
  label,
  helper,
  defaultChecked,
  disabled = false,
}: {
  name: string;
  label: string;
  helper: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.25,
        border: "1px solid",
        borderRadius: 1.5,
        // `tokens` is the STATIC palette, so `alpha(tokens.white, 0.62)` painted
        // a 62%-opacity white card regardless of theme — a pale grey slab on the
        // dark console, carrying the dark theme's light `text.secondary` on top
        // of it. These read the per-mode set instead, so the card is white on
        // light and a raised dark surface on dark.
        borderColor: (theme) =>
          getXtiitchThemeColors(theme.palette.mode).border,
        bgcolor: (theme) =>
          disabled
            ? alpha(getXtiitchThemeColors(theme.palette.mode).elevated, 0.5)
            : getXtiitchThemeColors(theme.palette.mode).elevated,
      }}
    >
      <input type="hidden" name={name} value="false" />
      <FormControlLabel
        sx={{
          m: 0,
          alignItems: "flex-start",
          ".MuiFormControlLabel-label": { width: "100%" },
        }}
        control={
          <Checkbox
            name={name}
            value="true"
            defaultChecked={defaultChecked}
            disabled={disabled}
            sx={{ pt: 0.2 }}
          />
        }
        label={
          <Box>
            <Typography sx={{ fontWeight: 900 }}>{label}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {helper}
            </Typography>
          </Box>
        }
      />
    </Box>
  );
}
