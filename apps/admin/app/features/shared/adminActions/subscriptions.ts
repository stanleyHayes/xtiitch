import { adminApi, PLAN_BENEFITS } from "../../../lib/api";
import { requireAdminContext } from "../../../lib/session";
import {
  readSubscriptionStatus,
  readSubscriptionBillingMode,
  readSubscriptionDiscountType,
  readSubscriptionDiscountValue,
  readEntitlementRow,
  readGhsPesewas,
  readNumber,
  readOptionalInteger,
  readOptionalDateTime,
  readPlanCadence,
} from "../formReaders";
import {
  adminSubscriptionActionError,
  adminPlanActionError,
} from "../actionErrors";
import type { AdminActionFeedback, EntitlementFormRow } from "../types";

export async function handleSubscriptionsAction({ // eslint-disable-line complexity, max-lines-per-function -- intent dispatcher with many conditional branches; refactor in follow-up
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}): Promise<AdminActionFeedback | null> {
  if (intent === "admin-subscription:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readSubscriptionStatus(form.get("status"));
    const billingMode = readSubscriptionBillingMode(form.get("billing_mode"));

    try {
      await adminApi.updateSubscription(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          status,
          billingMode,
          providerCustomerRef: String(form.get("provider_customer_ref") ?? ""),
          providerSubscriptionRef: String(
            form.get("provider_subscription_ref") ?? "",
          ),
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Subscription lifecycle updated.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-billing:sweep" ||
    intent === "admin-subscription-recurring:sweep"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-subscription-recurring:sweep") {
        const result = await adminApi.runSubscriptionRecurringSweep(
          accessToken,
          String(form.get("reason") ?? ""),
        );
        return {
          section: "subscriptions",
          severity:
            result.chargesFailed > 0 || result.chargesSkipped > 0
              ? "warning"
              : "success",
          message: `Recurring charge sweep complete: ${result.chargesPaid} paid, ${result.chargesPending} pending, ${result.chargesFailed} failed, ${result.chargesSkipped} skipped.`,
        };
      }

      const result = await adminApi.runSubscriptionBillingSweep(
        accessToken,
        String(form.get("reason") ?? ""),
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: `Billing sweep complete: ${result.overdueInvoicesFailed} overdue invoices failed, ${result.subscriptionsCanceled} expired grace subscriptions canceled.`,
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-authorization:init" ||
    intent === "admin-subscription-authorization:verify"
  ) {
    const { accessToken } = await requireAdminContext(request);
    const businessId = String(form.get("business_id") ?? "");

    try {
      if (intent === "admin-subscription-authorization:init") {
        const result = await adminApi.initializeSubscriptionAuthorization(
          accessToken,
          businessId,
          {
            callbackUrl: String(form.get("callback_url") ?? ""),
            reason: String(form.get("reason") ?? ""),
          },
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: `Authorization link created for ${result.businessName}.`,
          detail: `Reference: ${result.reference} · owner ${result.ownerEmail}`,
          href: result.redirectUrl,
          hrefLabel: "Open Paystack authorization",
        };
      }

      await adminApi.verifySubscriptionAuthorization(accessToken, businessId, {
        reference: String(form.get("reference") ?? ""),
        reason: String(form.get("reason") ?? ""),
      });
      return {
        section: "subscriptions",
        severity: "success",
        message: "Recurring authorization verified and stored.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-invoice:issue" ||
    intent === "admin-subscription-invoice:paid" ||
    intent === "admin-subscription-invoice:failed"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-subscription-invoice:issue") {
        await adminApi.issueSubscriptionInvoice(
          accessToken,
          String(form.get("business_id") ?? ""),
          {
            providerInvoiceRef: String(form.get("provider_invoice_ref") ?? ""),
            paymentUrl: String(form.get("payment_url") ?? ""),
            dueAt: readOptionalDateTime(form.get("due_at")),
            reason: String(form.get("reason") ?? ""),
          },
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Subscription invoice issued.",
        };
      }

      if (intent === "admin-subscription-invoice:paid") {
        await adminApi.markSubscriptionInvoicePaid(
          accessToken,
          String(form.get("invoice_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Subscription invoice marked paid.",
        };
      }

      await adminApi.markSubscriptionInvoiceFailed(
        accessToken,
        String(form.get("invoice_id") ?? ""),
        String(form.get("reason") ?? ""),
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Subscription invoice marked failed.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  if (
    intent === "admin-plan:create" ||
    intent === "admin-plan:update" ||
    intent === "admin-plan:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    const selectedFeatures = new Set(
      form.getAll("features").map((value) => String(value)),
    );
    const planCadence = readPlanCadence(form);

    const planFeatures = Object.fromEntries(
      PLAN_BENEFITS.map((benefit) => [
        benefit.key,
        selectedFeatures.has(benefit.key),
      ]),
    );

    try {
      if (intent === "admin-plan:create") {
        await adminApi.createPlan(accessToken, {
          code: String(form.get("code") ?? ""),
          name: String(form.get("name") ?? ""),
          monthlyFeeMinor: readGhsPesewas(form.get("monthly_fee_ghs")),
          yearlyFeeMinor: readGhsPesewas(form.get("yearly_fee_ghs")),
          cadence: planCadence,
          commissionBps: Math.trunc(readNumber(form.get("commission_bps"), 0)),
          designLimit: readOptionalInteger(form.get("design_limit")),
          features: planFeatures,
        });
        return {
          section: "subscriptions",
          severity: "success",
          message: "Plan package created.",
        };
      }

      if (intent === "admin-plan:update") {
        await adminApi.updatePlan(
          accessToken,
          String(form.get("plan_id") ?? ""),
          {
            name: String(form.get("name") ?? ""),
            monthlyFeeMinor: readGhsPesewas(form.get("monthly_fee_ghs")),
            yearlyFeeMinor: readGhsPesewas(form.get("yearly_fee_ghs")),
            cadence: planCadence,
            commissionBps: Math.trunc(
              readNumber(form.get("commission_bps"), 0),
            ),
            designLimit: readOptionalInteger(form.get("design_limit")),
            features: planFeatures,
            isActive: String(form.get("is_active") ?? "") === "true",
          },
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Plan package updated.",
        };
      }

      await adminApi.archivePlan(
        accessToken,
        String(form.get("plan_id") ?? ""),
        String(form.get("reason") ?? ""),
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Plan package archived.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminPlanActionError(error),
      };
    }
  }

  if (intent === "admin-plan-entitlements:update") {
    const { accessToken } = await requireAdminContext(request);
    const values = form
      .getAll("entitlement_row")
      .map((value) => readEntitlementRow(value))
      .filter((row): row is EntitlementFormRow => Boolean(row))
      .map((row) => {
        const inputId = `${row.planId}:${row.featureKey}`;
        const enabled = form.get(`enabled:${inputId}`) === "on";
        return {
          planId: row.planId,
          featureKey: row.featureKey,
          enabled,
          limitValue:
            row.valueType === "limit" && enabled
              ? readOptionalInteger(form.get(`limit:${inputId}`))
              : undefined,
        };
      });

    try {
      await adminApi.updatePlanEntitlements(accessToken, { values });
      return {
        section: "subscriptions",
        severity: "success",
        message: "Plan entitlement matrix updated.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminPlanActionError(error),
      };
    }
  }

  if (
    intent === "admin-subscription-discount:create" ||
    intent === "admin-subscription-discount:update" ||
    intent === "admin-subscription-discount:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-subscription-discount:archive") {
        await adminApi.archiveSubscriptionDiscountCode(
          accessToken,
          String(form.get("discount_code_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "subscriptions",
          severity: "success",
          message: "Subscription discount code archived.",
        };
      }

      const payload = {
        code: String(form.get("code") ?? ""),
        discountType: readSubscriptionDiscountType(form.get("discount_type")),
        discountValue: readSubscriptionDiscountValue(
          form.get("discount_type"),
          form.get("discount_value"),
        ),
        eligiblePlans: form
          .getAll("eligible_plans")
          .map((value) => String(value)),
        eligibleCadences: form
          .getAll("eligible_cadences")
          .map((value) => String(value)),
        firstPurchaseOnly: form.get("first_purchase_only") === "on",
        maxRedemptionsTotal: readOptionalInteger(
          form.get("max_redemptions_total"),
        ),
        maxPerAccount: Math.trunc(readNumber(form.get("max_per_account"), 1)),
        validFrom: readOptionalDateTime(form.get("valid_from")),
        validUntil: readOptionalDateTime(form.get("valid_until")),
        active: form.get("active") === "on",
        ownerName: String(form.get("owner_name") ?? ""),
        batchLabel: String(form.get("batch_label") ?? ""),
      };

      if (intent === "admin-subscription-discount:create") {
        await adminApi.createSubscriptionDiscountCode(accessToken, payload);
        return {
          section: "subscriptions",
          severity: "success",
          message: "Subscription discount code created.",
        };
      }

      await adminApi.updateSubscriptionDiscountCode(
        accessToken,
        String(form.get("discount_code_id") ?? ""),
        payload,
      );
      return {
        section: "subscriptions",
        severity: "success",
        message: "Subscription discount code updated.",
      };
    } catch (error) {
      return {
        section: "subscriptions",
        severity: "error",
        message: adminSubscriptionActionError(error),
      };
    }
  }

  return null;
}
