import { useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import EmailRounded from "@mui/icons-material/EmailRounded";
import PhoneRounded from "@mui/icons-material/PhoneRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TextField from "../../components/form-text-field";
import type { AdminWaitlistLead } from "../shared/types";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";

function leadInitials(lead: AdminWaitlistLead) {
  return (lead.name || lead.business || "Lead")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="overline" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

// eslint-disable-next-line max-lines-per-function -- lead inbox keeps search, selection, and responsive detail rendering together
export function WaitlistSection({
  leads,
  error,
  isLoading,
}: {
  leads: AdminWaitlistLead[];
  error: string | null;
  isLoading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<AdminWaitlistLead | null>(
    null,
  );
  const filteredLeads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return leads;
    return leads.filter((lead) =>
      [
        lead.name,
        lead.business,
        lead.phone,
        lead.email,
        lead.city,
        lead.message,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [leads, query]);

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Marketing launch"
        title="Waitlist signups"
        helper="A clean lead inbox for people who registered interest on the marketing site."
      />
      {error ? <Alert severity="warning">{error}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        }}
      >
        <MetricCard
          label="Total signups"
          value={String(leads.length)}
          helper="Leads captured so far"
          trend={leads.length ? "Newest first" : "Awaiting first"}
        />
        <MetricCard
          label="With email"
          value={String(leads.filter((lead) => lead.email).length)}
          helper="Ready for email follow-up"
          trend="Contactable"
        />
        <MetricCard
          label="With phone"
          value={String(leads.filter((lead) => lead.phone).length)}
          helper="Ready for a direct call"
          trend="Contactable"
        />
      </Box>

      <Panel sx={{ p: { xs: 1.5, md: 2 } }}>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, business, city, email, or phone"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <SearchRounded sx={{ mr: 1, color: "text.secondary" }} />
              ),
            },
          }}
        />
      </Panel>

      {isLoading ? (
        <Panel sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={116} />
            ))}
          </Stack>
        </Panel>
      ) : filteredLeads.length === 0 ? (
        <Panel sx={{ p: 3 }}>
          <Typography variant="h6">
            {leads.length ? "No matching leads" : "No waitlist signups yet"}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {leads.length
              ? "Try a different search."
              : "New marketing signups will appear here automatically."}
          </Typography>
        </Panel>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {filteredLeads.map((lead) => (
            <Panel key={lead.id} sx={{ p: { xs: 1.75, md: 2.25 } }}>
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "flex-start" }}
              >
                <Avatar sx={{ bgcolor: "primary.main", fontWeight: 900 }}>
                  {leadInitials(lead)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h6" noWrap>
                    {lead.name || "Unnamed lead"}
                  </Typography>
                  <Typography sx={{ color: "text.secondary" }} noWrap>
                    {lead.business || "No business supplied"}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ mt: 1, flexWrap: "wrap", gap: 0.75 }}
                  >
                    {lead.city ? (
                      <Chip size="small" label={lead.city} variant="outlined" />
                    ) : null}
                    <Chip
                      size="small"
                      label={
                        lead.createdAt
                          ? shortTime(lead.createdAt)
                          : "Unknown date"
                      }
                      variant="outlined"
                    />
                  </Stack>
                </Box>
                <Button
                  variant="outlined"
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => setSelectedLead(lead)}
                >
                  View
                </Button>
              </Stack>
            </Panel>
          ))}
        </Box>
      )}

      <Dialog
        open={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        fullWidth
        maxWidth="sm"
      >
        {selectedLead ? (
          <>
            <DialogTitle component="div">
              <Stack
                direction="row"
                spacing={1.5}
                sx={{ alignItems: "center" }}
              >
                <Avatar sx={{ bgcolor: "primary.main", fontWeight: 900 }}>
                  {leadInitials(selectedLead)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h5">
                    {selectedLead.name || "Unnamed lead"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {selectedLead.business || "No business supplied"}
                  </Typography>
                </Box>
                <IconButton
                  aria-label="Close waitlist lead"
                  onClick={() => setSelectedLead(null)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                }}
              >
                <DetailLine label="Phone" value={selectedLead.phone} />
                <DetailLine label="Email" value={selectedLead.email} />
                <DetailLine label="City" value={selectedLead.city} />
                <DetailLine
                  label="Submitted"
                  value={
                    selectedLead.createdAt
                      ? shortTime(selectedLead.createdAt)
                      : ""
                  }
                />
              </Box>
              <Divider sx={{ my: 2.5 }} />
              <DetailLine
                label="What they are interested in"
                value={selectedLead.message}
              />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              {selectedLead.email ? (
                <Button
                  component="a"
                  href={`mailto:${selectedLead.email}`}
                  startIcon={<EmailRounded />}
                >
                  Email lead
                </Button>
              ) : null}
              {selectedLead.phone ? (
                <Button
                  component="a"
                  href={`tel:${selectedLead.phone}`}
                  variant="contained"
                  startIcon={<PhoneRounded />}
                >
                  Call lead
                </Button>
              ) : null}
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Stack>
  );
}
