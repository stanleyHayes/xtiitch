import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

export function DashboardSnackbar({
  open,
  onClose,
  message,
  severity,
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
  severity?: "success" | "error";
}) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={5200}
      onClose={(_event, reason) => {
        if (reason !== "clickaway") {
          onClose();
        }
      }}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert
        severity={severity ?? "success"}
        variant="filled"
        onClose={onClose}
        sx={{ borderRadius: 2, boxShadow: 4, fontWeight: 800 }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
