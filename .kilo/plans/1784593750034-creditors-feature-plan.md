# Creditors Feature — Implementation Plan

## Goal

Add a **Creditors** management page plus wire **"Pay Later"** into the three sale flows
(POS, Livestock Sales, Waste Sales) so a sale can be recorded on credit against a creditor,
and later settled via the creditors page.

Base API: `/v1/creditors` (auth: `Authorization: Bearer <token>`, handled by existing `apiRequest`).

## Confirmed decisions

1. **Scope** — Creditors page (list/search, add, detail, record payment) **+** Pay-Later
   wired into POS / livestock-sales / waste-sales checkouts.
2. **Pay-Later trigger model** — Create the sale first via existing `/sales/create`
   (stock deducted, transaction recorded), capture the returned `transactionId`, **then**
   `POST /v1/creditors/pay-later` with that id as `sourceTransactionId` + the creditor + items.
3. **Pay-Later UI** — Add a 4th segment **"Pay Later"** to `PaymentMethodPicker`. When
   selected, reveal a **CreditorPicker** combobox (search + inline quick-create). The
   underlying sale is created with `paymentMethod=CASH` (sentinel); pay-later is posted
   afterwards to record the debt.

## Other design choices (recommendations, confirm if disagreed)

- **Routes**: `/dashboard/invoices/creditors` (list) and `/dashboard/invoices/creditors/:creditorId` (detail). Mirrors `customers`, `customer-types`, `loyalty-rules`.
- **Detail view = dedicated route** (not modal) — it shows balance + order history + payment history + a "Record payment" modal, so a route is cleaner/shareable.
- **Search** — client-side filter of the fetched list (mirrors `customers` page). API `?search=` is available for future server-side use but not required now (no pagination params in spec).
- **Permissions** — mirror `customers`: no `capability` gating in sidebar; "Add Creditor" gated by `usePermissions().canCreate`. Pay-Later in sale flows inherits each page's existing capability gate (`canCreateProcessedSales` / `canCreateLivestockSales`).
- **mobileNav** — no change needed; `/dashboard/invoices/*` already maps to the "transactions" bottom tab.

---

## Task list

### 1. API route constants — `lib/api/routes.ts`

Add (after `CUSTOMER_ROUTES`):

```ts
export const CREDITOR_ROUTES = {
  LIST: "/creditors",                       // GET ?search=
  CREATE: "/creditors",                      // POST
  GET_BY_ID: "/creditors",                  // GET /:creditorId (built with template)
  PAY_LATER: "/creditors/pay-later",        // POST
  PAYMENTS: "/creditors",                   // POST /:creditorId/payments (built with template)
} as const;
```

Note: route strings are appended to base URL which already ends with `/v1`, so
`/creditors` → `…/v1/creditors`. Path-param routes are built at call site:
`/creditors/${encodeURIComponent(creditorId)}` and
`/creditors/${encodeURIComponent(creditorId)}/payments`.

### 2. Creditor zod schema — `schema/creditor.ts` (new)

```ts
import { z } from "zod";
export const creditorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  address: z.string().min(1, "Address is required").max(300, "Address is too long"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
});
export type CreditorFormValues = z.infer<typeof creditorSchema>;
```

### 3. Handler layer — `handlers/creditor.ts` (new)

Follow the `handlers/supplier.ts` / `handlers/customer.ts` pattern (use `apiRequest`,
`getApiErrorMessage`, return `{ ok: true, data } | { ok: false, error, status }`).

Exported types:

