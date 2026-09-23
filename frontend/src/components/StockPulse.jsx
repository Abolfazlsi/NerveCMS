import clsx from "clsx";

function toneFor(health) {
  if (health >= 70) return { bar: "bg-good-500", text: "text-good-600", dot: "bg-good-500" };
  if (health >= 40) return { bar: "bg-warn-500", text: "text-warn-600", dot: "bg-warn-500" };
  return { bar: "bg-bad-500", text: "text-bad-600", dot: "bg-bad-500" };
}

export default function StockPulse({ categories = [] }) {
  if (categories.length === 0) {
    return <p className="text-sm text-ink-500">No product categories yet.</p>;
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const tone = toneFor(cat.health);
        const critical = cat.health < 40;
        return (
          <div key={cat.category} className="group">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={clsx(
                    "w-2 h-2 rounded-full shrink-0",
                    tone.dot,
                    critical && "animate-pulse"
                  )}
                />
                <span className="text-sm font-medium text-ink-900">{cat.category}</span>
                <span className="text-xs text-ink-500 font-mono">
                  {cat.total_products} SKU{cat.total_products === 1 ? "" : "s"}
                </span>
              </div>
              <span className={clsx("text-xs font-mono font-medium", tone.text)}>{cat.health}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-700", tone.bar)}
                style={{ width: `${Math.max(cat.health, 4)}%` }}
              />
            </div>
            {cat.low_stock_count > 0 && (
              <p className="text-xs text-ink-500 mt-1">
                {cat.low_stock_count} item{cat.low_stock_count === 1 ? "" : "s"} at or below reorder level
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
