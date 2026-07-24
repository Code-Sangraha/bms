import { apiRequest, getApiErrorMessage } from "@/lib/api/client";
import { ITEM_INVENTORY_ROUTES } from "@/lib/api/routes";
import type { ApiResponse } from "@/lib/api/types";

export type ItemCategory = {
  id: string;
  name: string;
  status: boolean;
  outletId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryUnit = {
  id: string;
  name: string;
  symbol: string;
  status: boolean;
  outletId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  lowStockAlertQuantity: number;
  status: boolean;
  category: Pick<ItemCategory, "id" | "name">;
  unit: Pick<InventoryUnit, "id" | "name" | "symbol">;
  secondaryUnit?: Pick<InventoryUnit, "id" | "name" | "symbol"> | null;
  categoryId?: string;
  unitId?: string;
  secondaryUnitId?: string | null;
  conversionRate?: number | null;
  secondarySellingPrice?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryMovementType = "OPENING" | "RESTOCK" | "DEDUCT" | string;

export type InventoryMovement = {
  id: string;
  itemId: string;
  type: InventoryMovementType;
  quantity: number;
  resultingQuantity: number;
  buyingPrice?: number | null;
  sellingPrice?: number | null;
  note?: string | null;
  createdAt: string;
  item: Pick<InventoryItem, "id" | "name" | "category" | "unit">;
};

export type OpeningClosingRow = {
  itemId: string;
  name: string;
  category: Pick<ItemCategory, "id" | "name">;
  unit: Pick<InventoryUnit, "id" | "name" | "symbol">;
  openingStock: number;
  restocked: number;
  deducted: number;
  closingStock: number;
};

export type CreateItemPayload = {
  name: string;
  categoryId: string;
  unitId: string;
  secondaryUnitId?: string;
  conversionRate?: number;
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  secondarySellingPrice?: number;
  lowStockAlertQuantity: number;
  supplierId?: string;
  supplierName?: string;
  supplierContact?: string;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: "ADVANCE" | "PARTIAL" | "FULL";
  remarks?: string;
};

export type UpdateItemPayload = {
  id: string;
  name?: string;
  categoryId?: string;
  unitId?: string;
  secondaryUnitId?: string;
  conversionRate?: number;
  buyingPrice?: number;
  sellingPrice?: number;
  secondarySellingPrice?: number;
  lowStockAlertQuantity?: number;
  status?: boolean;
};

export type StockChangePayload = {
  id: string;
  quantity: number;
  buyingPrice?: number;
  sellingPrice?: number;
  note?: string;
  supplierId?: string;
  supplierName?: string;
  supplierContact?: string;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: "ADVANCE" | "PARTIAL" | "FULL";
  remarks?: string;
};

export type UpdateCategoryPayload = { id: string; name: string; status?: boolean };
export type UpdateUnitPayload = { id: string; name: string; symbol: string; status?: boolean };
export type InventoryHistoryParams = { itemId?: string; from?: string; to?: string };
export type OpeningClosingParams = { date?: string; itemId?: string };
export type InventoryOutlet = {
  id: string;
  name: string;
  contact?: string | null;
  itemCount: number;
  lowStockItemCount: number;
};
export type ItemSaleUnitType = "PRIMARY" | "SECONDARY";
export type ItemSalePaymentType = "PAID" | "CREDIT";
export type ItemSalePaymentMethod = "CASH" | "ONLINE" | "CHEQUE";
export type ItemSaleLinePayload = {
  itemId: string;
  unitType: ItemSaleUnitType;
  quantity: number;
  unitPrice?: number;
  amount?: number;
};
export type CreateItemSalePayload = {
  customerName?: string;
  customerContact?: string;
  paymentType?: ItemSalePaymentType;
  paymentMethod?: ItemSalePaymentMethod;
  creditorId?: string;
  note?: string;
  items: ItemSaleLinePayload[];
};
export type ItemSaleLine = ItemSaleLinePayload & {
  id: string;
  quantityInPrimary: number;
  unitPrice: number;
  amount: number;
  conversionRate?: number | null;
  item: Pick<InventoryItem, "id" | "name" | "quantity" | "unit" | "secondaryUnit">;
};
export type ItemSale = {
  id: string;
  transactionId: string;
  outletId?: string;
  customerName?: string | null;
  customerContact?: string | null;
  paymentType: ItemSalePaymentType;
  paymentMethod?: ItemSalePaymentMethod | null;
  creditorId?: string | null;
  creditor?: { id: string; name: string } | null;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  lines: ItemSaleLine[];
};

function objectRow(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeItemCategory(value: unknown): ItemCategory | null {
  const row = objectRow(value);
  const id = textValue(row?.id);
  const name = textValue(row?.name);
  if (!row || !id || !name) return null;
  return {
    id,
    name,
    status: typeof row.status === "boolean" ? row.status : true,
    outletId: textValue(row.outletId) ?? undefined,
    createdAt: textValue(row.createdAt) ?? undefined,
    updatedAt: textValue(row.updatedAt) ?? undefined,
  };
}

export function normalizeInventoryUnit(value: unknown): InventoryUnit | null {
  const row = objectRow(value);
  const id = textValue(row?.id);
  const name = textValue(row?.name);
  const symbol = textValue(row?.symbol);
  if (!row || !id || !name || !symbol) return null;
  return {
    id,
    name,
    symbol,
    status: typeof row.status === "boolean" ? row.status : true,
    outletId: textValue(row.outletId) ?? undefined,
    createdAt: textValue(row.createdAt) ?? undefined,
    updatedAt: textValue(row.updatedAt) ?? undefined,
  };
}

export function normalizeInventoryItem(value: unknown): InventoryItem | null {
  const row = objectRow(value);
  const category = normalizeItemCategory(row?.category);
  const unit = normalizeInventoryUnit(row?.unit);
  const secondaryUnit = row?.secondaryUnit == null ? null : normalizeInventoryUnit(row.secondaryUnit);
  const id = textValue(row?.id);
  const name = textValue(row?.name);
  const quantity = numberValue(row?.quantity);
  const buyingPrice = numberValue(row?.buyingPrice);
  const sellingPrice = numberValue(row?.sellingPrice);
  const threshold = numberValue(row?.lowStockAlertQuantity);
  if (!row || !id || !name || !category || !unit || quantity == null || buyingPrice == null || sellingPrice == null || threshold == null) return null;
  return {
    id,
    name,
    quantity,
    buyingPrice,
    sellingPrice,
    lowStockAlertQuantity: threshold,
    status: typeof row.status === "boolean" ? row.status : true,
    category: { id: category.id, name: category.name },
    unit: { id: unit.id, name: unit.name, symbol: unit.symbol },
    secondaryUnit: secondaryUnit
      ? { id: secondaryUnit.id, name: secondaryUnit.name, symbol: secondaryUnit.symbol }
      : null,
    secondaryUnitId: textValue(row.secondaryUnitId),
    conversionRate: numberValue(row.conversionRate),
    secondarySellingPrice: numberValue(row.secondarySellingPrice),
    categoryId: textValue(row.categoryId) ?? category.id,
    unitId: textValue(row.unitId) ?? unit.id,
    createdAt: textValue(row.createdAt) ?? undefined,
    updatedAt: textValue(row.updatedAt) ?? undefined,
  };
}

export function normalizeInventoryMovement(value: unknown): InventoryMovement | null {
  const row = objectRow(value);
  const itemRow = objectRow(row?.item);
  const category = normalizeItemCategory(itemRow?.category);
  const unit = normalizeInventoryUnit(itemRow?.unit);
  const id = textValue(row?.id);
  const itemId = textValue(row?.itemId) ?? textValue(itemRow?.id);
  const itemName = textValue(itemRow?.name);
  const type = textValue(row?.type);
  const quantity = numberValue(row?.quantity);
  const resultingQuantity = numberValue(row?.resultingQuantity ?? row?.quantityAfter ?? row?.resultingStock);
  const createdAt = textValue(row?.createdAt);
  if (!row || !itemRow || !id || !itemId || !itemName || !type || !category || !unit || quantity == null || resultingQuantity == null || !createdAt) return null;
  return {
    id,
    itemId,
    type,
    quantity,
    resultingQuantity,
    buyingPrice: numberValue(row.buyingPrice),
    sellingPrice: numberValue(row.sellingPrice),
    note: textValue(row.note),
    createdAt,
    item: {
      id: itemId,
      name: itemName,
      category: { id: category.id, name: category.name },
      unit: { id: unit.id, name: unit.name, symbol: unit.symbol },
    },
  };
}

export function normalizeOpeningClosingRow(value: unknown): OpeningClosingRow | null {
  const row = objectRow(value);
  const category = normalizeItemCategory(row?.category);
  const unit = normalizeInventoryUnit(row?.unit);
  const itemId = textValue(row?.itemId);
  const name = textValue(row?.name);
  const openingStock = numberValue(row?.openingStock);
  const restocked = numberValue(row?.restocked);
  const deducted = numberValue(row?.deducted);
  const closingStock = numberValue(row?.closingStock);
  if (!row || !itemId || !name || !category || !unit || openingStock == null || restocked == null || deducted == null || closingStock == null) return null;
  return {
    itemId,
    name,
    category: { id: category.id, name: category.name },
    unit: { id: unit.id, name: unit.name, symbol: unit.symbol },
    openingStock,
    restocked,
    deducted,
    closingStock,
  };
}

function normalizedList<T>(value: unknown, normalize: (row: unknown) => T | null): T[] {
  return Array.isArray(value)
    ? value.map(normalize).filter((row): row is T => row !== null)
    : [];
}
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

function logicalFailure<T>(payload: ApiResponse<T>): Result<T> | null {
  if (payload.success !== false) return null;
  return { ok: false, error: getApiErrorMessage(payload), status: 400 };
}

async function requestData<T>(route: string, options?: RequestInit): Promise<Result<T>> {
  const result = await apiRequest<ApiResponse<T>>(route, options);
  if (!result.ok) return result;
  const failure = logicalFailure(result.data);
  if (failure) return failure;
  return { ok: true, data: result.data.data as T };
}


function withQuery(route: string, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `${route}?${encoded}` : route;
}

function scoped(route: string, outletId: string): string {
  return withQuery(route, { outletId });
}

export async function getInventoryOutlets(): Promise<Result<InventoryOutlet[]>> {
  const result = await requestData<InventoryOutlet[]>(ITEM_INVENTORY_ROUTES.OUTLETS);
  if (!result.ok) return result;
  return {
    ok: true,
    data: Array.isArray(result.data)
      ? result.data.filter((row) => row && typeof row.id === "string" && typeof row.name === "string")
      : [],
  };
}

export async function getItemCategories(outletId: string): Promise<Result<ItemCategory[]>> {
  const result = await requestData<ItemCategory[]>(scoped(ITEM_INVENTORY_ROUTES.CATEGORIES, outletId));
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeItemCategory) } : result;
}

export function createItemCategory(outletId: string, payload: { name: string }) {
  return requestData<ItemCategory>(scoped(ITEM_INVENTORY_ROUTES.CATEGORIES, outletId), {
    method: "POST",
    body: JSON.stringify({ name: payload.name.trim() }),
  });
}

export function updateItemCategory(outletId: string, payload: UpdateCategoryPayload) {
  return requestData<ItemCategory>(scoped(ITEM_INVENTORY_ROUTES.CATEGORIES, outletId), {
    method: "PUT",
    body: JSON.stringify({ ...payload, name: payload.name.trim() }),
  });
}

export function deleteItemCategory(outletId: string, id: string) {
  return requestData<null>(scoped(`${ITEM_INVENTORY_ROUTES.CATEGORIES}/${encodeURIComponent(id)}`, outletId), {
    method: "DELETE",
  });
}

export async function getInventoryUnits(outletId: string): Promise<Result<InventoryUnit[]>> {
  const result = await requestData<InventoryUnit[]>(scoped(ITEM_INVENTORY_ROUTES.UNITS, outletId));
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeInventoryUnit) } : result;
}