```ts
export type Creditor = {
  id: string; name: string; address: string; phone: string;
  createdAt?: string; updatedAt?: string;
};

export type CreditorDetail = Creditor & {
  totalAmount: number;
  pendingAmount: number;
  orders: CreditorOrder[];
  payments: CreditorPayment[];
};

export type CreditorOrder = {
  id?: string;
  sourceType?: "POS" | "LIVESTOCK" | "WASTE" | string;
  sourceTransactionId?: string;
  totalAmount?: number;
  outlet?: { id?: string; name?: string };
  items?: Array<Record<string, unknown>>;
  createdAt?: string;
};

export type CreditorPayment = {
  id?: string; amount: number; discountAmount?: number;
  paymentMethod?: string; reference?: string; createdAt?: string;
};

export type PayLaterSourceType = "POS" | "LIVESTOCK" | "WASTE";

export type PayLaterItem =
  | { productId: string; name: string; weight: number; unitPrice: number; amount: number }
  | { livestockItemId: string; name: string; quantity: number; amount: number }
  | { wasteProductId: string; name: string; weight: number; amount: number };

export type PayLaterPayload = {
  creditorId: string;
  sourceType: PayLaterSourceType;
  sourceTransactionId: string;
  items: PayLaterItem[];
  totalAmount: number;
};
```

Functions (all use `apiRequest` with `Authorization` injected automatically):

- `getCreditors(search?)` → `GET /creditors` (+ `?search=` if provided). Normalize list
  from `data` / `creditors` / top-level array. Defensive `parseCreditor`.
- `createCreditor(values: CreditorFormValues)` → `POST /creditors` body
  `{ name, address, phone }`. Return normalized created creditor.
- `getCreditorDetail(creditorId)` → `GET /creditors/:creditorId`. Normalize into
  `CreditorDetail` (coerce `totalAmount`/`pendingAmount` to numbers; default
  `orders`/`payments` to `[]`).
- `payCreditor(creditorId, { amount, discountAmount, paymentMethod, reference })` →
  `POST /creditors/:creditorId/payments`. `paymentMethod` is uppercase
  (`CASH`|`ONLINE`|`CHEQUE`) — reuse `toApiPaymentMethod` from `lib/salePaymentMethods`.
- `createCreditorPayLater(payload: PayLaterPayload)` → `POST /creditors/pay-later`.

**Add a test file** `handlers/creditor.test.ts` (vitest) covering `parseCreditor` /
list normalization and payload shaping, mirroring `handlers/supplier.test.ts` style.

### 4. Creditor list page — `app/dashboard/invoices/creditors/page.tsx` (new)

Clone the structure of `app/dashboard/invoices/customers/page.tsx`:

- `"use client"`; React Router + `@tanstack/react-query` + `react-hook-form` + zod.
- Breadcrumb `Sales & Billing › Creditors`; `pageTitle` "Creditors".
- Toolbar: `Search` input (client-side filter on name/phone/address) + "Add Creditor"
  button (gated by `canCreate`).
- Table columns: **Name, Phone, Address, Pending (Rs.), Created** + row actions dropdown
  (View details → navigate to `:creditorId`; Edit if `canUpdate`; Delete if `canDelete`).
  - Delete: there is **no delete endpoint** in the spec → omit Delete; keep Edit only if a
    backend update endpoint exists (spec has none). **Action: only "View details"** unless
    backend confirms update/delete. (See Open questions.)
- Empty/Error/Loading states via `EmptyState`, `ErrorState`, `TableSkeleton`.
- `Pagination` via `usePagination` / `paginate`.
- Add/Create modal: `react-hook-form` + `creditorSchema`, fields name/address/phone.
  On success: `invalidateQueries(["creditors"])`, toast, close modal.
- Query key: `["creditors"]`. On 401 → `navigate("/login")`.
- SCSS: `creditors.scss` (new) mirroring `customers.scss`.

### 5. Creditor detail page — `app/dashboard/invoices/creditors/[creditorId]/page.tsx`

> Note: this repo uses flat folder naming (e.g. `processedProduct/ProcessedProductDetailPage.tsx`),
> not Next.js dynamic-route folders. Use a component file
> `app/dashboard/invoices/creditors/CreditorDetailPage.tsx` and register a parametric route
> in `App.tsx` (see step 8).

