import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination control for DRF PageNumberPagination envelopes:
 * { count, next, previous, results }.
 * `page` is 1-based, `onPageChange(newPage)` is called on navigation.
 */
export default function Pagination({ count, page, pageSize = 25, onPageChange, loading }) {
  const totalPages = Math.max(1, Math.ceil(Number(count || 0) / Number(pageSize || 25)));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count || 0);

  if (count === 0 || count === undefined) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-ink-100 text-sm">
      <p className="text-ink-500">
        نمایش <span className="font-mono text-ink-900">{from}</span> تا{" "}
        <span className="font-mono text-ink-900">{to}</span> از{" "}
        <span className="font-mono text-ink-900">{count}</span> مورد
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
          className="w-9 h-9 rounded-xl border border-ink-300 bg-white flex items-center justify-center text-ink-700 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="صفحه قبل"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="px-3 py-1.5 rounded-xl bg-ink-100 text-ink-900 font-medium font-mono text-sm">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className="w-9 h-9 rounded-xl border border-ink-300 bg-white flex items-center justify-center text-ink-700 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="صفحه بعد"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
