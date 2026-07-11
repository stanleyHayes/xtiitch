import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { tokens } from "../../theme";



export function CardDetailAction({
  onClick,
  label = "View details",
  hint,
}: {
  onClick: () => void;
  label?: string;
  hint?: string;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        mt: 0.5,
        pt: 1.5,
        borderTop: "1px solid",
        borderColor: alpha(tokens.ink, 0.08),
        alignItems: "center",
        justifyContent: hint ? "space-between" : "flex-end",
        flexWrap: "wrap",
        rowGap: 1,
      }}
    >
      {hint ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {hint}
        </Typography>
      ) : null}
      <Button
        variant="outlined"
        endIcon={<ArrowForwardRounded />}
        onClick={onClick}
        sx={{
          borderRadius: 999,
          px: 2.5,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Button>
    </Stack>
  );
}
