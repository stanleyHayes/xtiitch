import { Form } from "react-router";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import CreditCardRounded from "@mui/icons-material/CreditCardRounded";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import WorkspacePremiumRounded from "@mui/icons-material/WorkspacePremiumRounded";
import { PLAN_BENEFITS } from "../../lib/api";
import TextField from "../../components/form-text-field";
import { tokens } from "../../theme";
import {
  AdminActionFeedback,
  Section,
  AdminSubscription,
  AdminPlan,
  AdminPlanEntitlementFeature,
  AdminSubscriptionDiscountCode,
  AdminPlatformMetrics,
} from "../shared/types";
import { formatGHS } from "../shared/formatting";
import { shortTime } from "../shared/dates";
import { Panel } from "../../components/ui/Panel";
import { usePagedItems } from "../shared/usePagedItems";
import { PaginationFooter } from "../../components/ui/PaginationFooter";
import { MetricCard } from "../../components/ui/MetricCard";
import {
  fallbackAdminPlans,
  grantedPlanBenefitKeys,
  planDesignLimitLabel,
  planMonthlyFeeDefault,
  planVisualFor,
  planYearlyFeeDefault,
  subscriptionDesignUsageLabel,
  subscriptionPlanFor,
} from "../plans/utils";
import { PlanBenefitsField } from "../plans/PlanBenefitsField";
import {
  billingModeLabel,
  invoiceStatusLabel,
  subscriptionBillingModeOptions,
  subscriptionStatusLabel,
  subscriptionStatusOptions,
} from "./utils";
import { subscriptionStatusColor } from "../shared/colors";
import { FormGroupLabel } from "../shared/FormGroupLabel";
import { StyledDateTimeField } from "../shared/StyledDateTimeField";
import { BillingOperationCard } from "../money/BillingOperationCard";
import { PlanStatTile } from "../plans/PlanStatTile";
import { SubscriptionDiscountCodesPanel } from "./SubscriptionDiscountCodesPanel";
import { PlanEntitlementMatrixPanel } from "../plans/PlanEntitlementMatrixPanel";
import { SubscriberCrmPanel } from "./SubscriberCrmPanel";
import { SectionHeader } from "../../components/ui/SectionHeader";