export function createInventoryUnit(outletId: string, payload: { name: string; symbol: string }) {
  return requestData<InventoryUnit>(scoped(ITEM_INVENTORY_ROUTES.UNITS, outletId), {
    method: "POST",
    body: JSON.stringify({ name: payload.name.trim(), symbol: payload.symbol.trim() }),
  });
}

export function updateInventoryUnit(outletId: string, payload: UpdateUnitPayload) {
  return requestData<InventoryUnit>(scoped(ITEM_INVENTORY_ROUTES.UNITS, outletId), {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      name: payload.name.trim(),
      symbol: payload.symbol.trim(),
    }),
  });
}

export function deleteInventoryUnit(outletId: string, id: string) {
  return requestData<null>(scoped(`${ITEM_INVENTORY_ROUTES.UNITS}/${encodeURIComponent(id)}`, outletId), {
    method: "DELETE",
  });
}

export async function getInventoryItems(outletId: string): Promise<Result<InventoryItem[]>> {
  const result = await requestData<InventoryItem[]>(scoped(ITEM_INVENTORY_ROUTES.ITEMS, outletId));
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeInventoryItem) } : result;
}

export async function getInventoryItem(outletId: string, id: string): Promise<Result<InventoryItem | null>> {
  const result = await requestData<InventoryItem | null>(
    scoped(`${ITEM_INVENTORY_ROUTES.ITEMS}/${encodeURIComponent(id)}`, outletId)
  );
  if (!result.ok || result.data == null) return result;
  const item = normalizeInventoryItem(result.data);
  return item ? { ok: true, data: item } : { ok: false, error: "Invalid inventory item response.", status: 422 };
}

