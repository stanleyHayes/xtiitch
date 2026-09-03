import { redirect } from "react-router";
import { OrderFilter, DashboardSection, MoneyPeriod } from "./types";
import { orderFilters, moneyPeriodOptions } from "./constants";

export function parseOrderFilter(value: string | null): OrderFilter {
  return orderFilters.some((filter) => filter.value === value)
    ? (value as OrderFilter)
    : "all";
}

export function parseMoneyPeriod(value: string | null): MoneyPeriod {
  return moneyPeriodOptions.some((option) => option.value === value)
    ? (value as MoneyPeriod)
    : "today";
}

export function parseDashboardSection(
  value: string | undefined,
  canManage: boolean,
): DashboardSection {
  if (!value) {
    return canManage ? "overview" : "tasks";
  }

  if (canManage && isManagementSection(value)) {
    return value;
  }

  if (!canManage && isStaffSection(value)) {
    return value;
  }

  throw redirect("/dashboard");
}

export function isManagementSection(value: string): value is DashboardSection {
  return [
    "overview",
    "reports",
    "analytics",
    "customers",
    "orders",
    "money",
    "visits",
    "handovers",
    "catalogue",
    "measurements",
    "availability",
    "settings",
    "team",
    "messages",
  ].includes(value);
}

export function isStaffSection(value: string): value is DashboardSection {
  return ["tasks", "orders", "visits", "handovers", "messages"].includes(value);
}
