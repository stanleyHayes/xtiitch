import { redirect } from "react-router";
import { adminApi, PLAN_BENEFITS } from "../../lib/api";
import { requireAdminContext, logOut } from "../../lib/session";
import { uploadBrandLogo } from "./adminApi";
import {
  readAdminRole,
  readAdminPermissions,
  readAdminExportDataset,
  adminExportFilename,
  readVerificationDecision,
  readBusinessOperationalStatus,
  readSubscriptionStatus,
  readSubscriptionBillingMode,
  readSubscriptionDiscountType,
  readPromotionDiscountType,
  readPromotionFundingSource,
  readPromotionScope,
  readPromotionEditableStatus,
  readAdPlacementType,
  readAdCampaignEditableStatus,
  readAdPricingModel,
  readAffiliateEntityType,
  readAffiliateCommissionModel,
  readAffiliatePayoutMode,
  readAffiliateEditableStatus,
  readAffiliateConversionStatus,
  readReferralAudience,
  readReferralRewardKind,
  readReferralRefereeRewardKind,
  readReferralRewardType,
  readReferralEditableStatus,
  readReferralCodeOwnerType,
  readReferralCodeStatus,
  readAffiliateCommissionValue,
  readReferralRewardValue,
  readPromotionDiscountValue,
  readSubscriptionDiscountValue,
  readEntitlementRow,
  readRiskReviewStatus,
  readSupportTicketStatus,
  readSupportAssignment,
  readBoolean,
  readNumber,
  readInt,
  readOptionalText,
  readOptionalInteger,
  readGhsPesewas,
  readOptionalGhsPesewas,
  readOptionalDateTime,
} from "./formReaders";
import {
  adminUserActionError,
  adminRoleActionError,
  adminSettingsActionError,
  adminVerificationActionError,
  adminBusinessActionError,
  adminMoneyActionError,
  adminSubscriptionActionError,
  adminPlanActionError,
  adminPromotionActionError,
  adminAdCampaignActionError,
  adminAffiliateActionError,
  adminReferralProgrammeActionError,
  adminRiskActionError,
  adminSupportActionError,
  supportActionMessage,
  affiliateConversionActionMessage,
  referralRewardIssueActionMessage,
} from "./actionErrors";
import { EntitlementFormRow } from "./types";

