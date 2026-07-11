import { useEffect, useState } from "react";
import { Link, useNavigation } from "react-router";
import type { MetaFunction } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Snackbar from "@mui/material/Snackbar";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { SecurityForm, type SecurityActionResult } from "./SecurityForm";
import type { Route } from "../../routes/+types/security";

export const meta: MetaFunction = () => [
  { title: "Security · Xtiitch" },
  { name: "robots", content: "noindex" },
];

export default function Security({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const result = (actionData ?? {}) as SecurityActionResult;
  const status = loaderData.status;
  const enabled = status.enabled && !result.disabled;
  const securityFeedback = result.error
    ? { message: result.error, severity: "error" as const }
    : result.backupCodes
      ? {
          message: "Two-step verification is on.",
          severity: "success" as const,
        }
      : result.disabled
        ? {
            message: "Two-step verification is off.",
            severity: "success" as const,
          }
        : result.passwordChanged
          ? {
              message: "Your password has been changed.",
              severity: "success" as const,
            }
          : null;
  const [securityFeedbackOpen, setSecurityFeedbackOpen] = useState(
    Boolean(securityFeedback),
  );

  useEffect(() => {
    if (securityFeedback) {
      setSecurityFeedbackOpen(true);
    }
  }, [actionData, securityFeedback?.message, securityFeedback?.severity]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        py: { xs: 4, md: 7 },
      }}
    >
      <Snackbar
        open={securityFeedbackOpen}
        autoHideDuration={5200}
        onClose={(_event, reason) => {
          if (reason !== "clickaway") {
            setSecurityFeedbackOpen(false);
          }
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={securityFeedback?.severity ?? "success"}
          variant="filled"
          onClose={() => setSecurityFeedbackOpen(false)}
          sx={{ borderRadius: 2, boxShadow: 4, fontWeight: 800 }}
        >
          {securityFeedback?.message}
        </Alert>
      </Snackbar>
      <Container maxWidth="sm">
        <Button
          component={Link}
          to="/dashboard"
          startIcon={<ArrowBackRounded />}
          sx={{ mb: 2 }}
        >
          Back to dashboard
        </Button>
        <SecurityForm
          status={{ ...status, enabled }}
          result={result}
          busy={busy}
        />
      </Container>
    </Box>
  );
}