- Read `creditorId` from `useParams()`. `useQuery(["creditor", creditorId], getCreditorDetail)`.
- Header: name, phone, address; a back link to `/dashboard/invoices/creditors`.
- **Balance cards**: Total Amount (`totalAmount`), Pending Amount (`pendingAmount`), Paid
  (computed `totalAmount - pendingAmount`).
- **Order history** table: date, source type badge (POS/LIVESTOCK/WASTE),
  source transaction id, outlet name, items count, amount. Each row expandable to show
  saved items (product/livestock/waste line details).
- **Payment history** table: date, amount, discount, payment method (use
  `paymentMethodLabel`), reference.
- **Record Payment** button → opens `Modal` with a `react-hook-form` form:
  `amount` (required, >0), `discountAmount` (optional, ≥0), `paymentMethod`
  (`PaymentMethodPicker` — CASH/ONLINE/CHEQUE), `reference` (optional text).
  Submit → `payCreditor(creditorId, …)`; on success toast + invalidate
  `["creditor", creditorId]` and `["creditors"]`.

### 6. CreditorPicker component — `app/dashboard/invoices/components/CreditorPicker.tsx` (new)

Reusable combobox modeled on `PosCustomerNameCombobox.tsx`:

- Props: `value` (creditorId), `onChange(creditor)`, `outletId?`, `t`.
- Queries `getCreditors(search)` with debounce (or filter client-side from a fetched list —
  pick the simpler client-side approach used elsewhere).
- Dropdown of creditors (name — phone). Selecting sets the creditor.
- **Inline quick-create**: a "＋ New creditor" row opens a small popover/modal with
  name/address/phone → `createCreditor` → on success select the new creditor and call
  `onChange`. Reuse `creditorSchema`.
- Exposes the selected creditor so the sale flow can read `creditorId` + name.

### 7. PaymentMethodPicker — add "Pay Later" segment

Edit `lib/salePaymentMethods.ts` and `app/dashboard/invoices/components/PaymentMethodPicker.tsx`:

- Introduce a UI-only concept of "pay later" **without** polluting the backend enum:
  - Add `PAY_LATER_UI_VALUE = "payLater"` as a string sentinel (NOT added to
    `SALE_PAYMENT_METHOD_OPTIONS` / `ApiPaymentMethod`).
  - Extend `PaymentMethodPicker` to render a 4th segment "Pay Later" when a new
    `allowPayLater?: boolean` prop is true. Internally represent the value as
    `SalePaymentMethod | "payLater"`.
- Add a `onPayLaterChange?(creditorId: string | null)`-style integration via the parent
  rather than inside the picker: the picker just reports `value === "payLater"`; the parent
  sale page conditionally renders `<CreditorPicker />` next to it and stores
  `payLaterCreditorId`.
- When `value === "payLater"`: parent must ensure a creditor is selected before checkout.

### 8. Routing & navigation

**`app/App.tsx`** — add imports + routes:

```tsx
import CreditorsPage from "./dashboard/invoices/creditors/page";
import CreditorDetailPage from "./dashboard/invoices/creditors/CreditorDetailPage";
…
<Route path="dashboard/invoices/creditors" element={<CreditorsPage />} />
<Route path="dashboard/invoices/creditors/:creditorId" element={<CreditorDetailPage />} />
```

**`app/components/Sidebar/Sidebar.tsx`** — add `creditors` to `TranslationKey` union,
`sidebarLabelMap` (`creditors: "Creditors"`), and insert a menu item into the Highland
`salesBilling` section (after `customers`):

```tsx
{ labelKey: "creditors", href: "/dashboard/invoices/creditors" },
```

Also add to `highlandPlantMenuSections` (plant-scoped) salesBilling items after `customers`
so outlet-scoped users see it.

**`app/dashboard/more/page.tsx`** — add a row to `otherLinks` for `accessTier === "global"`
and `accessTier === "outlet_manager"`:

