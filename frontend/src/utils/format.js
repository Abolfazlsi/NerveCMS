// Number / date formatting helpers. The UI is Persian (fa-IR) and RTL.
// Currency is still USD (per the backend's default currency) but numbers
// are rendered with Persian-friendly separators via the fa-IR locale.

export function formatCurrency(value, currency = "USD") {
    const num = Number(value || 0);
    try {
        return new Intl.NumberFormat("fa-IR", {style: "currency", currency, maximumFractionDigits: 2}).format(num);
    } catch {
        return new Intl.NumberFormat("fa-IR", {maximumFractionDigits: 2}).format(num) + " " + currency;
    }
}

/** Plain number with thousands separators (Persian digits). */
export function formatNumber(value) {
    const num = Number(value || 0);
    return new Intl.NumberFormat("fa-IR", {maximumFractionDigits: 2}).format(num);
}

export function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    try {
        return d.toLocaleDateString("fa-IR", {month: "short", day: "numeric", year: "numeric"});
    } catch {
        return d.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
    }
}

export function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    try {
        return d.toLocaleString("fa-IR", {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
    } catch {
        return d.toLocaleString("en-US", {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"});
    }
}

/** Today's date as YYYY-MM-DD (for <input type="date"> defaults). */
export function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
