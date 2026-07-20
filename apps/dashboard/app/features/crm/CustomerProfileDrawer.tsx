import { useEffect } from "react";
import { useFetcher } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import CallRounded from "@mui/icons-material/CallRounded";
import ChatRounded from "@mui/icons-material/ChatRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import StraightenRounded from "@mui/icons-material/StraightenRounded";
import { tokens } from "../../theme";
import { formatGHS } from "../../lib/format";
import { telHref, whatsAppHref } from "../../lib/phone";
import { shortDate, shortDateTime } from "../shared/utils";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import type { CrmCustomerProfile, CrmCustomerRow } from "./types";
import { CustomerNoteEditor, CustomerTagsEditor } from "./CustomerAnnotators";

// §15.1 customer profile — on EVERY plan: contact with tap-to-call tel: and
// WhatsApp wa.me links, the FULL order history with this store, and saved
// measurements. Notes (Starter+) and tags (Growth+) annotate on top. The full
// record loads through the crm-customer resource route (tenant-scoped by the
// API — a cross-tenant id simply 404s and the drawer shows its empty state).
export function CustomerProfileDrawer({
  customer,
  onClose,
  saveTick,
  error,
}: {
  customer: CrmCustomerRow | null;
  onClose: () => void;
  // Bumps after a note/tag save succeeds so the open profile refetches.
  saveTick: string;
  error?: string;
}) {
  const fetcher = useFetcher();
  const fetched = fetcher.data as CrmCustomerProfile | undefined;
  // Ignore a previous customer's profile while the new one loads — otherwise
  // the drawer flashes stale details on reopen.
  const profile =
    fetched && fetched.customer_id === customer?.customer_id
      ? fetched
      : undefined;
  const loading = customer !== null && !profile;

  useEffect(() => {
    if (customer) {
      fetcher.load(`/crm-customer/${encodeURIComponent(customer.customer_id)}`);
    }
    // load only when a different customer is opened.
  }, [customer?.customer_id]);

  useEffect(() => {
    if (saveTick && customer) {
      fetcher.load(`/crm-customer/${encodeURIComponent(customer.customer_id)}`);
    }
    // refetch only when a save lands.
  }, [saveTick]);

  return (
    <Drawer
      anchor="right"
      open={customer !== null}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: "100%", sm: 440 }, maxWidth: "100%" } },
      }}
    >
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <DrawerHead profile={profile} customer={customer} onClose={onClose} />
        <ContactActions profile={profile} customer={customer} />
        {loading ? (
          <Stack sx={{ py: 6, alignItems: "center" }}>
            <CircularProgress size={28} />
          </Stack>
        ) : !profile ? (
          <Box sx={{ mt: 2 }}>
            <InlineEmptyState
              icon={<CallRounded sx={{ fontSize: 38 }} />}
              title="Profile unavailable"
              helper="This customer's full record could not be loaded. Close and try again."
            />
          </Box>
        ) : (
          <DrawerBody profile={profile} error={error} />
        )}
      </Box>
    </Drawer>
  );
}

function DrawerHead({
  profile,
  customer,
  onClose,
}: {
  profile: CrmCustomerProfile | undefined;
  customer: CrmCustomerRow | null;
  onClose: () => void;
}) {
  const source = profile?.source ?? customer?.source;
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }} noWrap>
          {profile?.name || customer?.name || customer?.phone}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {source === "walk_in" ? "Walk-in customer" : "Online customer"}
          {profile?.first_order_at
            ? ` · since ${shortDate(profile.first_order_at)}`
            : ""}
        </Typography>
      </Box>
      <IconButton onClick={onClose} aria-label="Close customer profile">
        <CloseRounded />
      </IconButton>
    </Stack>
  );
}

// §15.1 "Call / WhatsApp the customer from their profile" — the contact
// buttons every plan gets.
function ContactActions({
  profile,
  customer,
}: {
  profile: CrmCustomerProfile | undefined;
  customer: CrmCustomerRow | null;
}) {
  const tel = telHref(profile?.phone ?? customer?.phone ?? "");
  const wa = whatsAppHref(profile?.whatsapp || profile?.phone || "");
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
      {tel ? (
        <Button
          component="a"
          href={tel}
          size="small"
          variant="contained"
          startIcon={<CallRounded />}
        >
          Call
        </Button>
      ) : null}
      {wa ? (
        <Button
          component="a"
          href={wa}
          target="_blank"
          rel="noreferrer"
          size="small"
          variant="outlined"
          startIcon={<ChatRounded />}
        >
          WhatsApp
        </Button>
      ) : null}
      {profile?.email ? (
        <Button
          component="a"
          href={`mailto:${profile.email}`}
          size="small"
          variant="outlined"
          startIcon={<EmailRounded />}
        >
          Email
        </Button>
      ) : null}
    </Stack>
  );
}

