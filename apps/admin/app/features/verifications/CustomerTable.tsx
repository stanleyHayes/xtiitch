import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import { tokens } from "../../theme";
import { AdminCustomer } from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";



// CustomerTable is the scannable directory view: one row per customer with their
// activity, GMV and last-active; a row click (or Inspect) opens the detail drawer.
export function CustomerTable({
  customers,
  selectedId,
  onInspect,
}: {
  customers: AdminCustomer[];
  selectedId: string | null;
  onInspect: (customer: AdminCustomer) => void;
}) {
  return (
    // Panel hard-sets `overflow: hidden`; the override only wins when passed
    // through Panel's own sx, so the table can actually scroll on phones.
    <Panel sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell>Customer</TableCell>
            <TableCell>Activity</TableCell>
            <TableCell align="right">GMV</TableCell>
            <TableCell>Last active</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {customers.map((customer) => {
            const rowContact =
              customer.email || customer.phone || "No contact on file";
            return (
              <TableRow
                key={customer.id}
                hover
                selected={selectedId === customer.id}
                sx={{ cursor: "pointer" }}
                onClick={() => onInspect(customer)}
              >
                <TableCell sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{ alignItems: "center", minWidth: 0 }}
                  >
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: alpha(tokens.burgundy, 0.12),
                        color: tokens.burgundy,
                      }}
                    >
                      <PeopleAltRounded fontSize="small" />
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800 }} noWrap>
                        {customer.displayName || rowContact}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                        noWrap
                      >
                        {rowContact}
                      </Typography>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {customer.orderCount} orders · {customer.tenantCount}{" "}
                    businesses
                    {customer.customOrderCount > 0
                      ? ` · ${customer.customOrderCount} custom`
                      : ""}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatGHS(customer.gmvMinor)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {shortTime(customer.lastActive)}
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => onInspect(customer)}
                  >
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}
