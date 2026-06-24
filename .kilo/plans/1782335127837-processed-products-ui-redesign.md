# Processed Products — UI/UX Redesign Plan

## Goal
Redesign the **Processed Products list page** (`app/dashboard/product/processedProduct/page.tsx`) and the **Processed Product detail page** (`ProcessedProductDetailPage.tsx`) to match the rest of the app: full shadcn component usage, consistent design tokens, and improved UX. The rest of the app already uses `@/app/components/ui/*` and `@/app/components/ui-ext/*` (PageHeader, DataTable, ConfirmDialog, EmptyState, ErrorState, TableSkeleton). The processed pages are the outliers — they use hand-rolled SCSS divs, the legacy `Modal`, native `<select>`, and a portal-based custom row menu.

## Subject & design point of view (per frontend-design skill)
- **Subject:** Processed inventory — finished goods (e.g. deboned meat cuts) that sit in storage after processing, tracked by weight, sold and deducted across outlets.
- **Audience:** Inventory managers and outlet operators in a meat-processing BMS. They scan the list to find a product, check its current weight, then restock, deduct, view, edit, or delete it.
- **Page's single job:** Make the current stock state and the next action on each product obvious in one glance.
- **Visual direction:** Stay inside the existing Highland-green token system (`--brand-*`, neutral surfaces). No new palette — the brief is internal-tool consistency, not a rebrand. The signature move is **type discipline + a weight-forward table**, not a decorative accent.

## Design tokens (already defined in `app/globals.css` — reuse, don't redefine)
- Background `#ffffff`, foreground `#0f172a`, card `#ffffff`.
- Primary = brand green `#02955a` (with `brand-50` accent surface, `brand-700` accent-foreground).
- Muted `#f5f6f8`, muted-foreground `#6b7280`, border `rgba(15,23,42,0.08)`.
- Destructive `#dc2626`. Inter Variable for sans; mono for numeric IDs/weights.
- Radius `0.625rem`. No new hex values in component code — everything via `bg-primary`, `text-muted-foreground`, etc.

## Type & layout decisions
- Use the existing `PageHeader` (title + subtitle + actions slot) on both pages. Drop the bespoke `.processedProductHeader` / `.breadcrumb` SCSS blocks.
- Tabs: replace the custom `.liveProductTabs` buttons with shadcn `Tabs` (`TabsList` + `TabsTrigger`), keeping the two-tab structure (Inventory / Opening & Closing) on the list page.
- List table: replace the hand-rolled `div.productsRow` grid with `ui-ext/DataTable`. Columns: **Name** (bold, row-click navigates to detail), **Type** (muted), **Outlet** (muted), **Weight** (mono, right-aligned, `tabular-nums` — this is the signature emphasis), **Actions** (DropdownMenu).
- Detail page: keep the existing `livestockDetailCard` shell but restyle actions to shadcn `Button` (variant `outline` for restock, `outline` + destructive text for reduce). Keep the sales panel but rebuild its inner table with shadcn `Table`/`DataTable` and put the total revenue in a `Badge`-style summary.

## Component mapping (shadcn everywhere)

### List page (`page.tsx`)
| Current | Replacement |
|---|---|
| `.breadcrumb` span text | `Breadcrumb` from `ui/breadcrumb` (or a plain muted text inside `PageHeader.breadcrumb`) |
| `.processedProductHeader` + `.pageTitle`/`.pageSubtitle` | `ui-ext/PageHeader` |
| Native `<select>` outlet filter | `ui/Select` (SelectTrigger/Content/Item), wrapped in a `FormField`-style label |
| `.processedProductSearch` input + emoji icon | `ui/Input` with a `lucide-react` `Search` icon via an `InputGroup`/relative wrapper |
| `.liveProductTabs` custom buttons | `ui/Tabs` |
| `div.productsTable` + `div.productsRow` grid | `ui-ext/DataTable` |
| Portal-based `rowMenuDropdown` + `rowMenuItem` buttons | `ui/dropdown-menu` `DropdownMenu` / `DropdownMenuTrigger` / `DropdownMenuContent` / `DropdownMenuItem` (delete item uses `variant="destructive"`). Delete all the `openRowMenu` / `computeRowMenuPosition` portal logic. |
| Legacy `Modal` (deduct) | `ui/dialog` `Dialog` (+ `Sheet` on mobile, mirroring `ui-ext/ConfirmDialog`) |
| `input[type=number]` deduct weight | `ui/Input` inside the new dialog |
| `WasteProductSelect` | Keep as-is (it wraps `Select` already) but render inside the new Dialog |
| `ConfirmModal` (delete) | `ui-ext/ConfirmDialog` |
| `Pagination` | Keep current `app/components/Pagination/Pagination` (already styled for the app); pass via `DataTable.footer` |

### Detail page (`ProcessedProductDetailPage.tsx`)
| Current | Replacement |
|---|---|
| `.breadcrumb` | `ui/breadcrumb` |
| `inventoryDetailHeader` h1 | `ui-ext/PageHeader` |
| `livestockDetailBtnGhost` buttons | `ui/Button` (variant `outline`, size `sm`) with `Plus`/`Minus` lucide icons |
| `ProcessedProductSalesPanel` inner `<table>` | `ui-ext/DataTable`; total-revenue summary → `ui/Card` header with a `ui/Badge` |
| `ProcessedProductRestockDetailModal` (legacy `Modal`) | New shadcn `Dialog` (+`Sheet` on mobile) using `DialogHeader/Title/Description`, `ui/Input`, `ui/Button`; keep the `react-hook-form` + zod logic intact |
| `ProcessedProductReduceDetailModal` (legacy `Modal`) | Same Dialog/Sheet treatment; keep `WasteProductSelect` |

