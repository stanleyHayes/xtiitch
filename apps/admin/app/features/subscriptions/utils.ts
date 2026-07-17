import { tokens } from "../../theme";
import {
  AdminSubscriptionStatus,
  AdminSubscriptionBillingMode,
  AdminSubscriptionDiscountType,
  AdminSubscriptionDiscountCode,
  AdminSubscription,
} from "../shared/types";
import { formatGHS } from "../shared/formatting";

export const subscriptionStatusOptions: {
  value: AdminSubscriptionStatus;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "grace_period", label: "Grace period" },
  { value: "cancel_at_period_end", label: "Cancel at period end" },
  { value: "canceled", label: "Canceled" },
];

export const subscriptionBillingModeOptions: {
  value: AdminSubscriptionBillingMode;
  label: string;
}[] = [
  { value: "manual", label: "Manual" },
  { value: "payment_link", label: "Payment link" },
  { value: "recurring", label: "Recurring" },
];

export const subscriptionDiscountTypeOptions: {
  value: AdminSubscriptionDiscountType;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
  { value: "free_period", label: "Free period" },
];

export const subscriptionDiscountCadenceOptions: { value: string; label: string }[] =
  [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

export function subscriptionStatusLabel(status: AdminSubscriptionStatus): string {
  return (
    subscriptionStatusOptions.find((option) => option.value === status)
      ?.label ?? status
  );
}



export function billingModeLabel(mode: AdminSubscriptionBillingMode): string {
  return (
    subscriptionBillingModeOptions.find((option) => option.value === mode)
      ?.label ?? mode
  );
}



export function subscriptionDiscountTypeLabel(
  value: AdminSubscriptionDiscountType,
): string {
  return (
    subscriptionDiscountTypeOptions.find((option) => option.value === value)
      ?.label ?? value
  );
}



export function subscriptionDiscountValueLabel(
  discount: Pick<
    AdminSubscriptionDiscountCode,
    "discountType" | "discountValue"
  >,
): string {
  if (discount.discountType === "percentage") {
    return `${(discount.discountValue / 100).toFixed(1)}%`;
  }
  if (discount.discountType === "fixed") {
    return formatGHS(discount.discountValue);
  }
  return `${discount.discountValue} month${discount.discountValue === 1 ? "" : "s"}`;
}



export function subscriptionDiscountValueDefault(
  discount: Pick<
    AdminSubscriptionDiscountCode,
    "discountType" | "discountValue"
  >,
): string {
  if (discount.discountType === "percentage") {
    return (discount.discountValue / 100).toString();
  }
  if (discount.discountType === "fixed") {
    return (discount.discountValue / 100).toFixed(2);
  }
  return String(discount.discountValue);
}



export function subscriptionDiscountStatus(
  discount: Pick<
    AdminSubscriptionDiscountCode,
    "active" | "archivedAt" | "validFrom" | "validUntil"
  >,
): { label: string; color: string } {
  const now = Date.now();
  if (discount.archivedAt) {
    return { label: "Archived", color: tokens.mutedText };
  }
  if (!discount.active) {
    return { label: "Paused", color: tokens.warning };
  }
  if (discount.validUntil && new Date(discount.validUntil).getTime() < now) {
    return { label: "Expired", color: tokens.danger };
  }
  if (discount.validFrom && new Date(discount.validFrom).getTime() > now) {
    return { label: "Scheduled", color: tokens.info };
  }
  return { label: "Active", color: tokens.success };
}



export function subscriptionContactNumber(subscription: AdminSubscription): string {
  return subscription.ownerWhatsApp || subscription.ownerPhone;
}



export function invoiceStatusLabel(status: string): string {
  switch (status) {
    case "issued":
      return "Issued";
    case "paid":
      return "Paid";
    case "failed":
      return "Failed";
    case "void":
      return "Void";
    default:
      return status;
  }
}

// How often a subscription renews, for display. '' is a real state -- a store
// that has not chosen a cadence yet -- and nothing is billable until it does, so
// it reads as "Not set" rather than being blanked out.
export function cadenceLabel(cadence: string): string {
  switch (cadence) {
    case "quarterly":
      return "Quarterly";
    case "yearly":
      return "Yearly";
    default:
      return "Not set";
  }
}
