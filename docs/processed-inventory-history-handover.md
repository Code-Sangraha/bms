# Processed Inventory History Handover

Date: 2026-05-17

## What We Were Working On

We aligned the frontend Processed Product Details history tabs with how the backend currently records processed product inventory history.

The target user flow is:

- Open a processed product details page, for example Chicken Wings.
- Show only that selected product's history in:
  - Storage History
  - Consumed History
  - Waste History
- Do not show a separate Deduct History tab on the processed product details page.

## Backend Behavior To Remember

Processed product history is driven mostly by `ProcessedInventoryHistory`.

- Storage History is `ProcessedInventoryHistory.type === "RESTOCK"`.
- Consumed History is `ProcessedInventoryHistory.type === "SALE"`.
- Deduct rows are `ProcessedInventoryHistory.type === "DEDUCT"`, but these should not appear as a separate tab on the processed product details page now.
- Waste History does not have a true processed waste list endpoint. True processing waste is stored on `ProcessingBatch.wasteWeight`.

Important backend caveats:

- `POST /v1/products/restock` increments `Product.weight` but does not create a `RESTOCK` history row.
- Sales create a `SALE` row and also call stock deduction, which creates a `DEDUCT` row. For consumed history, use only `SALE` to avoid double counting.
- Processed transfer creates `RESTOCK` for the destination product and `DEDUCT` for the source product.
- `/v1/products/processed/history` is a `GET`, but the backend reads filters from `req.body`, so Axios must send `data` in the GET request.

## Frontend Changes Done

### Processed details history tabs

File:

- `app/dashboard/product/components/InventoryDetailHistoryPanel.tsx`

Changes:

- Removed the processed-only Deduct History tab and panel.
- Processed product details now shows only:
  - Storage History
  - Consumed History
  - Waste History
- Storage History query is scoped to the selected product:
  - `productId: wasteHistoryId`
  - `type: "RESTOCK"`
- Consumed History query is scoped to the selected product:
  - `productId: wasteHistoryId`
  - `type: "SALE"`
- Waste History query is scoped to the selected product:
  - `getProcessedWasteHistory(wasteHistoryId, range)`
- For a product like Chicken Wings, all three tabs use that selected Chicken Wings `product.id`.

### Processed waste adapter

File:

- `handlers/product.ts`

Changes:

- Added `getProcessedWasteHistory(productId, range)`.
- It behaves like the existing livestock fake/adapted waste history.
- It calls processed inventory history without a type filter:
  - `/products/processed/history`
  - body includes `productId`, `fromDate`, `toDate`
- It maps returned movement rows into the existing waste table shape:
  - `date`
  - `quantity`
  - `remarks`
- This is not true processing waste. It is adapted movement history, intentionally matching how livestock waste currently works.

### Processed inventory history typing/parser

File:

- `lib/api/processedInventoryHistory.ts`

Changes:

- `ProcessedInventoryHistoryType` now matches backend enum:
  - `RESTOCK`
  - `DEDUCT`
  - `SALE`
- Removed old legacy `IN` handling.
- Added nested `product` parsing so rows can show product name from backend response.
- Continues using Axios GET with JSON body because the backend reads `req.body`.

### Processed movement/opening stock helpers

Files:

- `app/dashboard/product/lib/inventoryMovementAdapter.ts`
- `app/dashboard/product/processedProduct/lib/buildProcessedOpeningStockData.ts`

Changes:

- Removed legacy `IN` handling for processed stock-in.
- Processed stock-in is now only `RESTOCK`.
- `SALE` remains consumed movement.
- `DEDUCT` remains relevant internally for stock math, but no longer has a processed details tab.

### Processed product detail page

File:

- `app/dashboard/product/processedProduct/ProcessedProductDetailPage.tsx`

Changes:

- Removed the unused `processedCumulativeWasteKg` prop from the history panel.
- The panel still receives:
  - `variant="processed"`
  - `wasteHistoryId={product.id}`
  - `currentStockWeightKg={product.weight}`

## What Works Now

For a selected processed product such as Chicken Wings:

- Storage History shows only rows with:
  - selected Chicken Wings `product.id`
  - `type: "RESTOCK"`
- Consumed History shows only rows with:
  - selected Chicken Wings `product.id`
  - `type: "SALE"`
- Waste History shows adapted movement rows from:
  - selected Chicken Wings `product.id`
  - all processed history types returned in the selected date range

Build and tests passed after the changes:

- `npm run build`
- `npm run test`

Current test result:

- 1 test file passed
- 7 tests passed

## What Did Not Work / Known Limitations

Browser visual QA could not be completed earlier because the in-app browser blocked localhost URLs with:

- `net::ERR_BLOCKED_BY_CLIENT`

The Vite dev server did run after escalation and returned HTTP 200, but browser screenshot validation was blocked.

Processed Waste History is still not true waste:

- It is adapted from `/products/processed/history`.
- It does not read `ProcessingBatch.wasteWeight`.
- If true processed waste is needed later, add a backend endpoint such as:
  - `GET /v1/products/processed/waste-history?productId=&fromDate=&toDate=`
- That endpoint should query completed `ProcessingBatch` records with `wasteWeight`, include `outputs`, and filter batches where an output product matches the selected `productId`.

Livestock Waste History is also fake/adapted:

- `getLivestockWasteHistory` maps generic livestock inventory history rows into waste-shaped rows.
- Processed waste was intentionally made to behave the same way per request.

## Important User Expectation

If the user asks:

"On the Processed Product Details page for Chicken Wings, will I see only Chicken Wings history?"

The answer is yes:

- Storage is scoped by Chicken Wings `product.id`.
- Consumed is scoped by Chicken Wings `product.id`.
- Waste is scoped by Chicken Wings `product.id`, but is adapted movement history, not real batch waste.

## Files Currently Modified In This Workstream

- `app/dashboard/product/components/InventoryDetailHistoryPanel.tsx`
- `app/dashboard/product/lib/inventoryMovementAdapter.ts`
- `app/dashboard/product/processedProduct/ProcessedProductDetailPage.tsx`
- `app/dashboard/product/processedProduct/lib/buildProcessedOpeningStockData.ts`
- `handlers/product.ts`
- `lib/api/processedInventoryHistory.ts`
- `docs/processed-inventory-history-handover.md`

## Suggested Next Steps

1. Run the app locally and manually inspect a processed product detail page once browser access works.
2. Confirm the visible tabs are only Storage History, Consumed History, and Waste History.
3. Confirm requests for Chicken Wings pass only the Chicken Wings `productId`.
4. Decide whether fake/adapted waste is acceptable long-term.
5. If real waste is required, implement the backend processed waste-history endpoint and replace the frontend adapter.
