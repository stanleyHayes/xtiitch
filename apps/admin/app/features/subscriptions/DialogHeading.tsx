import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";



export function DialogHeading({
  title,
  helper,
  onClose,
}: {
  title: string;
  helper: string;
  onClose: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="span" sx={{ display: "block", fontWeight: 950 }}>
          {title}
        </Typography>
        <Typography
          component="span"
          variant="body2"
          sx={{ display: "block", color: "text.secondary" }}
        >
          {helper}
        </Typography>
      </Box>
      <IconButton aria-label="Close" onClick={onClose}>
        <CloseRounded />
      </IconButton>
    </Stack>
  );
}
