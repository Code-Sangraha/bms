/** Line shape used by POS sale calculations (amount override optional). */
export type SaleLineForCalc = {
  weight: number;
  unitPrice: number;
  amountOverride?: number | null;
};

export function calculatedLineSubtotal(line: SaleLineForCalc): number {
  return line.unitPrice * line.weight;
}

export function lineSubtotal(line: SaleLineForCalc): number {
  if (
    line.amountOverride != null &&
    Number.isFinite(line.amountOverride) &&
    line.amountOverride > 0
  ) {
    return line.amountOverride;
  }
  return calculatedLineSubtotal(line);
}

export function cartSubtotal(lines: SaleLineForCalc[]): number {
  return lines.reduce((sum, line) => sum + lineSubtotal(line), 0);
}

/** Proportional cart discount per line; remainder assigned to largest subtotal line. */
export function allocateCartDiscount(
  lines: SaleLineForCalc[],
  cartDiscount: number
): number[] {
  if (lines.length === 0) return [];
  const discount = Math.max(0, cartDiscount);
  if (discount <= 0) return lines.map(() => 0);

  const subtotals = lines.map((line) => lineSubtotal(line));
  const total = subtotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return lines.map(() => 0);
  if (discount >= total) return subtotals.map((sub) => sub);

  const allocated = subtotals.map((sub) =>
    Math.round((sub / total) * discount * 100) / 100
  );
  const sumAllocated = allocated.reduce((a, b) => a + b, 0);
  const remainder = Math.round((discount - sumAllocated) * 100) / 100;

  if (remainder !== 0) {
    let maxIndex = 0;
    for (let i = 1; i < subtotals.length; i++) {
      if (subtotals[i] > subtotals[maxIndex]) maxIndex = i;
    }
    allocated[maxIndex] = Math.round((allocated[maxIndex] + remainder) * 100) / 100;
  }

  return allocated;
}

export function lineApiAmount(lineSubtotalValue: number, lineDiscount: number): number {
  return Math.max(0, Math.round((lineSubtotalValue - lineDiscount) * 100) / 100);
}

export function formatSaleAmount(value: number): string {
  return Number.isInteger(value) || value % 1 === 0
    ? String(value)
    : value.toFixed(2);
}
