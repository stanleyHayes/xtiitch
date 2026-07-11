import { useState, useMemo } from "react";
import type { AdminCustomer } from "../../lib/api";
import { AdminActionFeedback } from "../shared/types";
import { CustomerDirectoryPanel } from "../verifications/CustomerDirectoryPanel";

export function CustomersSection({
  adminCustomers,
  customerDirectoryError,
}: {
  adminCustomers: AdminCustomer[];
  customerDirectoryError: string | null;
  actionData?: AdminActionFeedback;
}) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminCustomer | null>(null);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) {
      return adminCustomers;
    }
    return adminCustomers.filter((customer) => {
      return (
        customer.displayName.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        customer.lastBusinessName.toLowerCase().includes(query) ||
        customer.lastBusinessHandle.toLowerCase().includes(query)
      );
    });
  }, [adminCustomers, customerQuery]);

  return (
    <CustomerDirectoryPanel
      customers={adminCustomers}
      visibleCustomers={filteredCustomers}
      selectedCustomer={selectedCustomer}
      query={customerQuery}
      error={customerDirectoryError}
      onQueryChange={setCustomerQuery}
      onInspect={setSelectedCustomer}
      onCloseInspector={() => setSelectedCustomer(null)}
    />
  );
}
