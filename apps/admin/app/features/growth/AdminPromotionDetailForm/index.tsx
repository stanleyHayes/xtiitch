import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import type { AdminBusiness, AdminPromotion } from "../../../lib/api";
import { PromotionSummary } from "./PromotionSummary";
import { PromotionEditForm } from "./PromotionEditForm";
import { PromotionArchiveForm } from "./PromotionArchiveForm";

export function AdminPromotionDetailForm({
  promotion,
  businesses,
}: {
  promotion: AdminPromotion;
  businesses: AdminBusiness[];
}) {
  const archived = promotion.status === "archived";

  return (
    <Stack spacing={2}>
      <PromotionSummary promotion={promotion} />
      {archived ? (
        <Alert severity="info">
          Archived promotions stay visible for reporting and cannot be edited.
        </Alert>
      ) : null}
      <PromotionEditForm promotion={promotion} businesses={businesses} />
      <PromotionArchiveForm promotion={promotion} />
    </Stack>
  );
}
