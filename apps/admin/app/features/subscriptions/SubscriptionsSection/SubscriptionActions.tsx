import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import SyncRounded from "@mui/icons-material/SyncRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import { tokens } from "../../../theme";
import { Panel } from "../../../components/ui/Panel";
import { BillingOperationCard } from "../../money/BillingOperationCard";

export function SubscriptionActions({
  overdueIssuedInvoiceCount,
  expiredGraceCount,
  recurringDueRows,
  recurringReadyRows,
  recurringBlockedCount,
}: {
  overdueIssuedInvoiceCount: number;
  expiredGraceCount: number;
  recurringDueRows: number;
  recurringReadyRows: number;
  recurringBlockedCount: number;
}) {
  return (
    <Panel
      sx={{
        p: { xs: 2, md: 2.5 },
        borderColor: alpha(tokens.success, 0.2),
        backgroundImage: `
          radial-gradient(circle at 96% 6%, ${alpha(tokens.success, 0.12)}, transparent 30%),
          linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
        `,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          sx={{
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">Billing operations</Typography>
            <Typography sx={{ color: "text.secondary", maxWidth: 760 }}>
              Run controlled billing jobs without moving funds until a charge
              or invoice action explicitly does it.
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ flexWrap: "wrap", justifyContent: { md: "flex-end" } }}
          >
            <Chip
              size="small"
              label={`${overdueIssuedInvoiceCount} overdue`}
              color={overdueIssuedInvoiceCount ? "warning" : "success"}
              variant={overdueIssuedInvoiceCount ? "filled" : "outlined"}
            />
            <Chip
              size="small"
              label={`${recurringReadyRows} ready`}
              color={recurringReadyRows ? "success" : "default"}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`${recurringBlockedCount} blocked`}
              color={recurringBlockedCount ? "warning" : "default"}
              variant="outlined"
            />
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gap: 1.25,
            gridTemplateColumns: {
              xs: "1fr",
              xl: "repeat(2, minmax(0, 1fr))",
            },
          }}
        >
          <BillingOperationCard
            icon={<SyncRounded />}
            title="Billing sweep"
            helper="Fail overdue invoices and cancel subscriptions whose grace window has expired."
            tone={
              overdueIssuedInvoiceCount || expiredGraceCount
                ? tokens.warning
                : tokens.success
            }
            chips={[
              `${overdueIssuedInvoiceCount} overdue invoices`,
              `${expiredGraceCount} expired grace`,
            ]}
            intent="admin-subscription-billing:sweep"
            noteLabel="Sweep note"
            noteDefault="Operator billing sweep"
            actionLabel="Run sweep"
            actionIcon={<SyncRounded />}
          />
          <BillingOperationCard
            icon={<CreditCardRounded />}
            title="Recurring charges"
            helper="Charge due recurring subscriptions through saved Paystack authorizations."
            tone={recurringBlockedCount ? tokens.warning : tokens.success}
            chips={[
              `${recurringDueRows} due`,
              `${recurringReadyRows} ready`,
              `${recurringBlockedCount} blocked`,
            ]}
            intent="admin-subscription-recurring:sweep"
            noteLabel="Charge note"
            noteDefault="Operator recurring charge sweep"
            actionLabel="Run charges"
            actionIcon={<CreditCardRounded />}
          />
        </Box>
      </Stack>
    </Panel>
  );
}
