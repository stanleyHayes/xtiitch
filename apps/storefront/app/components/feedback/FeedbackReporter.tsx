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
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ContactSupportRounded from "@mui/icons-material/ContactSupportRounded";
import PrivacyTipRounded from "@mui/icons-material/PrivacyTipRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import ReportProblemRounded from "@mui/icons-material/ReportProblemRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import SupportAgentRounded from "@mui/icons-material/SupportAgentRounded";
import WhatsApp from "@mui/icons-material/WhatsApp";
import type { ReactNode } from "react";
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

// §4 Contact us channels. Emails open the mail client; WhatsApp uses the wa.me
// deep link (the Ghana number in international form, no leading zero).
type ContactChannel = {
  label: string;
  detail: string;
  href: string;
  icon: ReactNode;
};

const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: "Request support",
    detail: "support@xtiitch.com",
    href: "mailto:support@xtiitch.com?subject=Support%20request",
    icon: <SupportAgentRounded />,
  },
  {
    label: "Inquire about billing",
    detail: "billing@xtiitch.com",
    href: "mailto:billing@xtiitch.com?subject=Billing%20enquiry",
    icon: <ReceiptLongRounded />,
  },
  {
    label: "Inquire about privacy",
    detail: "privacy@xtiitch.com",
    href: "mailto:privacy@xtiitch.com?subject=Privacy%20request",
    icon: <PrivacyTipRounded />,
  },
  {
    label: "WhatsApp",
    detail: "0594667183",
    href: "https://wa.me/233594667183",
    icon: <WhatsApp />,
  },
];

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

type SupportView = "menu" | "report" | "contact";

// Auto-reports uncaught runtime errors and unhandled rejections. Kept as its
// own hook so FeedbackReporter's body stays small.
function useCrashReporting() {
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
}

export function FeedbackReporter() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SupportView>("menu");
  useCrashReporting();

  const closeSupport = () => {
    setOpen(false);
    window.setTimeout(() => setView("menu"), 200);
  };

  const title =
    view === "report"
      ? "Report an issue"
      : view === "contact"
        ? "Contact us"
        : "Support";

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="contained"
        startIcon={<ContactSupportRounded />}
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
        Support
      </Button>
      <Dialog open={open} onClose={closeSupport} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              {view !== "menu" ? (
                <IconButton
                  aria-label="Back"
                  size="small"
                  onClick={() => setView("menu")}
                >
                  <ArrowBackRounded />
                </IconButton>
              ) : null}
              <Box>
                <Typography variant="h6">{title}</Typography>
                {view === "report" ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    We’ll include this page, device context and store where
                    possible.
                  </Typography>
                ) : null}
              </Box>
            </Stack>
            <IconButton aria-label="Close support" onClick={closeSupport}>
              <CloseRounded />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {view === "menu" ? <SupportMenu onPick={setView} /> : null}
          {view === "contact" ? <ContactList /> : null}
          {view === "report" ? <ReportForm /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

// The landing menu: the two top-level Support choices.
function SupportMenu({ onPick }: { onPick: (view: SupportView) => void }) {
  return (
    <Stack spacing={1.25}>
      <SupportChoice
        icon={<ReportProblemRounded />}
        title="Report an issue"
        helper="Something wrong with a store, design, or order"
        onClick={() => onPick("report")}
      />
      <SupportChoice
        icon={<SupportAgentRounded />}
        title="Contact us"
        helper="Reach support, billing, privacy, or WhatsApp"
        onClick={() => onPick("contact")}
      />
    </Stack>
  );
}

// The Contact us channels — email (mailto) and WhatsApp (wa.me).
function ContactList() {
  return (
    <Stack spacing={1}>
      {CONTACT_CHANNELS.map((channel) => (
        <SupportChoice
          key={channel.label}
          icon={channel.icon}
          title={channel.label}
          helper={channel.detail}
          href={channel.href}
        />
      ))}
    </Stack>
  );
}

// The issue-report form, unchanged from before: reporter_type customer, surface
// storefront, with the shopper's contact reference carried alongside.
function ReportForm() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

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
  );
}

// One tappable row in the Support menu / contact list. Renders as a link when
// an href is given (email or WhatsApp), otherwise as a button that switches view.
function SupportChoice({
  icon,
  title,
  helper,
  onClick,
  href,
}: {
  icon: ReactNode;
  title: string;
  helper: string;
  onClick?: () => void;
  href?: string;
}) {
  return (
    <Button
      {...(href
        ? {
            component: "a",
            href,
            target: href.startsWith("http") ? "_blank" : undefined,
            rel: href.startsWith("http") ? "noopener noreferrer" : undefined,
          }
        : { onClick })}
      variant="outlined"
      startIcon={icon}
      fullWidth
      sx={{
        justifyContent: "flex-start",
        textAlign: "left",
        textTransform: "none",
        color: "text.primary",
        borderColor: "divider",
        px: 1.75,
        py: 1.25,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800 }} noWrap>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
          {helper}
        </Typography>
      </Box>
    </Button>
  );
}