```tsx
{ href: to("/dashboard/invoices/creditors"), label: t("Creditors"), icon: IoPeopleOutline },
```

### 9. Sale-flow wiring — POS (`app/dashboard/invoices/new/page.tsx`)

- Fetch creditors (`getCreditors`) into a query (`["creditors"]`).
- Add `allowPayLater` to `<PaymentMethodPicker … />` and local state
  `payLaterCreditorId: string | null`. Render `<CreditorPicker />` when
  `paymentMethod === "payLater"`.
- Keep `paymentMethod` state typed as `SalePaymentMethod | "payLater"`. In
  `buildSaleItems()` and `doCheckout()`:
  - Determine `effectivePaymentMethod: SalePaymentMethod = paymentMethod === "payLater"
    ? "cash" : paymentMethod` (the CASH sentinel).
  - Require `payLaterCreditorId` when pay-later; else block checkout with an error.
- In `createSaleMutation.mutationFn`, after a successful `createSale(saleItems)`:
  - Extract `sourceTransactionId` from the response. **`CreateSaleResponse` is loosely
    typed (`[key: string]: unknown`)** — read candidate fields
    `transactionId ?? id ?? data.transactionId ?? data.id`. If none found, surface a
    clear error ("Sale created but pay-later could not be linked: no transaction id").
    Add a small helper `extractTransactionId(res)` in `handlers/sale.ts` and re-export.
  - If pay-later: call `createCreditorPayLater({ creditorId, sourceType: "POS",
    sourceTransactionId, items: cart→POS items, totalAmount: totalDue })`.
    - POS item mapping: `{ productId, name: productName, weight, unitPrice, amount: lineSubtotal }`.
  - Invalidate `["creditors"]` and `["creditor", creditorId]` on success.
- Update `checkoutConfirmMessage` to show "Pay Later" + creditor name when applicable.
- `PaymentMethodPicker` value binding: pass `paymentMethod` (allow `"payLater"`).

### 10. Sale-flow wiring — Livestock Sales (`app/dashboard/invoices/livestocksales/page.tsx`)

Same pattern as POS:

- `paymentMethod: SalePaymentMethod | "payLater"`; `payLaterCreditorId` state.
- After `createLivestockSale(items)` succeeds, extract transactionId from response, then:
  - `createCreditorPayLater({ creditorId, sourceType: "LIVESTOCK", sourceTransactionId,
    items: livestockLineItems.map(l => ({ livestockItemId: l.livestockItemId, name:
    l.livestockItemLabel, quantity: l.weight, amount: l.amount })), totalAmount:
    livestockTotal })`.
- `livestockTotal` currently is `sum(weight * amount)` — verify it equals the intended
  total (the API expects `totalAmount`). Use the same total the UI shows.
- Note: `createLivestockSale` response is also loosely typed — reuse `extractTransactionId`.

### 11. Sale-flow wiring — Waste Sales (`app/dashboard/invoices/waste-sales/page.tsx`)

Same pattern:

- After `createWasteSale(payload)` succeeds, extract transactionId, then:
  - `createCreditorPayLater({ creditorId, sourceType: "WASTE", sourceTransactionId,
    items: [{ wasteProductId, name: selectedWasteProduct.name, weight: parsedWeight,
    amount: parsedAmount }], totalAmount: parsedAmount })`.
- Waste sale is a single line; map the one waste product to the single WASTE pay-later item.

### 12. i18n — `app/providers/I18nProvider.tsx`

Add Nepali translations for new strings (English keys already pass through `t`):
`Creditors`, `Add Creditor`, `Name`, `Address`, `Phone`, `Pending`, `Total Amount`,
`Paid`, `Record Payment`, `Record payment`, `Payment method`, `Discount (Rs.)`,
`Reference`, `Order history`, `Payment history`, `Pay Later`, `Select creditor`,
`New creditor`, `Creditor created successfully.`, `Payment recorded successfully.`,
`Sale recorded on credit for {{name}}.`, `No creditors yet.`, `Failed to load creditors`,
`Enter creditor details.`, etc. (Mirror existing translation style.)

