import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import ManageAccountsRounded from "@mui/icons-material/ManageAccountsRounded";
import StorefrontRounded from "@mui/icons-material/StorefrontRounded";
import { AdminRecordPage } from "../../components/ui";
import type { AdminBusiness } from "../shared/types";
import { statusColor } from "../shared/colors";
import { BusinessAccountControlsDrawer } from "../businesses/BusinessAccountControlsDrawer";
import { BusinessActivitySafePanel } from "../businesses/BusinessActivitySafePanel";
import { BusinessOverviewPanel } from "../businesses/BusinessOverviewPanel";
import { DeleteBusinessDialog } from "../businesses/DeleteBusinessDialog";

export function BusinessInspector({
  business,
  onReviewPayments,
  onOpenAudit,
  onClose,
}: {
  business: AdminBusiness | null;
  onReviewPayments: () => void;
  onOpenAudit: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"overview" | "activity">("overview");
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setView("overview");
    setManageOpen(false);
    setDeleteOpen(false);
  }, [business?.id]);

  if (!business) return null;

  return (
    <AdminRecordPage
      eyebrow="Business record"
      title={business.name}
      helper={`${business.handle}.xtiitch.com · ${business.ownerName}`}
      status={business.status}
      statusColor={statusColor(business.status)}
      onBack={onClose}
      actions={
        <>
          <Button
            variant="outlined"
            startIcon={<StorefrontRounded />}
            href={`https://${business.handle}.xtiitch.com`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View store
          </Button>
          <Button
            variant="contained"
            startIcon={<ManageAccountsRounded />}
            onClick={() => setManageOpen(true)}
          >
            Manage
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Tabs
          value={view}
          onChange={(_, next) => setView(next)}
          sx={{ borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab value="overview" label="Overview" />
          <Tab value="activity" label="Activity" />
        </Tabs>
        {view === "activity" ? (
          <BusinessActivitySafePanel businessId={business.id} />
        ) : (
          <BusinessOverviewPanel
            business={business}
            onReviewPayments={onReviewPayments}
            onOpenAudit={onOpenAudit}
          />
        )}
      </Stack>
      <BusinessAccountControlsDrawer
        business={business}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onDelete={() => {
          setManageOpen(false);
          setDeleteOpen(true);
        }}
      />
      <DeleteBusinessDialog
        business={business}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </AdminRecordPage>
  );
}
