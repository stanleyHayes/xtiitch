import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { tokens } from "../../theme";



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
        borderColor: alpha(tokens.ink, 0.08),
        borderRadius: 1.5,
        bgcolor: disabled
          ? alpha(tokens.ink, 0.035)
          : alpha(tokens.white, 0.62),
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