### 13. Tests & validation

- `handlers/creditor.test.ts` — normalize/parse + payload shape.
- Run `npm run lint`, `tsc --noEmit` (or project typecheck), and `vitest` for the new
  test file. Confirm the build (`npm run build`) still passes.

---

## Risks & assumptions

- **`sourceTransactionId` extraction (CRITICAL)**: `createSale`/`createLivestockSale`/
  `createWasteSale` responses are typed `{ success?, message?, [key]: unknown }`. The plan
  assumes the backend returns a transaction id (e.g. `transactionId` / `data.transactionId`).
  If it does **not**, pay-later cannot be linked. Mitigation: add `extractTransactionId`
  helper that probes multiple fields; surface a clear error and **do not** post pay-later
  without an id. **Verify the actual response shape against the backend before relying on it.**
- **CASH sentinel semantics**: creating a sale with `paymentMethod=CASH` for a pay-later
  transaction may inflate cash reporting until the creditor settles. Accepted per user
  decision; confirm with backend/accounting that this is acceptable, or request a true
  `CREDIT` payment method later.
- **No update/delete creditor endpoints** in the spec → the list page will only offer
  "View details" (and "Add"). Edit/Delete omitted unless backend adds endpoints.
- **Pay-later idempotency**: if the sale succeeds but pay-later fails, the sale remains
  (stock deducted) with no debt recorded. Show a clear toast + keep the cart? Plan: toast
  error, leave user on the sale page with form intact so they can retry pay-later. (Could
  later add a "retry link pay-later" affordance on the creditor/transaction page.)
- **Outlet scoping**: creditors are not outlet-scoped in the spec (no `outletId` param).
  Sale flows carry `outletId` for the sale itself; pay-later only sends `creditorId`.
  Creditors are therefore shared across outlets. Confirm this matches intent.
- **`paymentMethod` type widening** in sale pages (`SalePaymentMethod | "payLater"`)
  must not leak `"payLater"` into the backend sale body — the `effectivePaymentMethod`
  mapping must be applied in every `buildSaleItems`/`toLivestockSaleCreateBody` path.
  Add a unit-checked assertion or careful code review.

## Validation plan

1. **Creditor CRUD**: Add a creditor → appears in list → open detail → balance is 0.
2. **Pay-later (POS)**: Build a processed sale cart, choose Pay Later, pick/create a
   creditor, checkout → sale appears in Transactions; creditor detail shows the order and
   `pendingAmount === totalAmount`.
3. **Pay-later (livestock & waste)**: Same flow from each sales page; verify order appears
   on creditor detail with correct source type badge and item shape.
4. **Record payment**: From creditor detail, record a partial payment → `pendingAmount`
   decreases by `amount - discountAmount`; payment appears in payment history.
5. **Edge cases**: pay-later without selecting creditor is blocked; sale created but
   pay-later link failure shows a clear error; 401 redirects to login; scoped outlet nav
   links include `?outletId=` correctly.
6. **Lint/type/test/build** all green.

## Out of scope / open questions

- **Creditor edit/delete**: spec has no endpoints — omitted. Confirm if backend will add.
- **Server-side search/pagination** for creditors (API has `?search=` but no `page/limit`) —
  deferred; client-side filter used now.
- **Refunds / negative payments**: not in spec — payment `amount` assumed positive.
- **Linking an *existing* transaction to a creditor retroactively** (e.g. from the
  Transactions page) — not included; pay-later is only triggered at checkout.
- **Backend response shape for `createSale`/`createLivestockSale`/`createWasteSale`** must
  be confirmed to contain a transaction id (see Risks).
