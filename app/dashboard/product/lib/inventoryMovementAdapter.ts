import type {
  LivestockInventoryHistoryEntry,
  ProcessedInventoryHistoryEntry,
} from "@/handlers/product";

export type InventoryMovementKind =
  | "PURCHASED"
  | "SOLD_OUTMARKET"
  | "SENT_TO_PROCESSING"
  | "PROCESSED_STOCK_IN"
  | "PROCESSED_SALE"
  | "TRANSFER_OR_DEDUCT";

export function mapLivestockHistory(row: LivestockInventoryHistoryEntry): InventoryMovementKind {
  if (row.type === "RESTOCK") return "PURCHASED";
  if (row.type === "SALE") return "SOLD_OUTMARKET";
  if (row.type === "SENT_TO_PROCESSING") return "SENT_TO_PROCESSING";
  return "TRANSFER_OR_DEDUCT";
}

export function mapProcessedHistory(row: ProcessedInventoryHistoryEntry): InventoryMovementKind {
  if (row.type === "RESTOCK" || row.type === "IN") return "PROCESSED_STOCK_IN";
  if (row.type === "SALE") return "PROCESSED_SALE";
  return "TRANSFER_OR_DEDUCT";
}

export function livestockMovementLabel(type: LivestockInventoryHistoryEntry["type"]): string {
  switch (type) {
    case "RESTOCK":
      return "Purchased / Stock Added";
    case "SALE":
      return "Sold Outmarket";
    case "SENT_TO_PROCESSING":
      return "Sent To Processing";
    case "DEDUCT":
      return "Manual Deduct";
    default:
      return type;
  }
}

export function processedMovementLabel(type: ProcessedInventoryHistoryEntry["type"]): string {
  switch (type) {
    case "RESTOCK":
    case "IN":
      return "Processed Stock In";
    case "SALE":
      return "Processed Sale";
    case "DEDUCT":
      return "Transfer / Deduct";
    default:
      return type;
  }
}