export function createInventoryItem(outletId: string, payload: CreateItemPayload) {
  return requestData<InventoryItem>(scoped(ITEM_INVENTORY_ROUTES.ITEMS, outletId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInventoryItem(outletId: string, payload: UpdateItemPayload) {
  return requestData<InventoryItem>(scoped(ITEM_INVENTORY_ROUTES.ITEMS, outletId), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteInventoryItem(outletId: string, id: string) {
  return requestData<null>(scoped(`${ITEM_INVENTORY_ROUTES.ITEMS}/${encodeURIComponent(id)}`, outletId), {
    method: "DELETE",
  });
}

export function restockInventoryItem(outletId: string, payload: StockChangePayload) {
  return requestData<InventoryItem>(scoped(ITEM_INVENTORY_ROUTES.RESTOCK, outletId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deductInventoryItem(outletId: string, payload: Pick<StockChangePayload, "id" | "quantity" | "note">) {
  return requestData<InventoryItem>(scoped(ITEM_INVENTORY_ROUTES.DEDUCT, outletId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getInventoryHistory(
  outletId: string,
  params: InventoryHistoryParams = {}
): Promise<Result<InventoryMovement[]>> {
  const route = withQuery(ITEM_INVENTORY_ROUTES.HISTORY, { outletId, ...params });
  const result = await requestData<InventoryMovement[]>(route);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeInventoryMovement) } : result;
}

export async function getOpeningClosing(
  outletId: string,
  params: OpeningClosingParams = {}
): Promise<Result<OpeningClosingRow[]>> {
  const route = withQuery(ITEM_INVENTORY_ROUTES.OPENING_CLOSING, { outletId, ...params });
  const result = await requestData<OpeningClosingRow[]>(route);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeOpeningClosingRow) } : result;
}

function normalizeItemSale(value: unknown): ItemSale | null {
  const row = objectRow(value);
  const id = textValue(row?.id);
  const transactionId = textValue(row?.transactionId);
  const paymentType = textValue(row?.paymentType);
  const totalAmount = numberValue(row?.totalAmount);
  const createdAt = textValue(row?.createdAt);
  if (!row || !id || !transactionId || (paymentType !== "PAID" && paymentType !== "CREDIT") || totalAmount == null || !createdAt) return null;
  const lines: ItemSaleLine[] = Array.isArray(row.lines)
    ? row.lines.map<ItemSaleLine | null>((value) => {
        const line = objectRow(value);
        const itemRow = objectRow(line?.item);
        const itemUnit = normalizeInventoryUnit(itemRow?.unit);
        const itemSecondaryUnit = itemRow?.secondaryUnit == null ? null : normalizeInventoryUnit(itemRow.secondaryUnit);
        const itemRecord = itemRow && textValue(itemRow.id) && textValue(itemRow.name) && numberValue(itemRow.quantity) != null && itemUnit
          ? {
              id: textValue(itemRow.id)!,
              name: textValue(itemRow.name)!,
              quantity: numberValue(itemRow.quantity)!,
              unit: { id: itemUnit.id, name: itemUnit.name, symbol: itemUnit.symbol },
              secondaryUnit: itemSecondaryUnit ? { id: itemSecondaryUnit.id, name: itemSecondaryUnit.name, symbol: itemSecondaryUnit.symbol } : null,
            }
          : null;
        const lineId = textValue(line?.id);
        const itemId = textValue(line?.itemId);
        const unitType = textValue(line?.unitType);
        const quantity = numberValue(line?.quantity);
        const quantityInPrimary = numberValue(line?.quantityInPrimary);
        const unitPrice = numberValue(line?.unitPrice);
        const amount = numberValue(line?.amount);
        if (!line || !itemRecord || !lineId || !itemId || (unitType !== "PRIMARY" && unitType !== "SECONDARY") || quantity == null || quantityInPrimary == null || unitPrice == null || amount == null) return null;
        return { id: lineId, itemId, item: itemRecord, unitType, quantity, quantityInPrimary, unitPrice, amount, conversionRate: numberValue(line.conversionRate) };
      }).filter((line): line is ItemSaleLine => line !== null)
    : [];
  const creditor = objectRow(row.creditor);
  return {
    id,
    transactionId,
    outletId: textValue(row.outletId) ?? undefined,
    customerName: textValue(row.customerName),
    customerContact: textValue(row.customerContact),
    paymentType,
    paymentMethod: textValue(row.paymentMethod) as ItemSalePaymentMethod | null,
    creditorId: textValue(row.creditorId),
    creditor: creditor && textValue(creditor.id) && textValue(creditor.name) ? { id: textValue(creditor.id)!, name: textValue(creditor.name)! } : null,
    totalAmount,
    note: textValue(row.note),
    createdAt,
    lines,
  };
}

export async function createItemSale(payload: CreateItemSalePayload): Promise<Result<ItemSale>> {
  const result = await requestData<ItemSale>(ITEM_INVENTORY_ROUTES.SALES, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) return result;
  const sale = normalizeItemSale(result.data);
  return sale ? { ok: true, data: sale } : { ok: false, error: "Invalid item sale response.", status: 422 };
}

export async function getItemSales(): Promise<Result<ItemSale[]>> {
  const result = await requestData<ItemSale[]>(ITEM_INVENTORY_ROUTES.SALES);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeItemSale) } : result;
}

export async function getItemSale(id: string): Promise<Result<ItemSale | null>> {
  const result = await requestData<ItemSale | null>(`${ITEM_INVENTORY_ROUTES.SALES}/${encodeURIComponent(id)}`);
  if (!result.ok || result.data == null) return result;
  const sale = normalizeItemSale(result.data);
  return sale ? { ok: true, data: sale } : { ok: false, error: "Invalid item sale response.", status: 422 };
}
