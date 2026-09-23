import clsx from "clsx";
import { Card } from "./ui";

export default function StatCard({ label, value, sub, icon: Icon, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-100 text-brand-600",
    good: "bg-good-100 text-good-600",
    warn: "bg-warn-100 text-warn-600",
    bad: "bg-bad-100 text-bad-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-500 mb-1.5">{label}</p>
          <p className="font-display font-semibold text-2xl text-ink-900">{value}</p>
          {sub && <p className="text-xs text-ink-500 mt-1.5">{sub}</p>}
        </div>
        {Icon && (
          <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", tones[tone])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
