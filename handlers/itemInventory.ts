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
  categoryId?: string;
  unitId?: string;
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
  quantity: number;
  buyingPrice: number;
  sellingPrice: number;
  lowStockAlertQuantity: number;
};

export type UpdateItemPayload = {
  id: string;
  name?: string;
  categoryId?: string;
  unitId?: string;
  buyingPrice?: number;
  sellingPrice?: number;
  lowStockAlertQuantity?: number;
  status?: boolean;
};

export type StockChangePayload = {
  id: string;
  quantity: number;
  buyingPrice?: number;
  sellingPrice?: number;
  note?: string;
};

export type UpdateCategoryPayload = { id: string; name: string; status?: boolean };
export type UpdateUnitPayload = { id: string; name: string; symbol: string; status?: boolean };
export type InventoryHistoryParams = { itemId?: string; from?: string; to?: string };
export type OpeningClosingParams = { date?: string; itemId?: string };

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

export async function getItemCategories(): Promise<Result<ItemCategory[]>> {
  const result = await requestData<ItemCategory[]>(ITEM_INVENTORY_ROUTES.CATEGORIES);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeItemCategory) } : result;
}

export function createItemCategory(payload: { name: string }) {
  return requestData<ItemCategory>(ITEM_INVENTORY_ROUTES.CATEGORIES, {
    method: "POST",
    body: JSON.stringify({ name: payload.name.trim() }),
  });
}

export function updateItemCategory(payload: UpdateCategoryPayload) {
  return requestData<ItemCategory>(ITEM_INVENTORY_ROUTES.CATEGORIES, {
    method: "PUT",
    body: JSON.stringify({ ...payload, name: payload.name.trim() }),
  });
}

export function deleteItemCategory(id: string) {
  return requestData<null>(`${ITEM_INVENTORY_ROUTES.CATEGORIES}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getInventoryUnits(): Promise<Result<InventoryUnit[]>> {
  const result = await requestData<InventoryUnit[]>(ITEM_INVENTORY_ROUTES.UNITS);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeInventoryUnit) } : result;
}

export function createInventoryUnit(payload: { name: string; symbol: string }) {
  return requestData<InventoryUnit>(ITEM_INVENTORY_ROUTES.UNITS, {
    method: "POST",
    body: JSON.stringify({ name: payload.name.trim(), symbol: payload.symbol.trim() }),
  });
}

export function updateInventoryUnit(payload: UpdateUnitPayload) {
  return requestData<InventoryUnit>(ITEM_INVENTORY_ROUTES.UNITS, {
    method: "PUT",
    body: JSON.stringify({
      ...payload,
      name: payload.name.trim(),
      symbol: payload.symbol.trim(),
    }),
  });
}

export function deleteInventoryUnit(id: string) {
  return requestData<null>(`${ITEM_INVENTORY_ROUTES.UNITS}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getInventoryItems(): Promise<Result<InventoryItem[]>> {
  const result = await requestData<InventoryItem[]>(ITEM_INVENTORY_ROUTES.ITEMS);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeInventoryItem) } : result;
}

export async function getInventoryItem(id: string): Promise<Result<InventoryItem | null>> {
  const result = await requestData<InventoryItem | null>(
    `${ITEM_INVENTORY_ROUTES.ITEMS}/${encodeURIComponent(id)}`
  );
  if (!result.ok || result.data == null) return result;
  const item = normalizeInventoryItem(result.data);
  return item ? { ok: true, data: item } : { ok: false, error: "Invalid inventory item response.", status: 422 };
}

export function createInventoryItem(payload: CreateItemPayload) {
  return requestData<InventoryItem>(ITEM_INVENTORY_ROUTES.ITEMS, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateInventoryItem(payload: UpdateItemPayload) {
  return requestData<InventoryItem>(ITEM_INVENTORY_ROUTES.ITEMS, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteInventoryItem(id: string) {
  return requestData<null>(`${ITEM_INVENTORY_ROUTES.ITEMS}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function restockInventoryItem(payload: StockChangePayload) {
  return requestData<InventoryItem>(ITEM_INVENTORY_ROUTES.RESTOCK, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deductInventoryItem(payload: StockChangePayload) {
  return requestData<InventoryItem>(ITEM_INVENTORY_ROUTES.DEDUCT, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getInventoryHistory(
  params: InventoryHistoryParams = {}
): Promise<Result<InventoryMovement[]>> {
  const route = withQuery(ITEM_INVENTORY_ROUTES.HISTORY, params);
  const result = await requestData<InventoryMovement[]>(route);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeInventoryMovement) } : result;
}

export async function getOpeningClosing(
  params: OpeningClosingParams = {}
): Promise<Result<OpeningClosingRow[]>> {
  const route = withQuery(ITEM_INVENTORY_ROUTES.OPENING_CLOSING, params);
  const result = await requestData<OpeningClosingRow[]>(route);
  return result.ok ? { ok: true, data: normalizedList(result.data, normalizeOpeningClosingRow) } : result;
}