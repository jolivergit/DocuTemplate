import { format, isValid, parseISO } from "date-fns";

/** Calendar dates stay in local time, never a UTC timestamp. */
export function parseDateOnly(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function formatDateOnly(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
