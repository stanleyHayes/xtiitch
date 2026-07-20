import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { RiskChip } from "../shared/RiskChip";
import { StatusChip } from "../shared/StatusChip";
import { BusinessActionsMenu } from "./BusinessActionsMenu";
import { DeleteBusinessDialog } from "./DeleteBusinessDialog";
import type { AdminBusiness } from "../../lib/api";



// BusinessTable is the scannable list view for the businesses section: one row per
// tenant with status/risk, money and last-active, plus an actions menu (inspect,
// suspend/reactivate). The card view keeps the richer BusinessRow tiles.
export function BusinessTable({
  businesses,
  selectedId,
  onInspect,
}: {
  businesses: AdminBusiness[];
  selectedId: string | null;
  onInspect: (business: AdminBusiness) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const menuBusiness = businesses.find((item) => item.id === menuId) ?? null;
  const businessToDelete =
    businesses.find((item) => item.id === deleteId) ?? null;
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuId(null);
  };

  return (
    <>
      {/* Panel hard-sets `overflow: hidden`; the override only wins when
          passed through Panel's own sx, so the table can scroll on phones. */}
      <Panel sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow>
              <TableCell>Business</TableCell>
              <TableCell align="right">GMV</TableCell>
              <TableCell align="right">Commission</TableCell>
              <TableCell>Last active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {businesses.map((business) => (
              <TableRow
                key={business.id}
                hover
                selected={selectedId === business.id}
                sx={{ cursor: "pointer" }}
                onClick={() => onInspect(business)}
              >
                <TableCell sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography sx={{ fontWeight: 800 }} noWrap>
                      {business.name}
                    </Typography>
                    <StatusChip status={business.status} />
                    <RiskChip level={business.riskLevel} />
                  </Stack>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                  >
                    {business.handle}.xtiitch.com · {business.ownerEmail}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatGHS(business.gmvMinor)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ fontWeight: 700 }}>
                    {formatGHS(business.commissionMinor)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {shortTime(business.lastActive)}
                  </Typography>
                </TableCell>
                <TableCell
                  align="right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <IconButton
                    size="small"
                    aria-label="Business actions"
                    onClick={(event) => {
                      setMenuAnchor(event.currentTarget);
                      setMenuId(business.id);
                    }}
                  >
                    <MoreVertRounded fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      <BusinessActionsMenu
        anchorEl={menuAnchor}
        business={menuBusiness}
        onClose={closeMenu}
        onInspect={onInspect}
        onDelete={(business) => setDeleteId(business.id)}
      />

      <DeleteBusinessDialog
        business={businessToDelete}
        open={Boolean(businessToDelete)}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
}
