import { useSubmit } from "react-router";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import DeleteForeverRounded from "@mui/icons-material/DeleteForeverRounded";
import type { AdminBusiness } from "../../lib/api";



// The per-row actions for the businesses table, extracted so the table stays
// inside the size budget. Suspend/reactivate posts straight away; delete only
// opens the typed-confirmation dialog (§11.2) — it never submits from here.
export function BusinessActionsMenu({
  anchorEl,
  business,
  onClose,
  onInspect,
  onDelete,
}: {
  anchorEl: HTMLElement | null;
  business: AdminBusiness | null;
  onClose: () => void;
  onInspect: (business: AdminBusiness) => void;
  onDelete: (business: AdminBusiness) => void;
}) {
  const submit = useSubmit();

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      <MenuItem
        onClick={() => {
          if (business) {
            onInspect(business);
          }
          onClose();
        }}
      >
        Inspect
      </MenuItem>
      {business ? (
        <MenuItem
          onClick={() => {
            submit(
              {
                intent: "admin-business-status:update",
                business_id: business.id,
                operational_status:
                  business.operationalStatus === "suspended"
                    ? "active"
                    : "suspended",
                reason:
                  business.operationalStatus === "suspended"
                    ? "Reactivated from the businesses table."
                    : "Suspended from the businesses table.",
              },
              { method: "post" },
            );
            onClose();
          }}
        >
          {business.operationalStatus === "suspended"
            ? "Reactivate"
            : "Suspend"}
        </MenuItem>
      ) : null}
      {business ? (
        <MenuItem
          onClick={() => {
            onDelete(business);
            onClose();
          }}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteForeverRounded fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete business…</ListItemText>
        </MenuItem>
      ) : null}
    </Menu>
  );
}
