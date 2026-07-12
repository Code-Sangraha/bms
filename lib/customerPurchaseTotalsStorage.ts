export type CustomerPurchaseTotalsInput = {
  name: string;
  contact?: string | null;
  outletId: string;
};

export type CustomerPurchaseTotals = CustomerPurchaseTotalsInput & {
  contact: string;
  totalWeightBought: number;
  totalAmountSpent: number;
  totalTransactions: number;
  updatedAt: string;
};

export type CustomerPurchaseTotalsPurchase = CustomerPurchaseTotalsInput & {
  weightBought: number;
  amountSpent: number;
};

const STORAGE_KEY = "bms:temp-customer-purchase-totals:v1";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeContact(contact?: string | null): string {
  return (contact ?? "").trim().replace(/\s+/g, "");
}

function storageKeyForCustomer(input: CustomerPurchaseTotalsInput): string | null {
  const outletId = input.outletId.trim();
  if (!outletId) return null;

  const contact = normalizeContact(input.contact);
  if (contact) return `${outletId}:contact:${contact}`;

  const name = normalizeName(input.name);
  if (!name) return null;
  return `${outletId}:name:${name}`;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStore(storage: Storage): Record<string, CustomerPurchaseTotals> {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, CustomerPurchaseTotals>;
  } catch {
    return {};
  }
}

function writeStore(storage: Storage, store: Record<string, CustomerPurchaseTotals>): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

// TEMP: localStorage customer totals until backend get-by-customer is scoped and authoritative.
export function recordCustomerPurchaseTotals(
  purchase: CustomerPurchaseTotalsPurchase,
  storage: Storage | null = getStorage()
): CustomerPurchaseTotals | null {
  if (!storage) return null;

  const key = storageKeyForCustomer(purchase);
  if (!key) return null;

  const store = readStore(storage);
  const previous = store[key];
  const next: CustomerPurchaseTotals = {
    name: purchase.name.trim(),
    contact: normalizeContact(purchase.contact),
    outletId: purchase.outletId.trim(),
    totalWeightBought:
      safeNumber(previous?.totalWeightBought) + safeNumber(purchase.weightBought),
    totalAmountSpent:
      safeNumber(previous?.totalAmountSpent) + safeNumber(purchase.amountSpent),
    totalTransactions: safeNumber(previous?.totalTransactions) + 1,
    updatedAt: new Date().toISOString(),
  };

  store[key] = next;
  writeStore(storage, store);
  return next;
}

// TEMP: localStorage customer totals until backend get-by-customer is scoped and authoritative.
export function readCustomerPurchaseTotals(
  customer: CustomerPurchaseTotalsInput,
  storage: Storage | null = getStorage()
): CustomerPurchaseTotals | null {
  if (!storage) return null;

  const key = storageKeyForCustomer(customer);
  if (!key) return null;

  return readStore(storage)[key] ?? null;
}

export function mergeCustomerPurchaseTotals<
  T extends {
    totalWeightBought: number;
    totalAmountSpent: number;
    totalTransactions: number;
  },
>(summary: T, localTotals: CustomerPurchaseTotals | null): T {
  if (!localTotals) return summary;
  return {
    ...summary,
    totalWeightBought: Math.max(
      summary.totalWeightBought,
      localTotals.totalWeightBought
    ),
    totalAmountSpent: Math.max(
      summary.totalAmountSpent,
      localTotals.totalAmountSpent
    ),
    totalTransactions: Math.max(
      summary.totalTransactions,
      localTotals.totalTransactions
    ),
  };
}
