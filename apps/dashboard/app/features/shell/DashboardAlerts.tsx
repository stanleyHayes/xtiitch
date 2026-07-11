import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";

export function DashboardAlerts({
  permissionError,
  dataWarnings,
}: {
  permissionError?: string;
  dataWarnings: string[];
}) {
  return (
    <>
      {permissionError ? (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          {permissionError}
        </Alert>
      ) : null}
      {dataWarnings.length > 0 ? (
        <Stack spacing={1} sx={{ mb: 2.5 }}>
          {dataWarnings.slice(0, 5).map((warning) => (
            <Alert key={warning} severity="warning">
              {warning}
            </Alert>
          ))}
        </Stack>
      ) : null}
    </>
  );
}
