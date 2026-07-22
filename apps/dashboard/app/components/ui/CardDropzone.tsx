import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";

// A dashed-border upload dropzone for one side of the Ghana Card. Shows an icon,
// a prompt, and the size/format hint; flips to a "selected" state with the file
// name once a photo is chosen. The whole box is the file <label>, so it works in
// both JS-driven (billing) and native multipart (settings) forms.
export function CardDropzone({
  name,
  side,
  fileName,
  onFile,
}: Readonly<{
  name: string;
  side: "Front" | "Back";
  fileName: string;
  onFile: (value: string) => void;
}>) {
  const chosen = fileName.length > 0;
  return (
    <Box
      component="label"
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        textAlign: "center",
        px: 2,
        py: 2.5,
        cursor: "pointer",
        borderRadius: 2,
        border: "2px dashed",
        borderColor: (theme) =>
          chosen
            ? alpha(theme.palette.primary.main, 0.72)
            : alpha(theme.palette.text.primary, 0.28),
        bgcolor: (theme) =>
          chosen
            ? alpha(theme.palette.primary.main, 0.1)
            : alpha(theme.palette.text.primary, 0.025),
        transition: "border-color .15s ease, background-color .15s ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
        },
        "&:focus-within": {
          borderColor: "primary.main",
          outline: (theme) =>
            `3px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          outlineOffset: 2,
        },
      }}
    >
      {chosen ? (
        <CheckCircleRounded sx={{ color: "primary.main", fontSize: 30 }} />
      ) : (
        <CloudUploadRounded
          sx={{ color: "text.secondary", fontSize: 30 }}
        />
      )}
      <Typography
        sx={{
          fontWeight: 700,
          color: chosen ? "primary.main" : "text.primary",
          wordBreak: "break-word",
        }}
      >
        {chosen ? fileName : `${side} of Ghana Card`}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {chosen ? "Tap to replace" : "PNG or JPG · up to 5 MB"}
      </Typography>
      <input
        type="file"
        name={name}
        accept="image/png,image/jpeg"
        hidden
        onChange={(event) => onFile(event.target.files?.[0]?.name ?? "")}
      />
    </Box>
  );
}
