import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import BugReportRounded from "@mui/icons-material/BugReportRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import { tokens } from "../../theme";

type FeedbackPayload = {
  reporter_type: "customer" | "system";
  surface: "storefront";
  kind: "feedback" | "crash";
  priority?: "normal" | "urgent";
  subject?: string;
  message?: string;
  contact?: string;
  store_handle?: string;
  page_url?: string;
  user_agent?: string;
  context?: Record<string, unknown>;
  stack?: string;
};

function inferStoreHandle(): string {
  const host = window.location.hostname;
  const first = host.split(".")[0] ?? "";
  if (
    first &&
    !["store", "www", "xtiitch", "localhost", "127"].includes(first)
  ) {
    return first;
  }
  const match = window.location.pathname.match(/^\/store\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function pageContext() {
  return {
    path: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    theme: document.documentElement.dataset.muiColorScheme ?? "",
  };
}

function sendFeedback(payload: FeedbackPayload) {
  return fetch("/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      store_handle: payload.store_handle ?? inferStoreHandle(),
      page_url: payload.page_url ?? window.location.href,
      user_agent: payload.user_agent ?? navigator.userAgent,
      context: { ...pageContext(), ...(payload.context ?? {}) },
    }),
    keepalive: payload.kind === "crash",
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown client error";
}

function errorStack(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error ?? "");
}

export function CrashReportEffect({ error }: { error?: unknown }) {
  const sent = useRef(false);
  useEffect(() => {
    if (!error || sent.current || typeof window === "undefined") return;
    sent.current = true;
    void sendFeedback({
      reporter_type: "system",
      surface: "storefront",
      kind: "crash",
      priority: "urgent",
      subject: "Storefront crash",
      message: errorMessage(error),
      stack: errorStack(error),
      context: { source: "react_error_boundary" },
    }).catch(() => undefined);
  }, [error]);
  return null;
}

export function FeedbackReporter() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  useEffect(() => {
    const report = (event: ErrorEvent | PromiseRejectionEvent) => {
      const reason =
        "reason" in event ? event.reason : event.error ?? event.message;
      void sendFeedback({
        reporter_type: "system",
        surface: "storefront",
        kind: "crash",
        priority: "urgent",
        subject: "Storefront runtime error",
        message: errorMessage(reason),
        stack: errorStack(reason),
        context: { source: event.type },
      }).catch(() => undefined);
    };
    window.addEventListener("error", report);
    window.addEventListener("unhandledrejection", report);
    return () => {
      window.removeEventListener("error", report);
      window.removeEventListener("unhandledrejection", report);
    };
  }, []);

  const submit = async () => {
    if (!message.trim()) return;
    setState("sending");
    try {
      const response = await sendFeedback({
        reporter_type: "customer",
        surface: "storefront",
        kind: "feedback",
        subject: "Storefront customer feedback",
        message,
        contact,
      });
      setState(response.ok ? "sent" : "error");
      if (response.ok) {
        setMessage("");
        setContact("");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="contained"
        startIcon={<BugReportRounded />}
        sx={{
          position: "fixed",
          right: { xs: 14, md: 22 },
          bottom: { xs: 82, md: 22 },
          zIndex: 2300,
          borderRadius: 999,
          boxShadow: `0 18px 42px rgba(128, 0, 32, 0.28)`,
          whiteSpace: "nowrap",
        }}
      >
        Report issue
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography variant="h6">Report an issue</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                We’ll include this page, device context and store where possible.
              </Typography>
            </Box>
            <IconButton aria-label="Close feedback" onClick={() => setOpen(false)}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {state === "sent" ? (
              <Alert severity="success">Thank you — Xtiitch support has it.</Alert>
            ) : null}
            {state === "error" ? (
              <Alert severity="error">Couldn’t send that yet. Please try again.</Alert>
            ) : null}
            <TextField
              label="What happened?"
              multiline
              minRows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us what you were trying to do and what went wrong."
              required
            />
            <TextField
              label="Contact or order reference (optional)"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Email, phone, WhatsApp, or order reference"
            />
            <Button
              onClick={submit}
              disabled={!message.trim() || state === "sending"}
              variant="contained"
              endIcon={<SendRounded />}
              sx={{ alignSelf: "flex-start", bgcolor: tokens.burgundy }}
            >
              {state === "sending" ? "Sending…" : "Send report"}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
