import type { Customer } from "@/handlers/customer";

export const CUSTOMER_TYPEAHEAD_LIMIT = 8;

export function formatCustomerSuggestionLabel(customer: Customer): string {
  return `${customer.name} (${customer.contact})`;
}

export function filterCustomersForTypeahead(
  customers: Customer[],
  query: string,
  options?: { outletId?: string; limit?: number }
): Customer[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const limit = options?.limit ?? CUSTOMER_TYPEAHEAD_LIMIT;
  const outletId = options?.outletId?.trim();

  let pool = customers;
  if (outletId) {
    pool = pool.filter((c) => c.outletId === outletId);
  }

  return pool
    .filter(
      (c) =>
        c.name.toLowerCase().includes(trimmed) ||
        c.contact.toLowerCase().includes(trimmed)
    )
    .slice(0, limit);
}
