import type { Customer } from "@/handlers/customer";

export type CustomerMatchInput = {
  name: string;
  contact: string;
  outletId: string;
};

function normalizeContact(contact: string): string {
  return contact.trim().replace(/\s+/g, "");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Finds an existing customer for this outlet by contact (primary) or name + contact. */
export function findMatchingCustomer(
  customers: Customer[],
  input: CustomerMatchInput
): Customer | null {
  const outletId = input.outletId.trim();
  const contact = normalizeContact(input.contact);
  const name = normalizeName(input.name);
  if (!outletId || !contact) return null;

  const outletCustomers = customers.filter((c) => c.outletId === outletId);

  const byContact = outletCustomers.find(
    (c) => normalizeContact(c.contact) === contact
  );
  if (byContact) return byContact;

  if (!name) return null;

  return (
    outletCustomers.find(
      (c) =>
        normalizeName(c.name) === name && normalizeContact(c.contact) === contact
    ) ?? null
  );
}
