import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Currency Formatting ─────────────────────────────────────────────────────

const USD_DECIMAL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_FLEX = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format a number as USD with 2 decimal places. e.g. $1,234.56 */
export function formatCurrency(n: number): string {
  return USD_DECIMAL.format(n);
}

/** Format a number as USD with no decimal places. e.g. $1,235 */
export function formatCurrencyWhole(n: number): string {
  return USD_WHOLE.format(n);
}

/** Safely parse a numeric string, number, null, or undefined to a number. Returns 0 for empty/NaN. */
export function parseCurrency(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === "") return 0;
  const n = typeof s === "string" ? parseFloat(s) : s;
  return isNaN(n) ? 0 : n;
}

/** Format a possibly-null/undefined string or number as whole-dollar USD, or "—" if absent/NaN. */
export function formatCurrencyOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return USD_WHOLE.format(n);
}

/**
 * Format a possibly-null/undefined string or number as USD with 0–2 decimal places
 * (shows cents only when non-zero), or "—" if absent/NaN.
 * Matches the original minimumFractionDigits:0 / maximumFractionDigits:2 behavior.
 */
export function formatCurrencyFlexOrDash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "—";
  return USD_FLEX.format(n);
}