## Mobile / responsive
- `ConfirmDialog` already switches Dialog→Sheet on mobile via `useIsMobile`; the new action modals must follow the same pattern. Create one small shared helper `ProcessedActionDialog` (or reuse `ResponsiveOverlay` from `ui-ext` if it fits) so restock/reduce/deduct share the Dialog/Sheet swap and we don't triplicate the logic.
- `DataTable` is responsive by default; on narrow screens the existing custom `processedRowData` card-grid SCSS is replaced by `DataTable`'s standard responsive behavior. Verify the weight column stays visible (it's the page's reason for existing).
- Remove the `@media (max-width: 768px)` card-grid block from `processedProduct.scss` once `DataTable` is in.

## Motion
- Rely on `tw-animate-css` defaults already wired into `Dialog`/`DropdownMenu`/`Tabs` (fade/scale on open). Do **not** add custom keyframes or scroll-reveal — the brief is an inventory tool; ambient animation would read as AI-generated. `prefers-reduced-motion` is already respected by the radix primitives.

## Files to change
1. `app/dashboard/product/processedProduct/page.tsx` — rewrite list UI with shadcn; delete `openRowMenu` portal logic, `computeRowMenuPosition` import, and `rowMenuPortalRef`.
2. `app/dashboard/product/processedProduct/ProcessedProductDetailPage.tsx` — PageHeader, Buttons, keep detail content + history + sales panel.
3. `app/dashboard/product/processedProduct/ProcessedProductSalesPanel.tsx` — swap inner table for `DataTable`, header to `Card`+`Badge`.
4. `app/dashboard/product/processedProduct/ProcessedProductRestockDetailModal.tsx` — replace `Modal` with shared `ProcessedActionDialog`; use `Input` + `Button`.
5. `app/dashboard/product/processedProduct/ProcessedProductReduceDetailModal.tsx` — same; keep `WasteProductSelect`.
6. **New** `app/dashboard/product/processedProduct/ProcessedActionDialog.tsx` — shared Dialog/Sheet wrapper (props: `isOpen`, `onClose`, `title`, `subtitle`, `children`, `footer`, `loading`).
7. `app/dashboard/product/processedProduct/processedProduct.scss` — delete dead rules (header, table, row menu, modal, sales table, mobile card-grid). Keep only tokens still referenced by shared `inventoryDetailPage.scss`/`livestockDetailShell.scss` if any; otherwise delete the file and its `import`.

## Out of scope (explicit)
- The deduct modal on the **list** page stays a Dialog (it's already a deduct action), but we do **not** unify it with the detail page's reduce modal into one component beyond the shared `ProcessedActionDialog` shell — they have different props (list one is non-hook-form; detail reduce is hook-form). Keep them separate, share only the shell.
- `OpeningStockTable` / `ClosingStockTable` (opening-closing tab) are **not** redesigned — they live in `liveProduct/components` and are shared with the live products page. Leave them; only restyle the tab *chrome* (the date picker row → `Input` + `Button`).
- No backend, handler, or schema changes. No new dependencies. No new design tokens.

## Risks & watch-facts
- **Row action permissions** (`capabilities.canEditProducts`, `canDeductProcessedInventory`, `canDeleteProducts`) gate menu items — preserve each `DropdownMenuItem`'s conditional render exactly.
- **Navigation state**: the View action passes `state: { productSnapshot }` and forwards `location.search` (outlet scope). Preserve this in `DataTable`'s `onRowClick` and the View menu item.
- **Query invalidation keys** (`["processedInventoryHistory"]`, `["processedOpeningStock"]`, `["salesByProductId"]`, `WASTE_PRODUCTS_QUERY_KEY`) must stay identical.
- **Opening-closing tab logic** (client-vs-server authoritative stock merge, `clientStockMode`, debug logging) is untouched — only its UI chrome changes.
- **i18n**: keep all `t(...)` wrappers; do not hardcode English strings.
- **Selector specificity**: the current SCSS mixes `.productsRow` (type-like) and `.processedRowWithActions` classes, which is the trap the skill warns about. By moving to `DataTable` + Tailwind utility classes we sidestep the conflict entirely — no competing `.section`/`.cta` style overrides.

## Validation
1. `npm run lint` — eslint passes.
2. `npx tsc --noEmit` — TypeScript compiles (use `tsc` directly per allowed commands).
3. Manual (dev server) checks:
   - List page: filter by outlet, search, paginate, open row dropdown, each permissioned item works, View navigates to detail with correct state, Delete confirms via `ConfirmDialog`, deduct modal opens and submits.
   - Opening & closing tab: date range pickers render as `Input`, Today button works, tables render.
   - Detail page: restock + reduce dialogs open (desktop Dialog, mobile Sheet), submit shows toast and invalidates queries; sales panel shows total revenue badge; history panel renders.
   - Responsive: confirm at 375px width that the weight column and action menu remain reachable.
4. Verify no leftover `processedProduct.scss` rules break sibling pages that `@use` the opening-closing partial.

## Open question for implementer
- Whether to delete `processedProduct.scss` entirely or keep the `@use "../liveProduct/openingClosingStock";` forward (needed if other SCSS still references opening-closing styles). Check `liveProduct.scss` consumers before removing.
