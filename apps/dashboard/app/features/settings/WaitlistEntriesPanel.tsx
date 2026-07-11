import { Form } from "react-router";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import TextField from "../../components/form-text-field";
import { WaitlistEntry } from "../shared/types";
import { usePagedItems } from "../shared/hooks";
import { Panel } from "../../components/ui/Panel";
import { EmptyState } from "../../components/ui/EmptyState";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

export function WaitlistEntriesPanel({ entries }: { entries: WaitlistEntry[] }) {
  const {
    page: waitlistPage,
    pageCount: waitlistPageCount,
    pagedItems: pagedEntries,
    setPage: setWaitlistPage,
  } = usePagedItems(entries, 8, entries.length);
  const statuses = [
    { value: "waiting", label: "Waiting" },
    { value: "notified", label: "Notified" },
    { value: "closed", label: "Closed" },
  ];
  return (
    <Panel sx={{ p: { xs: 2, md: 2.5 }, mt: 2 }}>
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: "center", mb: 0.5 }}
      >
        <NotificationsRounded sx={{ color: "primary.main" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900 }}>Design waiting lists</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Customers who registered interest in a design from your storefront.
          </Typography>
        </Box>
      </Stack>
      {entries.length === 0 ? (
        <EmptyState
          icon={<NotificationsRounded sx={{ fontSize: 38 }} />}
          title="No waiting-list sign-ups yet"
          helper="When a customer joins a design's waiting list on your storefront, they appear here."
        />
      ) : (
        <Stack spacing={1.25} sx={{ mt: 1.5 }}>
          {pagedEntries.map((entry) => (
            <Box
              key={entry.entry_id}
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "rgba(var(--surface-rgb), 0.72)",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { sm: "center" },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }} noWrap>
                    {entry.customer_name}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary" }}
                    noWrap
                  >
                    {entry.customer_contact} ·{" "}
                    {entry.design_title || entry.design_handle}
                  </Typography>
                  {entry.note ? (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        display: "block",
                        mt: 0.25,
                      }}
                    >
                      “{entry.note}”
                    </Typography>
                  ) : null}
                </Box>
                <Form method="post">
                  <input
                    type="hidden"
                    name="intent"
                    value="update_waitlist_status"
                  />
                  <input type="hidden" name="entry_id" value={entry.entry_id} />
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center", flexShrink: 0 }}
                  >
                    <TextField
                      select
                      name="status"
                      size="small"
                      defaultValue={entry.status}
                      sx={{ minWidth: 130 }}
                    >
                      {statuses.map((status) => (
                        <MenuItem key={status.value} value={status.value}>
                          {status.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button type="submit" size="small" variant="outlined">
                      Update
                    </Button>
                  </Stack>
                </Form>
              </Stack>
            </Box>
          ))}
          <PaginationFooter
            count={waitlistPageCount}
            label="waitlist entries"
            page={waitlistPage}
            total={entries.length}
            onChange={setWaitlistPage}
          />
        </Stack>
      )}
    </Panel>
  );
}