export function SubscriptionsSection({
  subscriptions,
  subscriptionsError,
  plans,
  plansError,
  planEntitlements,
  planEntitlementsError,
  subscriptionDiscountCodes,
  subscriptionDiscountCodesError,
  platformMetrics,
  actionData,
  onSelect,
}: {
  subscriptions: AdminSubscription[];
  subscriptionsError: string | null;
  plans: AdminPlan[];
  plansError: string | null;
  planEntitlements: AdminPlanEntitlementFeature[];
  planEntitlementsError: string | null;
  subscriptionDiscountCodes: AdminSubscriptionDiscountCode[];
  subscriptionDiscountCodesError: string | null;
  platformMetrics: AdminPlatformMetrics | null;
  actionData?: AdminActionFeedback;
  onSelect: (section: Section) => void;
}) {
  const [manageBusinessId, setManageBusinessId] = useState<string | null>(null);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [planDialogId, setPlanDialogId] = useState<string | null>(null);
  const [createDiscountOpen, setCreateDiscountOpen] = useState(false);
  const [discountDialogId, setDiscountDialogId] = useState<string | null>(null);
  const [subscriberQuery, setSubscriberQuery] = useState("");
  const [subscriberPlanFilter, setSubscriberPlanFilter] = useState("all");
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState("all");
  const [subscriberInstitutionFilter, setSubscriberInstitutionFilter] =
    useState("all");
  const [subscriberCadenceFilter, setSubscriberCadenceFilter] = useState("all");
  const billableSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.monthlyFeeMinor > 0 && subscription.status !== "canceled",
  );
  const visiblePlans = plans.length > 0 ? plans : fallbackAdminPlans();
  const planRows = visiblePlans.map((plan) => {
    const rows = subscriptions.filter((subscription) => {
      const planText = `${subscription.planCode} ${subscription.planName}`;
      const subscriptionCode = subscription.planCode.trim().toLowerCase();
      const subscriptionName = subscription.planName.trim().toLowerCase();
      return (
        subscriptionCode === plan.code ||
        subscriptionName === plan.name.trim().toLowerCase() ||
        subscriptionPlanFor(planText).code === plan.code
      );
    });
    const active = rows.filter(
      (subscription) => subscription.status !== "canceled",
    );
    const gmvMinor = rows.reduce(
      (total, subscription) => total + subscription.gmvMinor,
      0,
    );
    const commissionMinor = rows.reduce(
      (total, subscription) => total + subscription.commissionMinor,
      0,
    );
    const visual = planVisualFor(plan.code);
    return {
      plan,
      visual,
      subscriptions: rows,
      active,
      gmvMinor,
      commissionMinor,
      businessTotal: plans.length > 0 ? plan.businessCount : rows.length,
      activeTotal:
        plans.length > 0 ? plan.activeSubscriptionCount : active.length,
      estimatedMrrMinor:
        plans.length > 0
          ? plan.estimatedMrrMinor
          : active.reduce(
              (total, subscription) => total + subscription.monthlyFeeMinor,
              0,
            ),
    };
  });
  const estimatedMrrMinor = planRows.reduce(
    (total, row) => total + row.estimatedMrrMinor,
    0,
  );
  const freeUpgradeCandidates = subscriptions.filter((subscription) => {
    const plan = subscriptionPlanFor(
      `${subscription.planCode} ${subscription.planName}`,
    );
    return (
      plan.code === "free" &&
      subscription.status !== "canceled" &&
      subscription.gmvMinor >= 50000
    );
  });
  const overDesignLimitRows = subscriptions.filter(
    (subscription) =>
      typeof subscription.designLimit === "number" &&
      subscription.designCount > subscription.designLimit,
  );
  const attentionRows = subscriptions.filter(
    (subscription) =>
      subscription.status === "past_due" ||
      subscription.status === "grace_period" ||
      subscription.status === "cancel_at_period_end" ||
      (typeof subscription.designLimit === "number" &&
        subscription.designCount > subscription.designLimit) ||
      (subscription.monthlyFeeMinor > 0 &&
        subscription.billingMode !== "recurring") ||
      (subscription.planCode === "free" && subscription.gmvMinor >= 50000),
  );
  const lifecycleRows = attentionRows.length ? attentionRows : subscriptions;
  const {
    page: planPage,
    pageCount: planPageCount,
    pagedItems: pagedPlans,
    setPage: setPlanPage,
  } = usePagedItems(plans, 4, plans.length);
  const {
    page: planRowPage,
    pageCount: planRowPageCount,
    pagedItems: pagedPlanRows,
    setPage: setPlanRowPage,
  } = usePagedItems(planRows, 8, visiblePlans.length);
  const {
    page: lifecyclePage,
    pageCount: lifecyclePageCount,
    pagedItems: pagedLifecycleRows,
    setPage: setLifecyclePage,
  } = usePagedItems(
    lifecycleRows,
    4,
    `${attentionRows.length}:${subscriptions.length}`,
  );
  const recentEvents = subscriptions
    .flatMap((subscription) =>
      subscription.events.map((event) => ({
        ...event,
        businessName: subscription.businessName,
      })),
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 6);
  const pastDueCount = subscriptions.filter(
    (subscription) =>
      subscription.status === "past_due" ||
      subscription.status === "grace_period",
  ).length;
  const nowMs = Date.now();
  const overdueIssuedInvoiceCount = subscriptions.reduce(
    (total, subscription) =>
      total +
      subscription.invoices.filter(
        (invoice) =>
          invoice.status === "issued" &&
          new Date(invoice.dueAt).getTime() <= nowMs,
      ).length,
    0,
  );
  const expiredGraceCount = subscriptions.filter(
    (subscription) =>
      subscription.status === "grace_period" &&
      subscription.graceEndsAt &&
      new Date(subscription.graceEndsAt).getTime() <= nowMs,
  ).length;
  const recurringDueRows = subscriptions.filter((subscription) => {
    if (
      subscription.monthlyFeeMinor <= 0 ||
      subscription.billingMode !== "recurring" ||
      subscription.status === "canceled" ||
      subscription.status === "cancel_at_period_end" ||
      !subscription.nextBillingAt ||
      new Date(subscription.nextBillingAt).getTime() > nowMs
    ) {
      return false;
    }
    return !subscription.invoices.some(
      (invoice) => invoice.status === "issued",
    );
  });
  const recurringReadyRows = recurringDueRows.filter(
    (subscription) =>
      subscription.ownerEmail.trim() !== "" &&
      subscription.providerSubscriptionRef.trim() !== "",
  );
  const recurringBlockedCount =
    recurringDueRows.length - recurringReadyRows.length;
  const subscriberInstitutionOptions = Array.from(
    new Set(
      subscriptions
        .map((subscription) => subscription.discountInstitution.trim())
        .filter(Boolean),
    ),
  );
  const filteredSubscriberRows = subscriptions.filter((subscription) => {
    const query = subscriberQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        subscription.businessName,
        subscription.ownerName,
        subscription.ownerEmail,
        subscription.ownerPhone,
        subscription.ownerWhatsApp,
        subscription.handle,
        subscription.discountCode,
        subscription.discountInstitution,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    const matchesPlan =
      subscriberPlanFilter === "all" ||
      subscription.planCode === subscriberPlanFilter;
    const matchesStatus =
      subscriberStatusFilter === "all" ||
      subscription.status === subscriberStatusFilter;
    const matchesInstitution =
      subscriberInstitutionFilter === "all" ||
      subscription.discountInstitution === subscriberInstitutionFilter;
    const matchesCadence =
      subscriberCadenceFilter === "all" ||
      subscription.billingMode === subscriberCadenceFilter;
    return (
      matchesQuery &&
      matchesPlan &&
      matchesStatus &&
      matchesInstitution &&
      matchesCadence
    );
  });
  const {
    page: subscriberPage,
    pageCount: subscriberPageCount,
    pagedItems: pagedSubscriberRows,
    setPage: setSubscriberPage,
  } = usePagedItems(
    filteredSubscriberRows,
    8,
    `${subscriberQuery}:${subscriberPlanFilter}:${subscriberStatusFilter}:${subscriberInstitutionFilter}:${subscriberCadenceFilter}`,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Plan billing"
        title="Subscriptions"
        helper="Lifecycle state, billing mode, grace periods, cancellations, and event history for business packages."
      />

      {actionData?.section === "subscriptions" && actionData.message ? (
        <Alert severity={actionData.severity ?? "success"}>
          <Stack spacing={0.75}>
            <span>{actionData.message}</span>
            {actionData.detail ? (
              <Typography variant="body2" sx={{ color: "inherit" }}>
                {actionData.detail}
              </Typography>
            ) : null}
            {actionData.href ? (
              <Button
                component="a"
                href={actionData.href}
                target="_blank"
                rel="noreferrer"
                size="small"
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                sx={{ alignSelf: "flex-start" }}
              >
                {actionData.hrefLabel ?? "Open link"}
              </Button>
            ) : null}
          </Stack>
        </Alert>
      ) : null}
      {subscriptionsError ? (
        <Alert severity="warning">{subscriptionsError}</Alert>
      ) : null}
      {!subscriptionsError && subscriptions.length === 0 ? (
        <Alert severity="info">
          No subscription records are available yet.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <MetricCard
          label="Estimated base MRR"
          value={formatGHS(estimatedMrrMinor)}
          helper="From active paid package rows"
          trend={`${billableSubscriptions.length} billable`}
        />
        <MetricCard
          label="Commission revenue"
          value={formatGHS(platformMetrics?.platformRevenueMonthMinor ?? 0)}
          helper="Current month money-rail commission"
          trend="Live"
        />
        <MetricCard
          label="Lifecycle attention"
          value={String(attentionRows.length)}
          helper="Past due, grace, package limits, billing, and upgrades"
          trend={pastDueCount ? `${pastDueCount} due` : "Clear"}
        />
        <MetricCard
          label="Over design limit"
          value={String(overDesignLimitRows.length)}
          helper="Active designs above package cap"
          trend={overDesignLimitRows.length ? "Review" : "Clear"}
        />
        <MetricCard
          label="Free upgrade candidates"
          value={String(freeUpgradeCandidates.length)}
          helper="Free stores above GHS 500 GMV"
          trend="Review"
        />
      </Box>

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
                label={`${recurringReadyRows.length} ready`}
                color={recurringReadyRows.length ? "success" : "default"}
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
                `${recurringDueRows.length} due`,
                `${recurringReadyRows.length} ready`,
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

      <SubscriptionDiscountCodesPanel
        discountCodes={subscriptionDiscountCodes}
        discountCodesError={subscriptionDiscountCodesError}
        plans={visiblePlans}
        createOpen={createDiscountOpen}
        selectedDiscountId={discountDialogId}
        onCreateOpenChange={setCreateDiscountOpen}
        onSelectDiscount={setDiscountDialogId}
      />

      <Stack spacing={1}>
        <Typography variant="h6">Package controls</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Define the packages businesses can be assigned to. Archive old
          packages instead of deleting them so existing businesses keep their
          history.
        </Typography>
      </Stack>
      {plansError ? <Alert severity="warning">{plansError}</Alert> : null}
      {!plansError ? (
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Add a package</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Create a new billing tier only when you need one.
              </Typography>
            </Box>
            <Button
              type="button"
              variant="contained"
              startIcon={<WorkspacePremiumRounded />}
              onClick={() => setCreatePlanOpen(true)}
              sx={{ alignSelf: { xs: "stretch", md: "center" } }}
            >
              New package
            </Button>
          </Stack>
          <Dialog
            open={createPlanOpen}
            onClose={() => setCreatePlanOpen(false)}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle sx={{ pb: 0.5 }}>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    component="span"
                    sx={{ display: "block", fontWeight: 950 }}
                  >
                    Create package
                  </Typography>
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ display: "block", color: "text.secondary" }}
                  >
                    Add a package definition for future business assignments.
                  </Typography>
                </Box>
                <IconButton
                  aria-label="Close"
                  onClick={() => setCreatePlanOpen(false)}
                >
                  <CloseRounded />
                </IconButton>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Form method="post">
                <input type="hidden" name="intent" value="admin-plan:create" />
                <Stack spacing={2}>
                  <Box>
                    <FormGroupLabel>Identity</FormGroupLabel>
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                        },
                      }}
                    >
                      <TextField
                        label="Code"
                        name="code"
                        placeholder="pro-plus"
                        size="small"
                        required
                      />
                      <TextField
                        label="Name"
                        name="name"
                        placeholder="Pro Plus"
                        size="small"
                        required
                      />
                    </Box>
                  </Box>
                  <Box>
                    <FormGroupLabel>Pricing & limits</FormGroupLabel>
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.25,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "repeat(2, minmax(0, 1fr))",
                          md: "repeat(4, minmax(0, 1fr))",
                        },
                      }}
                    >
                      <TextField
                        label="Monthly fee"
                        name="monthly_fee_ghs"
                        type="number"
                        size="small"
                        defaultValue="0.00"
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                GHS
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { min: 0, step: "0.01" },
                        }}
                      />
                      <TextField
                        label="Yearly fee"
                        name="yearly_fee_ghs"
                        type="number"
                        size="small"
                        defaultValue="0.00"
                        helperText="Used when a business pays for a year upfront."
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                GHS
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { min: 0, step: "0.01" },
                        }}
                      />
                      <TextField
                        label="Commission"
                        name="commission_bps"
                        type="number"
                        size="small"
                        defaultValue="100"
                        slotProps={{
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                bps
                              </InputAdornment>
                            ),
                          },
                          htmlInput: { min: 0, max: 10000, step: 1 },
                        }}
                      />
                      <TextField
                        label="Design limit"
                        name="design_limit"
                        type="number"
                        size="small"
                        placeholder="Unlimited"
                        slotProps={{ htmlInput: { min: 0, step: 1 } }}
                      />
                    </Box>
                  </Box>
                  <PlanBenefitsField />
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ justifyContent: "flex-end" }}
                  >
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={() => setCreatePlanOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<WorkspacePremiumRounded />}
                    >
                      Create package
                    </Button>
                  </Stack>
                </Stack>
              </Form>
            </DialogContent>
          </Dialog>
        </Panel>
      ) : null}
      {!plansError && plans.length === 0 ? (
        <Alert severity="info">
          No editable plan packages are available yet; showing the default
          package model below.
        </Alert>
      ) : null}
      {!plansError && plans.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {pagedPlans.map((plan) => {
            const visual = planVisualFor(plan.code);
            return (
              <Panel
                key={plan.planId}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  borderColor: alpha(visual.tone, plan.isActive ? 0.2 : 0.12),
                  backgroundImage: `linear-gradient(180deg, ${alpha(
                    visual.tone,
                    plan.isActive ? 0.075 : 0.035,
                  )}, transparent 42%)`,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" noWrap>
                        {plan.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {plan.businessCount} businesses ·{" "}
                        {plan.activeSubscriptionCount} active subscriptions
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={plan.isActive ? "Active" : "Archived"}
                      color={plan.isActive ? "success" : "default"}
                      variant={plan.isActive ? "filled" : "outlined"}
                    />
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.25,
                      gridTemplateColumns: {
                        xs: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(5, minmax(0, 1fr))",
                      },
                    }}
                  >
                    <PlanStatTile
                      label="Monthly fee"
                      value={formatGHS(plan.monthlyFeeMinor)}
                    />
                    <PlanStatTile
                      label="Yearly fee"
                      value={formatGHS(plan.yearlyFeeMinor)}
                    />
                    <PlanStatTile
                      label="Commission"
                      value={`${plan.commissionBps / 100}%`}
                    />
                    <PlanStatTile
                      label="Design limit"
                      value={planDesignLimitLabel(plan)}
                    />
                    <PlanStatTile
                      label="Monthly recurring"
                      value={formatGHS(plan.estimatedMrrMinor)}
                    />
                  </Box>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: "uppercase",
                        color: "text.secondary",
                        mb: 0.75,
                      }}
                    >
                      Benefits
                    </Typography>
                    {grantedPlanBenefitKeys(plan.features).length > 0 ? (
                      <Stack
                        direction="row"
                        sx={{ flexWrap: "wrap", gap: 0.75 }}
                      >
                        {PLAN_BENEFITS.filter(
                          (benefit) => plan.features[benefit.key],
                        ).map((benefit) => (
                          <Chip
                            key={benefit.key}
                            size="small"
                            label={benefit.label}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        No storefront-customization benefits.
                      </Typography>
                    )}
                  </Box>
                  <Button
                    type="button"
                    variant="outlined"
                    startIcon={<SettingsRounded />}
                    onClick={() => setPlanDialogId(plan.planId)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Edit package
                  </Button>
                  <Dialog
                    open={planDialogId === plan.planId}
                    onClose={() => setPlanDialogId(null)}
                    fullWidth
                    maxWidth="md"
                  >
                    <DialogTitle sx={{ pb: 0.5 }}>
                      <Stack
                        direction="row"
                        spacing={1.25}
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            component="span"
                            sx={{ display: "block", fontWeight: 950 }}
                          >
                            Edit {plan.name}
                          </Typography>
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{ display: "block", color: "text.secondary" }}
                          >
                            Update package pricing, limits, and availability.
                          </Typography>
                        </Box>
                        <IconButton
                          aria-label="Close"
                          onClick={() => setPlanDialogId(null)}
                        >
                          <CloseRounded />
                        </IconButton>
                      </Stack>
                    </DialogTitle>
                    <DialogContent dividers>
                      <Stack spacing={2.25}>
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="admin-plan:update"
                          />
                          <input
                            type="hidden"
                            name="plan_id"
                            value={plan.planId}
                          />
                          <Stack spacing={2}>
                            <Box>
                              <FormGroupLabel>Package details</FormGroupLabel>
                              <Box
                                sx={{
                                  display: "grid",
                                  gap: 1.25,
                                  gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                  },
                                }}
                              >
                                <TextField
                                  label="Name"
                                  name="name"
                                  size="small"
                                  defaultValue={plan.name}
                                  required
                                />
                                <TextField
                                  label="Code"
                                  size="small"
                                  defaultValue={plan.code}
                                  disabled
                                />
                              </Box>
                            </Box>
                            <Box>
                              <FormGroupLabel>Pricing & limits</FormGroupLabel>
                              <Box
                                sx={{
                                  display: "grid",
                                  gap: 1.25,
                                  gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    lg: "repeat(5, minmax(0, 1fr))",
                                  },
                                }}
                              >
                                <TextField
                                  label="Monthly fee"
                                  name="monthly_fee_ghs"
                                  type="number"
                                  size="small"
                                  defaultValue={planMonthlyFeeDefault(plan)}
                                  slotProps={{
                                    input: {
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          GHS
                                        </InputAdornment>
                                      ),
                                    },
                                    htmlInput: { min: 0, step: "0.01" },
                                  }}
                                />
                                <TextField
                                  label="Yearly fee"
                                  name="yearly_fee_ghs"
                                  type="number"
                                  size="small"
                                  defaultValue={planYearlyFeeDefault(plan)}
                                  helperText="Upfront annual price"
                                  slotProps={{
                                    input: {
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          GHS
                                        </InputAdornment>
                                      ),
                                    },
                                    htmlInput: { min: 0, step: "0.01" },
                                  }}
                                />
                                <TextField
                                  label="Commission"
                                  name="commission_bps"
                                  type="number"
                                  size="small"
                                  defaultValue={plan.commissionBps}
                                  slotProps={{
                                    input: {
                                      endAdornment: (
                                        <InputAdornment position="end">
                                          bps
                                        </InputAdornment>
                                      ),
                                    },
                                    htmlInput: { min: 0, max: 10000, step: 1 },
                                  }}
                                />
                                <TextField
                                  label="Design limit"
                                  name="design_limit"
                                  type="number"
                                  size="small"
                                  defaultValue={plan.designLimit ?? ""}
                                  placeholder="Unlimited"
                                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                                />
                                <TextField
                                  select
                                  label="Status"
                                  name="is_active"
                                  size="small"
                                  defaultValue={String(plan.isActive)}
                                >
                                  <MenuItem value="true">Active</MenuItem>
                                  <MenuItem value="false">Archived</MenuItem>
                                </TextField>
                              </Box>
                            </Box>
                            <PlanBenefitsField
                              selected={grantedPlanBenefitKeys(plan.features)}
                            />
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ justifyContent: "flex-end" }}
                            >
                              <Button
                                type="button"
                                variant="outlined"
                                onClick={() => setPlanDialogId(null)}
                              >
                                Cancel
                              </Button>
                              <Button type="submit" variant="contained">
                                Save package
                              </Button>
                            </Stack>
                          </Stack>
                        </Form>
                        <Divider />
                        <Form method="post">
                          <input
                            type="hidden"
                            name="intent"
                            value="admin-plan:archive"
                          />
                          <input
                            type="hidden"
                            name="plan_id"
                            value={plan.planId}
                          />
                          <Stack spacing={1.25}>
                            <FormGroupLabel>Archive package</FormGroupLabel>
                            <TextField
                              label="Archive reason"
                              name="reason"
                              size="small"
                              placeholder="Replaced by new package"
                              fullWidth
                              disabled={!plan.isActive}
                            />
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              sx={{ justifyContent: "flex-end" }}
                            >
                              <Button
                                type="submit"
                                variant="outlined"
                                color="warning"
                                disabled={!plan.isActive}
                              >
                                Archive package
                              </Button>
                            </Stack>
                          </Stack>
                        </Form>
                      </Stack>
                    </DialogContent>
                  </Dialog>
                </Stack>
              </Panel>
            );
          })}
        </Box>
      ) : null}
      {!plansError && plans.length > 0 ? (
        <PaginationFooter
          count={planPageCount}
          label="packages"
          page={planPage}
          pageSize={4}
          total={plans.length}
          onChange={setPlanPage}
        />
      ) : null}

      <Stack spacing={1} sx={{ mt: 1 }}>
        <Typography variant="h6">Revenue by package</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Subscribers, GMV and commission earned per package — the editable
          definitions and recurring fees are in the cards above.
        </Typography>
      </Stack>
      <Panel sx={{ p: 0, overflow: "hidden" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))",
            gap: 1,
            px: { xs: 1.5, md: 2 },
            py: 1.25,
            bgcolor: "rgba(var(--surface-rgb), 0.5)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {["Package", "Businesses", "GMV", "Commission earned"].map(
            (headLabel, index) => (
              <Typography
                key={headLabel}
                variant="caption"
                sx={{
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  color: "text.secondary",
                  textAlign: index === 0 ? "left" : "right",
                }}
              >
                {headLabel}
              </Typography>
            ),
          )}
        </Box>
        {pagedPlanRows.map((row) => (
          <Box
            key={row.plan.code}
            sx={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.5fr) repeat(3, minmax(0, 1fr))",
              gap: 1,
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              alignItems: "center",
              borderBottom: "1px solid",
              borderColor: "divider",
              opacity: row.plan.isActive ? 1 : 0.6,
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>
                {row.plan.name}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {row.plan.monthlyFeeMinor > 0
                  ? formatGHS(row.plan.monthlyFeeMinor)
                  : "Free"}{" "}
                monthly · {formatGHS(row.plan.yearlyFeeMinor)} yearly ·{" "}
                {row.plan.commissionBps / 100}% commission
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, textAlign: "right" }}>
              {row.activeTotal}
              <Typography
                component="span"
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                {" "}
                / {row.businessTotal}
              </Typography>
            </Typography>
            <Typography sx={{ fontWeight: 800, textAlign: "right" }}>
              {formatGHS(row.gmvMinor)}
            </Typography>
            <Typography sx={{ fontWeight: 800, textAlign: "right" }}>
              {formatGHS(row.commissionMinor)}
            </Typography>
          </Box>
        ))}
      </Panel>
      <PaginationFooter
        count={planRowPageCount}
        label="package revenue rows"
        page={planRowPage}
        pageSize={8}
        total={planRows.length}
        onChange={setPlanRowPage}
      />

      <PlanEntitlementMatrixPanel
        features={planEntitlements}
        featuresError={planEntitlementsError}
        plans={plans}
      />

      <SubscriberCrmPanel
        subscriptions={subscriptions}
        filteredSubscriptions={filteredSubscriberRows}
        pagedSubscriptions={pagedSubscriberRows}
        query={subscriberQuery}
        planFilter={subscriberPlanFilter}
        statusFilter={subscriberStatusFilter}
        institutionFilter={subscriberInstitutionFilter}
        billingModeFilter={subscriberCadenceFilter}
        plans={visiblePlans}
        institutionOptions={subscriberInstitutionOptions}
        page={subscriberPage}
        pageCount={subscriberPageCount}
        onQueryChange={setSubscriberQuery}
        onPlanFilterChange={setSubscriberPlanFilter}
        onStatusFilterChange={setSubscriberStatusFilter}
        onInstitutionFilterChange={setSubscriberInstitutionFilter}
        onBillingModeFilterChange={setSubscriberCadenceFilter}
        onPageChange={setSubscriberPage}
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 340px" },
          alignItems: "start",
        }}
      >
        <Panel sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{ justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="h6">Lifecycle queue</Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  Review billing state, mode, next collection, and operator
                  notes.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                endIcon={<ArrowForwardRounded />}
                onClick={() => onSelect("businesses")}
                sx={{ whiteSpace: "nowrap" }}
              >
                Open businesses
              </Button>
            </Stack>
            {attentionRows.length === 0 && subscriptions.length > 0 ? (
              <Alert severity="info">
                No subscription lifecycle rows need attention right now; showing
                active records.
              </Alert>
            ) : null}
            {subscriptions.length === 0 ? (
              <Alert severity="info">
                No subscriptions are ready to manage yet.
              </Alert>
            ) : null}
            {pagedLifecycleRows.map((subscription) => {
              const color = subscriptionStatusColor(subscription.status);
              const openInvoice = subscription.invoices.find(
                (invoice) => invoice.status === "issued",
              );
              const latestInvoice = subscription.invoices[0];
              const canIssueInvoice =
                subscription.monthlyFeeMinor > 0 &&
                subscription.status !== "canceled" &&
                !openInvoice;
              const canCaptureAuthorization =
                subscription.monthlyFeeMinor > 0 &&
                subscription.status !== "canceled";
              return (
                <Box
                  key={subscription.businessId}
                  sx={{
                    p: { xs: 1.5, md: 2 },
                    border: "1px solid",
                    borderColor: alpha(color, 0.18),
                    borderRadius: 2,
                    bgcolor: "rgba(var(--surface-rgb), 0.82)",
                    backgroundImage: `
                      linear-gradient(90deg, ${alpha(color, 0.08)}, transparent 34%),
                      linear-gradient(180deg, rgba(var(--surface-rgb), 0.96), rgba(var(--surface-rgb), 0.62))
                    `,
                    boxShadow: `0 16px 40px ${alpha(tokens.ink, 0.045)}`,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    sx={{
                      alignItems: { sm: "flex-start" },
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography sx={{ fontWeight: 900 }}>
                          {subscription.businessName}
                        </Typography>
                        <Chip
                          size="small"
                          label={subscription.planName}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={subscriptionStatusLabel(subscription.status)}
                          sx={{
                            bgcolor: alpha(color, 0.11),
                            color,
                            textTransform: "capitalize",
                          }}
                        />
                        {typeof subscription.designLimit === "number" &&
                        subscription.designCount > subscription.designLimit ? (
                          <Chip
                            size="small"
                            label="Over limit"
                            color="warning"
                            variant="outlined"
                          />
                        ) : null}
                      </Stack>
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.65, color: "text.secondary" }}
                      >
                        {subscription.handle}.xtiitch.com ·{" "}
                        {formatGHS(subscription.gmvMinor)} GMV ·{" "}
                        {formatGHS(subscription.monthlyFeeMinor)} monthly fee
                      </Typography>
                      <Typography sx={{ mt: 0.75 }}>
                        {billingModeLabel(subscription.billingMode)} billing ·{" "}
                        {subscription.nextBillingAt
                          ? `Next billing ${shortTime(subscription.nextBillingAt)}`
                          : "No scheduled billing date"}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.55,
                          color:
                            typeof subscription.designLimit === "number" &&
                            subscription.designCount > subscription.designLimit
                              ? tokens.warning
                              : "text.secondary",
                        }}
                      >
                        {subscriptionDesignUsageLabel(subscription)}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<SettingsRounded />}
                      onClick={() =>
                        setManageBusinessId(subscription.businessId)
                      }
                      sx={{
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        alignSelf: { xs: "stretch", sm: "flex-start" },
                      }}
                    >
                      Manage billing
                    </Button>
                  </Stack>
                  <Dialog
                    open={manageBusinessId === subscription.businessId}
                    onClose={() => setManageBusinessId(null)}
                    fullWidth
                    maxWidth="md"
                  >
                    <DialogTitle sx={{ pb: 0.5 }}>
                      <Typography
                        component="span"
                        sx={{ display: "block", fontWeight: 900, fontSize: 18 }}
                      >
                        {subscription.businessName}
                      </Typography>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ display: "block", color: "text.secondary" }}
                      >
                        {subscription.planName} ·{" "}
                        {billingModeLabel(subscription.billingMode)} billing ·{" "}
                        {subscription.handle}.xtiitch.com
                      </Typography>
                    </DialogTitle>
                    <DialogContent dividers>
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="admin-subscription:update"
                        />
                        <input
                          type="hidden"
                          name="business_id"
                          value={subscription.businessId}
                        />
                        <Stack spacing={1.5}>
                          <Box>
                            <FormGroupLabel>Billing state</FormGroupLabel>
                            <Box
                              sx={{
                                display: "grid",
                                gap: 1,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  sm: "repeat(2, minmax(0, 1fr))",
                                  lg: "150px 160px minmax(220px, 1fr)",
                                },
                              }}
                            >
                              <TextField
                                select
                                size="small"
                                label="Status"
                                name="status"
                                defaultValue={subscription.status}
                              >
                                {subscriptionStatusOptions.map((option) => (
                                  <MenuItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                select
                                size="small"
                                label="Mode"
                                name="billing_mode"
                                defaultValue={subscription.billingMode}
                              >
                                {subscriptionBillingModeOptions.map(
                                  (option) => (
                                    <MenuItem
                                      key={option.value}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </MenuItem>
                                  ),
                                )}
                              </TextField>
                              <TextField
                                size="small"
                                label="Reason"
                                name="reason"
                                defaultValue=""
                                placeholder="Operator note"
                              />
                            </Box>
                          </Box>
                          <Box>
                            <FormGroupLabel>Provider references</FormGroupLabel>
                            <Box
                              sx={{
                                display: "grid",
                                gap: 1,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  md: "repeat(2, minmax(0, 1fr))",
                                },
                              }}
                            >
                              <TextField
                                size="small"
                                label="Paystack customer ref"
                                name="provider_customer_ref"
                                defaultValue={subscription.providerCustomerRef}
                                placeholder="CUS_..."
                              />
                              <TextField
                                size="small"
                                label="Paystack auth/subscription ref"
                                name="provider_subscription_ref"
                                defaultValue={
                                  subscription.providerSubscriptionRef
                                }
                                placeholder="AUTH_... or SUB_..."
                              />
                            </Box>
                          </Box>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            sx={{ justifyContent: "flex-end" }}
                          >
                            <Button type="submit" variant="contained">
                              Save billing state
                            </Button>
                          </Stack>
                        </Stack>
                      </Form>

                      {canCaptureAuthorization ? (
                        <Box
                          component="details"
                          sx={{
                            mt: 1.25,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: alpha(tokens.ink, 0.1),
                            bgcolor: "rgba(var(--surface-rgb), 0.4)",
                            p: 1.25,
                            "& > summary": {
                              cursor: "pointer",
                              listStyle: "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1,
                              "&::-webkit-details-marker": { display: "none" },
                            },
                            "&[open] > summary": { mb: 1.25 },
                          }}
                        >
                          <Box component="summary">
                            <Box
                              component="span"
                              sx={{
                                fontWeight: 900,
                                fontSize: 13,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: alpha(tokens.ink, 0.6),
                              }}
                            >
                              Recurring authorization
                            </Box>
                            <Box
                              component="span"
                              sx={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: alpha(tokens.burgundy, 0.85),
                              }}
                            >
                              Manage
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1,
                              gridTemplateColumns: {
                                xs: "1fr",
                                xl: "repeat(2, minmax(0, 1fr))",
                              },
                            }}
                          >
                            <Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="admin-subscription-authorization:init"
                              />
                              <input
                                type="hidden"
                                name="business_id"
                                value={subscription.businessId}
                              />
                              <Stack spacing={1}>
                                <Box
                                  sx={{
                                    display: "grid",
                                    gap: 1,
                                    gridTemplateColumns: {
                                      xs: "1fr",
                                      md: "repeat(2, minmax(0, 1fr))",
                                    },
                                  }}
                                >
                                  <TextField
                                    size="small"
                                    name="callback_url"
                                    label="Callback URL"
                                    placeholder="https://admin.xtiitch.com/admin?section=subscriptions"
                                    fullWidth
                                  />
                                  <TextField
                                    size="small"
                                    name="reason"
                                    label="Link note"
                                    defaultValue="Create recurring authorization link"
                                    fullWidth
                                  />
                                </Box>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  sx={{ justifyContent: "flex-end" }}
                                >
                                  <Button
                                    type="submit"
                                    variant="outlined"
                                    startIcon={<CreditCardRounded />}
                                  >
                                    Create auth
                                  </Button>
                                </Stack>
                              </Stack>
                            </Form>
                            <Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="admin-subscription-authorization:verify"
                              />
                              <input
                                type="hidden"
                                name="business_id"
                                value={subscription.businessId}
                              />
                              <Stack spacing={1}>
                                <Box
                                  sx={{
                                    display: "grid",
                                    gap: 1,
                                    gridTemplateColumns: {
                                      xs: "1fr",
                                      md: "repeat(2, minmax(0, 1fr))",
                                    },
                                  }}
                                >
                                  <TextField
                                    size="small"
                                    name="reference"
                                    label="Paystack reference"
                                    placeholder="authorization reference"
                                    fullWidth
                                  />
                                  <TextField
                                    size="small"
                                    name="reason"
                                    label="Verify note"
                                    defaultValue="Verify recurring authorization"
                                    fullWidth
                                  />
                                </Box>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  sx={{ justifyContent: "flex-end" }}
                                >
                                  <Button
                                    type="submit"
                                    variant="outlined"
                                    color="success"
                                    startIcon={<CheckCircleRounded />}
                                  >
                                    Verify auth
                                  </Button>
                                </Stack>
                              </Stack>
                            </Form>
                          </Box>
                        </Box>
                      ) : null}

                      <Divider sx={{ my: 1.5 }} />
                      <Stack spacing={1.25}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={1}
                          sx={{
                            justifyContent: "space-between",
                            alignItems: { md: "center" },
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontWeight: 900 }}>
                              Invoice control
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {latestInvoice
                                ? `${latestInvoice.invoiceRef} · ${invoiceStatusLabel(
                                    latestInvoice.status,
                                  )} · ${formatGHS(latestInvoice.amountMinor)}`
                                : "No package invoice has been issued yet."}
                            </Typography>
                          </Box>
                          {latestInvoice ? (
                            <Chip
                              size="small"
                              label={`Due ${shortTime(latestInvoice.dueAt)}`}
                              color={
                                latestInvoice.status === "issued"
                                  ? "warning"
                                  : latestInvoice.status === "paid"
                                    ? "success"
                                    : "default"
                              }
                              variant={
                                latestInvoice.status === "paid"
                                  ? "filled"
                                  : "outlined"
                              }
                              sx={{
                                alignSelf: { xs: "flex-start", md: "center" },
                              }}
                            />
                          ) : null}
                        </Stack>

                        {openInvoice ? (
                          <Box
                            sx={{
                              display: "grid",
                              gap: 1,
                              gridTemplateColumns: {
                                xs: "1fr",
                                lg: "repeat(2, minmax(0, 1fr))",
                              },
                            }}
                          >
                            <Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="admin-subscription-invoice:paid"
                              />
                              <input
                                type="hidden"
                                name="invoice_id"
                                value={openInvoice.invoiceId}
                              />
                              <Stack spacing={1}>
                                <TextField
                                  size="small"
                                  name="reason"
                                  label="Paid note"
                                  placeholder="Paystack payment confirmed"
                                  fullWidth
                                />
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  sx={{ justifyContent: "flex-end" }}
                                >
                                  <Button
                                    type="submit"
                                    variant="outlined"
                                    color="success"
                                  >
                                    Mark paid
                                  </Button>
                                </Stack>
                              </Stack>
                            </Form>
                            <Form method="post">
                              <input
                                type="hidden"
                                name="intent"
                                value="admin-subscription-invoice:failed"
                              />
                              <input
                                type="hidden"
                                name="invoice_id"
                                value={openInvoice.invoiceId}
                              />
                              <Stack spacing={1}>
                                <TextField
                                  size="small"
                                  name="reason"
                                  label="Failure note"
                                  placeholder="Card failed or link expired"
                                  fullWidth
                                />
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  sx={{ justifyContent: "flex-end" }}
                                >
                                  <Button
                                    type="submit"
                                    variant="outlined"
                                    color="warning"
                                  >
                                    Mark failed
                                  </Button>
                                </Stack>
                              </Stack>
                            </Form>
                          </Box>
                        ) : null}

                        {canIssueInvoice ? (
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="admin-subscription-invoice:issue"
                            />
                            <input
                              type="hidden"
                              name="business_id"
                              value={subscription.businessId}
                            />
                            <Box
                              sx={{
                                display: "grid",
                                gap: 1,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  md: "repeat(2, minmax(0, 1fr))",
                                },
                              }}
                            >
                              <TextField
                                size="small"
                                name="provider_invoice_ref"
                                label="Provider ref"
                                placeholder="Paystack invoice/link id"
                              />
                              <TextField
                                size="small"
                                name="payment_url"
                                label="Payment link"
                                placeholder="https://paystack.com/pay/..."
                              />
                              <StyledDateTimeField
                                size="small"
                                name="due_at"
                                label="Due date"
                              />
                              <TextField
                                size="small"
                                name="reason"
                                label="Issue note"
                                placeholder="Monthly package billing"
                              />
                            </Box>
                            <Button
                              type="submit"
                              variant="outlined"
                              startIcon={<WorkspacePremiumRounded />}
                              sx={{
                                mt: 1,
                                alignSelf: "flex-start",
                                height: 44,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Issue invoice
                            </Button>
                          </Form>
                        ) : null}
                      </Stack>
                    </DialogContent>
                  </Dialog>
                </Box>
              );
            })}
            <PaginationFooter
              count={lifecyclePageCount}
              label="subscription rows"
              page={lifecyclePage}
              pageSize={4}
              total={lifecycleRows.length}
              onChange={setLifecyclePage}
            />
          </Stack>
        </Panel>

        <Panel
          sx={{
            p: { xs: 2, md: 2.5 },
            borderColor: alpha(tokens.info, 0.18),
            backgroundImage: `
              radial-gradient(circle at 96% 0%, ${alpha(tokens.info, 0.14)}, transparent 35%),
              linear-gradient(180deg, rgba(var(--surface-rgb), 0.98), rgba(var(--surface-rgb), 0.72))
            `,
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <WorkspacePremiumRounded sx={{ color: tokens.burgundy }} />
              <Box>
                <Typography variant="h6">Subscription events</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Latest operator lifecycle changes.
                </Typography>
              </Box>
            </Stack>
            <Divider />
            {recentEvents.length === 0 ? (
              <Alert severity="info">
                No lifecycle events have been recorded yet.
              </Alert>
            ) : null}
            {recentEvents.map((event) => (
              <Box
                key={event.id}
                sx={{
                  p: 1.3,
                  border: "1px solid",
                  borderColor: alpha(tokens.ink, 0.08),
                  borderRadius: 1.5,
                  bgcolor: "rgba(var(--surface-rgb), 0.7)",
                }}
              >
                <Typography sx={{ fontWeight: 900 }}>
                  {event.businessName}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {event.summary}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
                >
                  {shortTime(event.createdAt)} · {event.actorEmail || "System"}
                </Typography>
              </Box>
            ))}
            <Button
              variant="outlined"
              endIcon={<ArrowForwardRounded />}
              onClick={() => onSelect("money")}
              sx={{ whiteSpace: "nowrap" }}
            >
              Review money rails
            </Button>
          </Stack>
        </Panel>
      </Box>
    </Stack>
  );
}