export async function handleAdminAction({
  request,
  intent,
  form,
}: {
  request: Request;
  intent: string;
  form: FormData;
}) {
  if (intent === "logout") {
    return logOut(request);
  }

  if (intent === "admin-export:download") {
    const { accessToken } = await requireAdminContext(request);
    const dataset = readAdminExportDataset(form.get("dataset"));
    const csv = await adminApi.exportDataset(accessToken, dataset);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${adminExportFilename(
          dataset,
        )}"`,
      },
    });
  }

  if (intent === "admin-user:create" || intent === "admin-user:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-user:create") {
        await adminApi.createUser(accessToken, {
          displayName: String(form.get("display_name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          role: readAdminRole(form.get("role")),
        });
        return {
          section: "users",
          severity: "success",
          message: "Operator access created.",
        };
      }

      await adminApi.updateUser(
        accessToken,
        String(form.get("admin_user_id") ?? ""),
        {
          displayName: String(form.get("display_name") ?? ""),
          role: readAdminRole(form.get("role")),
          isActive: String(form.get("is_active") ?? "") === "true",
        },
      );
      return {
        section: "users",
        severity: "success",
        message: "Operator access updated.",
      };
    } catch (error) {
      return {
        section: "users",
        severity: "error",
        message: adminUserActionError(error),
      };
    }
  }

  if (
    intent === "admin-profile:update" ||
    intent === "admin-preferences:update" ||
    intent === "admin-platform-settings:update"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-profile:update") {
        await adminApi.updateProfile(accessToken, {
          displayName: String(form.get("display_name") ?? ""),
          email: String(form.get("email") ?? ""),
        });
        return {
          section: "settings",
          severity: "success",
          message: "Profile settings saved.",
        };
      }

      if (intent === "admin-preferences:update") {
        await adminApi.updatePreferences(accessToken, {
          timezone: String(form.get("timezone") ?? ""),
          phoneNumber: String(form.get("phone_number") ?? ""),
          notifyEmail: readBoolean(form, "notify_email"),
          notifySms: readBoolean(form, "notify_sms"),
          alertVerifications: readBoolean(form, "alert_verifications"),
          alertMoneyRails: readBoolean(form, "alert_money_rails"),
          alertSubscriptions: readBoolean(form, "alert_subscriptions"),
          alertPromotions: readBoolean(form, "alert_promotions"),
          alertRisk: readBoolean(form, "alert_risk"),
          alertSupport: readBoolean(form, "alert_support"),
          dailyDigestTime: String(form.get("daily_digest_time") ?? ""),
        });
        return {
          section: "settings",
          severity: "success",
          message: "Notification preferences saved.",
        };
      }

      let brandLogoUrl = String(form.get("brand_logo_url") ?? "");
      if (readBoolean(form, "remove_brand_logo")) {
        brandLogoUrl = "";
      } else {
        const logoFile = form.get("brand_logo_file");
        if (logoFile instanceof File && logoFile.size > 0) {
          const uploaded = await uploadBrandLogo(accessToken, logoFile);
          if (uploaded) {
            brandLogoUrl = uploaded;
          }
        }
      }
      await adminApi.updatePlatformSettings(accessToken, {
        platformName: String(form.get("platform_name") ?? ""),
        supportEmail: String(form.get("support_email") ?? ""),
        verificationSlaHours: Math.trunc(
          readNumber(form.get("verification_sla_hours"), 24),
        ),
        payoutReviewThresholdPesewas: readGhsPesewas(
          form.get("payout_review_threshold_ghs"),
        ),
        maintenanceMode: readBoolean(form, "maintenance_mode"),
        aiAssistantAddonEnabled: readBoolean(form, "ai_assistant_addon_enabled"),
        brandLogoUrl,
      });
      return {
        section: "settings",
        severity: "success",
        message: "Platform settings saved.",
      };
    } catch (error) {
      return {
        section: "settings",
        severity: "error",
        message: adminSettingsActionError(error),
      };
    }
  }

  if (intent === "admin-marketing-flags:update") {
    const { accessToken } = await requireAdminContext(request);
    try {
      await adminApi.updateMarketingFlags(accessToken, {
        browseStore: readBoolean(form, "browse_store"),
        discover: readBoolean(form, "discover"),
        createStore: readBoolean(form, "create_store"),
        pricing: readBoolean(form, "pricing"),
      });
      return {
        section: "settings",
        severity: "success",
        message: "Marketing launch flags saved.",
      };
    } catch (error) {
      return {
        section: "settings",
        severity: "error",
        message: adminSettingsActionError(error),
      };
    }
  }

  if (intent === "admin-verification:decide") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const decision = readVerificationDecision(form.get("decision"));
      await adminApi.decideVerification(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          decision,
          note: String(form.get("note") ?? ""),
        },
      );
      return {
        section: "verification",
        severity: "success",
        message:
          decision === "approved"
            ? "Business verification approved."
            : decision === "rejected"
              ? "Business verification rejected."
              : "Business verification held for follow-up.",
      };
    } catch (error) {
      return {
        section: "verification",
        severity: "error",
        message: adminVerificationActionError(error),
      };
    }
  }

  if (intent === "admin-business-status:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const operationalStatus = readBusinessOperationalStatus(
        form.get("operational_status"),
      );
      await adminApi.updateBusinessStatus(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          operationalStatus,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "businesses",
        severity: "success",
        message:
          operationalStatus === "suspended"
            ? "Business suspended."
            : "Business reactivated.",
      };
    } catch (error) {
      return {
        section: "businesses",
        severity: "error",
        message: adminBusinessActionError(error),
      };
    }
  }

  if (intent === "admin-customer:erase") {
    const { accessToken } = await requireAdminContext(request);
    try {
      const result = await adminApi.eraseCustomer(
        accessToken,
        String(form.get("customer_id") ?? ""),
        String(form.get("confirmation") ?? ""),
      );
      return {
        section: "customers",
        severity: "success",
        message: `Customer data erased. ${result.orders_retained} order(s) retained; ${result.measurements_cleared} measurement set(s) and ${result.booking_addresses_cleared} address(es) cleared.`,
      };
    } catch {
      return {
        section: "customers",
        severity: "error",
        message:
          "Could not erase this customer. Confirm you typed ERASE CUSTOMER DATA and have permission.",
      };
    }
  }

  if (
    intent === "money:webhook-replay" ||
    intent === "money:payment-reversal" ||
    intent === "money:settlement-hold"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "money:webhook-replay") {
        await adminApi.queueMoneyReplay(accessToken, {
          providerReference: String(form.get("provider_reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
        return {
          section: "money",
          severity: "success",
          message: "Webhook replay review queued.",
        };
      }

      if (intent === "money:payment-reversal") {
        const reversal = await adminApi.reverseMoneyPayment(accessToken, {
          providerReference: String(form.get("provider_reference") ?? ""),
          reason: String(form.get("reason") ?? ""),
        });
        return {
          section: "money",
          severity: "success",
          message: reversal.payment_reversed
            ? "Payment reversal applied."
            : "Payment was already reversed.",
        };
      }

      const hold = String(form.get("hold") ?? "") === "true";
      await adminApi.setSettlementReviewHold(
        accessToken,
        String(form.get("business_id") ?? ""),
        {
          hold,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "money",
        severity: "success",
        message: hold
          ? "Settlement review hold placed."
          : "Settlement review hold released.",
      };
    } catch (error) {
      return {
        section: "money",
        severity: "error",
        message: adminMoneyActionError(error),
      };
    }
  }

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

  if (
    intent === "admin-promotion:create" ||
    intent === "admin-promotion:update" ||
    intent === "admin-promotion:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-promotion:archive") {
        await adminApi.archivePromotion(
          accessToken,
          String(form.get("promotion_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "promotions",
          severity: "success",
          message: "Promotion archived.",
        };
      }

      const discountType = readPromotionDiscountType(form.get("discount_type"));
      const payload = {
        businessId: readOptionalText(form.get("business_id")),
        code: String(form.get("code") ?? ""),
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        discountType,
        discountValue: readPromotionDiscountValue(
          discountType,
          form.get("discount_value"),
        ),
        maxDiscountMinor: readOptionalGhsPesewas(form.get("max_discount_ghs")),
        minSpendMinor: readGhsPesewas(form.get("min_spend_ghs")),
        usageLimitGlobal: readOptionalInteger(form.get("usage_limit_global")),
        usageLimitPerCustomer: readOptionalInteger(
          form.get("usage_limit_per_customer"),
        ),
        fundingSource: readPromotionFundingSource(form.get("funding_source")),
        scope: readPromotionScope(form.get("scope")),
        targetCollectionId: readOptionalText(form.get("target_collection_id")),
        targetDesignId: readOptionalText(form.get("target_design_id")),
        status: readPromotionEditableStatus(form.get("status")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
      };

      if (intent === "admin-promotion:create") {
        await adminApi.createPromotion(accessToken, payload);
        return {
          section: "promotions",
          severity: "success",
          message: "Promotion created.",
        };
      }

      await adminApi.updatePromotion(
        accessToken,
        String(form.get("promotion_id") ?? ""),
        payload,
      );
      return {
        section: "promotions",
        severity: "success",
        message: "Promotion updated.",
      };
    } catch (error) {
      return {
        section: "promotions",
        severity: "error",
        message: adminPromotionActionError(error),
      };
    }
  }

  if (
    intent === "admin-ad-campaign:create" ||
    intent === "admin-ad-campaign:update" ||
    intent === "admin-ad-campaign:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-ad-campaign:archive") {
        await adminApi.archiveAdCampaign(
          accessToken,
          String(form.get("campaign_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "ads",
          severity: "success",
          message: "Sponsored placement archived.",
        };
      }

      const payload = {
        businessId: String(form.get("business_id") ?? ""),
        placementType: readAdPlacementType(form.get("placement_type")),
        targetRefId: String(form.get("target_ref_id") ?? ""),
        headline: String(form.get("headline") ?? ""),
        description: String(form.get("description") ?? ""),
        status: readAdCampaignEditableStatus(form.get("status")),
        pricingModel: readAdPricingModel(form.get("pricing_model")),
        budgetMinor: readGhsPesewas(form.get("budget_ghs")),
        dailyCapMinor: readOptionalGhsPesewas(form.get("daily_cap_ghs")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
        reviewNote: String(form.get("review_note") ?? ""),
      };

      if (intent === "admin-ad-campaign:create") {
        await adminApi.createAdCampaign(accessToken, payload);
        return {
          section: "ads",
          severity: "success",
          message: "Sponsored placement created.",
        };
      }

      await adminApi.updateAdCampaign(
        accessToken,
        String(form.get("campaign_id") ?? ""),
        payload,
      );
      return {
        section: "ads",
        severity: "success",
        message: "Sponsored placement updated.",
      };
    } catch (error) {
      return {
        section: "ads",
        severity: "error",
        message: adminAdCampaignActionError(error),
      };
    }
  }

  if (intent === "admin-ad-campaign-payment:collect") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const result = await adminApi.collectAdCampaignPayment(
        accessToken,
        String(form.get("campaign_id") ?? ""),
        String(form.get("customer_email") ?? ""),
      );
      return {
        section: "ads",
        severity: "success",
        message: result.created
          ? "Sponsored placement payment link created."
          : "Existing sponsored placement payment link is still open.",
      };
    } catch (error) {
      return {
        section: "ads",
        severity: "error",
        message: adminAdCampaignActionError(error),
      };
    }
  }

  if (
    intent === "admin-affiliate:create" ||
    intent === "admin-affiliate:update" ||
    intent === "admin-affiliate:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-affiliate:archive") {
        await adminApi.archiveAffiliate(
          accessToken,
          String(form.get("affiliate_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "affiliates",
          severity: "success",
          message: "Affiliate partner archived.",
        };
      }

      const payload = {
        entityType: readAffiliateEntityType(form.get("entity_type")),
        code: String(form.get("code") ?? ""),
        displayName: String(form.get("display_name") ?? ""),
        contactName: String(form.get("contact_name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        websiteUrl: String(form.get("website_url") ?? ""),
        commissionModel: readAffiliateCommissionModel(
          form.get("commission_model"),
        ),
        commissionRate: readAffiliateCommissionValue(
          form.get("commission_model"),
          form.get("commission_value"),
        ),
        cookieWindowDays: readInt(form.get("cookie_window_days"), 30),
        payoutMode: readAffiliatePayoutMode(form.get("payout_mode")),
        payoutReference: String(form.get("payout_reference") ?? ""),
        status: readAffiliateEditableStatus(form.get("status")),
        notes: String(form.get("notes") ?? ""),
      };

      if (intent === "admin-affiliate:create") {
        await adminApi.createAffiliate(accessToken, payload);
        return {
          section: "affiliates",
          severity: "success",
          message: "Affiliate partner created.",
        };
      }

      await adminApi.updateAffiliate(
        accessToken,
        String(form.get("affiliate_id") ?? ""),
        payload,
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Affiliate partner updated.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-conversion:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readAffiliateConversionStatus(form.get("status"));

    try {
      await adminApi.updateAffiliateConversionStatus(
        accessToken,
        String(form.get("conversion_id") ?? ""),
        {
          status,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: affiliateConversionActionMessage(status),
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-affiliate-payout:create") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.createAffiliatePayout(
        accessToken,
        String(form.get("affiliate_id") ?? ""),
        {
          payoutReference: String(form.get("payout_reference") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      );
      return {
        section: "affiliates",
        severity: "success",
        message: "Affiliate payout reconciled.",
      };
    } catch (error) {
      return {
        section: "affiliates",
        severity: "error",
        message: adminAffiliateActionError(error),
      };
    }
  }

  if (intent === "admin-referral-code:create") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.createReferralCode(
        accessToken,
        String(form.get("programme_id") ?? ""),
        {
          businessId: String(form.get("business_id") ?? "") || undefined,
          ownerType: readReferralCodeOwnerType(form.get("owner_type")),
          code: String(form.get("code") ?? ""),
          status: readReferralCodeStatus(form.get("status")),
        },
      );
      return {
        section: "referrals",
        severity: "success",
        message: "Referral code issued.",
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (intent === "admin-referral-rewards:issue") {
    const { accessToken } = await requireAdminContext(request);

    try {
      const result = await adminApi.issueReferralRewards(
        accessToken,
        readInt(form.get("limit"), 50),
      );
      return {
        section: "referrals",
        severity: "success",
        message: referralRewardIssueActionMessage(result),
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (
    intent === "admin-referral-programme:create" ||
    intent === "admin-referral-programme:update" ||
    intent === "admin-referral-programme:archive"
  ) {
    const { accessToken } = await requireAdminContext(request);

    try {
      if (intent === "admin-referral-programme:archive") {
        await adminApi.archiveReferralProgramme(
          accessToken,
          String(form.get("programme_id") ?? ""),
          String(form.get("reason") ?? ""),
        );
        return {
          section: "referrals",
          severity: "success",
          message: "Referral programme archived.",
        };
      }

      const rewardType = readReferralRewardType(form.get("reward_type"));
      const payload = {
        title: String(form.get("title") ?? ""),
        codePrefix: String(form.get("code_prefix") ?? ""),
        audience: readReferralAudience(form.get("audience")),
        referrerRewardKind: readReferralRewardKind(
          form.get("referrer_reward_kind"),
        ),
        refereeRewardKind: readReferralRefereeRewardKind(
          form.get("referee_reward_kind"),
        ),
        rewardType,
        rewardValue: readReferralRewardValue(
          rewardType,
          form.get("reward_value"),
        ),
        maxRewardMinor: readOptionalGhsPesewas(form.get("max_reward_ghs")),
        qualifyingOrderMinMinor: readGhsPesewas(
          form.get("qualifying_order_min_ghs"),
        ),
        rewardHoldDays: readInt(form.get("reward_hold_days"), 14),
        status: readReferralEditableStatus(form.get("status")),
        startsAt: readOptionalDateTime(form.get("starts_at")),
        endsAt: readOptionalDateTime(form.get("ends_at")),
        notes: String(form.get("notes") ?? ""),
      };

      if (intent === "admin-referral-programme:create") {
        await adminApi.createReferralProgramme(accessToken, payload);
        return {
          section: "referrals",
          severity: "success",
          message: "Referral programme created.",
        };
      }

      await adminApi.updateReferralProgramme(
        accessToken,
        String(form.get("programme_id") ?? ""),
        payload,
      );
      return {
        section: "referrals",
        severity: "success",
        message: "Referral programme updated.",
      };
    } catch (error) {
      return {
        section: "referrals",
        severity: "error",
        message: adminReferralProgrammeActionError(error),
      };
    }
  }

  if (intent === "admin-risk-review:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readRiskReviewStatus(form.get("status"));

    try {
      await adminApi.updateRiskReviewStatus(
        accessToken,
        String(form.get("review_key") ?? ""),
        {
          status,
          reason: String(form.get("reason") ?? ""),
        },
      );
      return {
        section: "risk",
        severity: "success",
        message:
          status === "closed" ? "Risk review closed." : "Risk review reopened.",
      };
    } catch (error) {
      return {
        section: "risk",
        severity: "error",
        message: adminRiskActionError(error),
      };
    }
  }

  if (intent === "admin-support-ticket:update") {
    const { accessToken } = await requireAdminContext(request);
    const status = readSupportTicketStatus(form.get("status"));
    const assignment = readSupportAssignment(form.get("assignment"));

    try {
      await adminApi.updateSupportTicket(
        accessToken,
        String(form.get("ticket_key") ?? ""),
        {
          status,
          assignment,
          note: String(form.get("note") ?? ""),
        },
      );
      return {
        section: "support",
        severity: "success",
        message: supportActionMessage(status, assignment),
      };
    } catch (error) {
      return {
        section: "support",
        severity: "error",
        message: adminSupportActionError(error),
      };
    }
  }

  if (intent === "admin-role-permissions:update") {
    const { accessToken } = await requireAdminContext(request);

    try {
      await adminApi.updateRolePermissions(
        accessToken,
        readAdminRole(form.get("role")),
        readAdminPermissions(form),
      );
      return {
        section: "roles",
        severity: "success",
        message: "Role permissions updated.",
      };
    } catch (error) {
      return {
        section: "roles",
        severity: "error",
        message: adminRoleActionError(error),
      };
    }
  }
  return redirect("/admin");
}
