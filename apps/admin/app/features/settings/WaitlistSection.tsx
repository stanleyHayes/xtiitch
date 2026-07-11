import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AdminWaitlistLead } from "../shared/types";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { MetricCard } from "../../components/ui/MetricCard";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function WaitlistSection({
  leads,
  error,
  isLoading,
}: {
  leads: AdminWaitlistLead[];
  error: string | null;
  isLoading: boolean;
}) {
  const total = leads.length;
  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Marketing launch"
        title="Waitlist signups"
        helper="People who registered interest from the public marketing site, newest first."
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
          value={String(total)}
          helper="Leads captured so far"
          trend={total > 0 ? "Newest first" : "Awaiting first"}
        />
      </Box>

      {isLoading ? (
        <Panel sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={28} />
            <Skeleton variant="rounded" height={28} />
            <Skeleton variant="rounded" height={28} />
          </Stack>
        </Panel>
      ) : total === 0 && !error ? (
        <Panel sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={1}>
            <Typography variant="h6">No waitlist signups yet</Typography>
            <Typography sx={{ color: "text.secondary" }}>
              New signups from the marketing site will appear here as soon as
              people register interest.
            </Typography>
          </Stack>
        </Panel>
      ) : total > 0 ? (
        <Panel sx={{ p: 0, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 880 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Business</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} hover>
                    <TableCell sx={{ fontWeight: 800 }}>
                      {lead.name || "—"}
                    </TableCell>
                    <TableCell>{lead.business || "—"}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {lead.phone || "—"}
                    </TableCell>
                    <TableCell sx={{ overflowWrap: "anywhere" }}>
                      {lead.email || "—"}
                    </TableCell>
                    <TableCell>{lead.city || "—"}</TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 280,
                        overflowWrap: "anywhere",
                        color: lead.message ? "text.primary" : "text.secondary",
                      }}
                    >
                      {lead.message || "—"}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {lead.createdAt ? shortTime(lead.createdAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Panel>
      ) : null}
    </Stack>
  );
}