function DrawerBody({
  profile,
  error,
}: {
  profile: CrmCustomerProfile;
  error?: string;
}) {
  return (
    <Stack spacing={2.25} sx={{ mt: 2.5 }}>
      {profile.total_spend_minor !== null ? (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <ToneChip
            label={`${formatGHS(profile.total_spend_minor)} lifetime`}
            tone={tokens.success}
          />
          <ToneChip
            label={`${profile.orders_count ?? 0} orders`}
            tone={tokens.info}
          />
        </Stack>
      ) : (
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", fontStyle: "italic" }}
        >
          Lifetime spend &amp; order counts show on Starter and above.
        </Typography>
      )}
      <OrderHistoryBlock profile={profile} />
      <MeasurementsBlock profile={profile} />
      <Divider />
      {profile.crm_level >= 1 ? (
        <CustomerNoteEditor
          key={profile.note_updated_at ?? "none"}
          customerId={profile.customer_id}
          note={profile.note ?? ""}
          error={error}
        />
      ) : (
        <GatedAnnotation label="Notes" plan="Starter" />
      )}
      {profile.crm_level >= 2 ? (
        <CustomerTagsEditor
          key={(profile.tags ?? []).join("|")}
          customerId={profile.customer_id}
          tags={profile.tags ?? []}
          error={error}
        />
      ) : (
        <GatedAnnotation label="Tags" plan="Growth" />
      )}
    </Stack>
  );
}

// §15.1 "Customer profile — full order history" with this store (all plans).
function OrderHistoryBlock({ profile }: { profile: CrmCustomerProfile }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 900, mb: 1 }}>
        Order history with you
      </Typography>
      {profile.orders.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No orders on record.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {profile.orders.map((order) => (
            <Stack
              key={order.order_id}
              direction="row"
              spacing={1}
              sx={{
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                alignItems: "center",
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {order.agreed_total_minor !== null
                    ? formatGHS(order.agreed_total_minor)
                    : "Total pending"}
                  {order.settled_minor > 0
                    ? ` · ${formatGHS(order.settled_minor)} paid`
                    : ""}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {shortDateTime(order.created_at)}
                </Typography>
              </Box>
              <ToneChip
                label={order.status}
                tone={
                  order.status === "fulfilled"
                    ? tokens.success
                    : order.status === "cancelled"
                      ? tokens.mutedText
                      : tokens.info
                }
              />
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// §15.1 "Saved measurements on the profile" (all plans) — the same
// order_measurements rows the measurement module writes (§15.3 one record).
function MeasurementsBlock({ profile }: { profile: CrmCustomerProfile }) {
  return (
    <Box>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 1 }}>
        <StraightenRounded sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography sx={{ fontWeight: 900 }}>Saved measurements</Typography>
      </Stack>
      {profile.measurements.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          None saved yet — measurements captured on orders appear here.
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {profile.measurements.map((measurement) => (
            <Box
              key={measurement.measurement_id}
              sx={{
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
              }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {measurement.source} · {shortDate(measurement.created_at)}
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  display: "grid",
                  gap: 0.5,
                  gridTemplateColumns: "repeat(2, 1fr)",
                }}
              >
                {Object.entries(measurement.values).map(([label, value]) => (
                  <Typography key={label} variant="body2">
                    <Box component="span" sx={{ color: "text.secondary" }}>
                      {label}:{" "}
                    </Box>
                    <strong>{value}</strong>
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function GatedAnnotation({ label, plan }: { label: string; plan: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: "1px dashed",
        borderColor: (theme) => alpha(theme.palette.divider, 0.9),
        borderRadius: 2,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label} on a customer start on {plan}.{" "}
        <Button component="a" href="/onboarding/billing" size="small">
          Upgrade
        </Button>
      </Typography>
    </Box>
  );
}
