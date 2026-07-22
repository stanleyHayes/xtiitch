/* eslint-disable max-lines -- already on the CI size allowlist
   (scripts/check-file-size.mjs) pending its queued split; this file owns all
   section dialog state, so the §1.2/§11.4 success effect must live here. */
import { useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import {
  AdminActionFeedback,
  AdminPlan,
  AdminPlanEntitlementFeature,
  AdminPlatformMetrics,
  AdminSubscription,
  AdminSubscriptionDiscountCode,
  Section,
} from "../../shared/types";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { PaginationFooter } from "../../../components/ui/PaginationFooter";
import { useActionSuccess } from "../../shared/useActionSuccess";
import { usePagedItems } from "../../shared/usePagedItems";
import { fallbackAdminPlans, subscriptionPlanFor } from "../../plans/utils";
import { PlanEntitlementMatrixPanel } from "../../plans/PlanEntitlementMatrixPanel";
import { SubscriptionActions } from "./SubscriptionActions";
import { BillingPanel } from "./BillingPanel";
import { PlanCards } from "./PlanCards";
import { RevenueTable, type PlanRevenueRow } from "./RevenueTable";
import { DiscountCodePanel } from "./DiscountCodePanel";
import { SubscriberCrmPanel } from "./SubscriberCrmPanel";
import { SubscriptionList } from "./SubscriptionList";
import { SubscriptionEventsPanel } from "./SubscriptionEventsPanel";
import { SubscriptionMetrics } from "./SubscriptionMetrics";
import { SubscriptionAlerts } from "./SubscriptionAlerts";
import { Panel } from "../../../components/ui/Panel";

type SubscriptionWorkspace =
  | "operations"
  | "packages"
  | "entitlements"
  | "subscribers";

// eslint-disable-next-line max-lines-per-function -- workspace owns shared filters and dialog state across its focused tabs
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
  const [subscriberBillingModeFilter, setSubscriberBillingModeFilter] =
    useState("all");
  // How often the subscription RENEWS. The state above drives the "Billing mode"
  // control and was misnamed "cadence": it filtered subscription.billingMode
  // (manual / payment_link / recurring), so the CRM had no cadence filter at all
  // despite §6.2 requiring one.
  const [subscriberCadenceFilter, setSubscriberCadenceFilter] = useState("all");
  const [workspace, setWorkspace] =
    useState<SubscriptionWorkspace>("operations");

  // §1.2/§11.4: one successful submit closes every dialog this section owns;
  // errors keep dialogs (and their inputs) open. Re-opening re-seeds fields
  // from revalidated loader data.
  const actionSuccess = useActionSuccess("subscriptions");
  useEffect(() => {
    if (!actionSuccess) return;
    setManageBusinessId(null);
    setCreatePlanOpen(false);
    setPlanDialogId(null);
    setCreateDiscountOpen(false);
    setDiscountDialogId(null);
  }, [actionSuccess]);

  const billableSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.monthlyFeeMinor > 0 && subscription.status !== "canceled",
  );
  const visiblePlans = plans.length > 0 ? plans : fallbackAdminPlans();
  const planRows: PlanRevenueRow[] = visiblePlans.map((plan) => {
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
    return {
      plan,
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
    const matchesBillingMode =
      subscriberBillingModeFilter === "all" ||
      subscription.billingMode === subscriberBillingModeFilter;
    const matchesCadence =
      subscriberCadenceFilter === "all" ||
      (subscriberCadenceFilter === "none"
        ? !subscription.billingCadence
        : subscription.billingCadence === subscriberCadenceFilter);
    return (
      matchesQuery &&
      matchesPlan &&
      matchesStatus &&
      matchesInstitution &&
      matchesBillingMode &&
      matchesCadence
    );
  });

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
  const {
    page: subscriberPage,
    pageCount: subscriberPageCount,
    pagedItems: pagedSubscriberRows,
    setPage: setSubscriberPage,
  } = usePagedItems(
    filteredSubscriberRows,
    8,
    `${subscriberQuery}:${subscriberPlanFilter}:${subscriberStatusFilter}:${subscriberInstitutionFilter}:${subscriberBillingModeFilter}:${subscriberCadenceFilter}`,
  );

  return (
    <Stack spacing={2.5}>
      <SectionHeader
        eyebrow="Plan billing"
        title="Subscriptions"
        helper="Lifecycle state, billing mode, grace periods, cancellations, and event history for business packages."
      />

      <SubscriptionMetrics
        estimatedMrrMinor={estimatedMrrMinor}
        billableCount={billableSubscriptions.length}
        platformMetrics={platformMetrics}
        attentionCount={attentionRows.length}
        pastDueCount={pastDueCount}
        overDesignLimitCount={overDesignLimitRows.length}
        freeUpgradeCandidateCount={freeUpgradeCandidates.length}
      />

      <Panel sx={{ p: 0, overflow: "hidden" }}>
        <Tabs
          value={workspace}
          onChange={(_event, value: SubscriptionWorkspace) =>
            setWorkspace(value)
          }
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Subscription workspaces"
          sx={{
            px: { xs: 1, sm: 2 },
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Tab value="operations" label="Operations" />
          <Tab value="packages" label={`Packages (${visiblePlans.length})`} />
          <Tab
            value="entitlements"
            label={`Entitlements (${planEntitlements.length})`}
          />
          <Tab
            value="subscribers"
            label={`Subscribers (${subscriptions.length})`}
          />
        </Tabs>
        <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
          <Alert severity="info" variant="outlined">
            {workspace === "operations"
              ? "Billing jobs, discount codes, and recent subscription activity."
              : null}
            {workspace === "packages"
              ? "Package pricing and revenue configuration. Editing forms open only when requested."
              : null}
            {workspace === "entitlements"
              ? "Feature access is isolated here so package controls stay readable."
              : null}
            {workspace === "subscribers"
              ? "Search customers, inspect billing state, and open a subscriber detail workflow."
              : null}
          </Alert>
        </Box>
      </Panel>

      {workspace === "operations" ? (
        <>
          <SubscriptionAlerts
            actionData={actionData}
            subscriptionsError={subscriptionsError}
            hasSubscriptions={subscriptions.length > 0}
          />
          <SubscriptionActions
            overdueIssuedInvoiceCount={overdueIssuedInvoiceCount}
            expiredGraceCount={expiredGraceCount}
            recurringDueRows={recurringDueRows.length}
            recurringReadyRows={recurringReadyRows.length}
            recurringBlockedCount={recurringBlockedCount}
          />
          <DiscountCodePanel
            discountCodes={subscriptionDiscountCodes}
            discountCodesError={subscriptionDiscountCodesError}
            plans={visiblePlans}
            createOpen={createDiscountOpen}
            selectedDiscountId={discountDialogId}
            onCreateOpenChange={setCreateDiscountOpen}
            onSelectDiscount={setDiscountDialogId}
          />
          <SubscriptionEventsPanel
            events={recentEvents}
            onSelectMoney={() => onSelect("money")}
          />
        </>
      ) : null}

      {workspace === "packages" ? (
        <>
          <BillingPanel
            plans={plans}
            plansError={plansError}
            createPlanOpen={createPlanOpen}
            onCreateOpenChange={setCreatePlanOpen}
          />
          <PlanCards
            plans={plans}
            plansError={plansError}
            pagedPlans={pagedPlans}
            planDialogId={planDialogId}
            onPlanDialogChange={setPlanDialogId}
          />
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
          <RevenueTable
            planRows={planRows}
            pagedPlanRows={pagedPlanRows}
            page={planRowPage}
            pageCount={planRowPageCount}
            onPageChange={setPlanRowPage}
          />
        </>
      ) : null}

      {workspace === "entitlements" ? (
        <PlanEntitlementMatrixPanel
          features={planEntitlements}
          featuresError={planEntitlementsError}
          plans={plans}
        />
      ) : null}

      {workspace === "subscribers" ? (
        <>
          <SubscriberCrmPanel
            subscriptions={subscriptions}
            filteredSubscriptions={filteredSubscriberRows}
            pagedSubscriptions={pagedSubscriberRows}
            query={subscriberQuery}
            planFilter={subscriberPlanFilter}
            statusFilter={subscriberStatusFilter}
            institutionFilter={subscriberInstitutionFilter}
            billingModeFilter={subscriberBillingModeFilter}
            cadenceFilter={subscriberCadenceFilter}
            onOpenSubscriber={setManageBusinessId}
            plans={visiblePlans}
            institutionOptions={subscriberInstitutionOptions}
            page={subscriberPage}
            pageCount={subscriberPageCount}
            onQueryChange={setSubscriberQuery}
            onPlanFilterChange={setSubscriberPlanFilter}
            onStatusFilterChange={setSubscriberStatusFilter}
            onInstitutionFilterChange={setSubscriberInstitutionFilter}
            onBillingModeFilterChange={setSubscriberBillingModeFilter}
            onCadenceFilterChange={setSubscriberCadenceFilter}
            onPageChange={setSubscriberPage}
          />
          <SubscriptionList
            subscriptions={subscriptions}
            lifecycleRows={lifecycleRows}
            pagedLifecycleRows={pagedLifecycleRows}
            manageBusinessId={manageBusinessId}
            setManageBusinessId={setManageBusinessId}
            page={lifecyclePage}
            pageCount={lifecyclePageCount}
            onPageChange={setLifecyclePage}
            onSelectBusinesses={() => onSelect("businesses")}
          />
        </>
      ) : null}
    </Stack>
  );
}
