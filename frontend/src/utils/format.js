// Number / date formatting helpers. The UI is Persian (fa-IR) and RTL.
// Currency is still USD (per the backend's default currency) but numbers
// are rendered with Persian-friendly separators via the fa-IR locale.
//
// IMPORTANT: the `fa-IR` locale uses the Persian (Jalali / Shamsi) calendar
// automatically in modern JS engines (V8 / Node 14+, all evergreen browsers).
// So `new Date("2024-10-01").toLocaleDateString("fa-IR", { month: "long",
// year: "numeric" })` returns "مهر ۱۴۰۳" — no external Jalali library is needed.

export function formatCurrency(value, currency = "USD") {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat("fa-IR", { style: "currency", currency, maximumFractionDigits: 2 }).format(num);
  } catch {
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(num) + " " + currency;
  }
}

/** Plain number with thousands separators (Persian digits). */
export function formatNumber(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(num);
}

/** Integer with Persian digits (no decimals) — useful for counts/quantities. */
export function formatInt(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(num);
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleString("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
}

/**
 * Format an ISO date (or Date) as a Jalali month label, e.g. "مهر ۱۴۰۳".
 * Used for chart X-axis ticks and tooltips. Falls back to the raw value
 * when the input cannot be parsed as a date (so legacy English-string
 * payloads from the backend still render legibly until the fix lands).
 */
export function formatJalaliMonth(value) {
  if (!value) return "";
  // If the value is already a non-ISO English string like "Oct 2024",
  // try to parse it; otherwise treat it as an ISO date.
  const looksIso = /^\d{4}-\d{2}-\d{2}/.test(String(value));
  const d = looksIso ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString("fa-IR", { month: "long", year: "numeric" });
  } catch {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
}

/**
 * Compact number for chart Y-axis ticks: Persian digits, no fraction,
 * compact notation (e.g. ۱٫۲ میلیون). Falls back gracefully.
 */
export function formatCompactNumber(value) {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1, notation: "compact" }).format(n);
  } catch {
    return String(n);
  }
}

/** Today's date as YYYY-MM-DD (for <input type="date"> defaults). */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
