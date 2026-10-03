import { useEffect, useState } from "react";
import {
  Users, DollarSign, ShoppingCart, PackageX, TrendingUp, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { dashboardApi } from "../api/endpoints";
import { Card, PageHeader, Badge, Spinner, EmptyState } from "../components/ui";
import StatCard from "../components/StatCard";
import StockPulse from "../components/StockPulse";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, formatInt, formatJalaliMonth, formatCompactNumber } from "../utils/format";

const PIPELINE_LABELS = { active: "فعال", lead: "سرنخ", inactive: "غیرفعال", prospect: "محتمل" };

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi
      .summary()
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24"><Spinner /></div>
    );
  }

  if (!data) {
    return <EmptyState title="داشبورد بارگذاری نشد" description="لطفاً صفحه را رفرش کنید." />;
  }

  const { stats, revenue_trend, low_stock, upcoming_tasks, pipeline, top_products, category_health } = data;
  const firstName = user?.first_name || user?.username;

  return (
    <div>
      <PageHeader title={`خوش آمدید، ${firstName}`} description="نگاهی به وضعیت کسب‌وکار امروز" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard label="کل مشتریان" value={formatInt(stats.total_customers)} sub={`+${formatInt(stats.new_customers_this_month)} این ماه`} icon={Users} tone="brand" />
        <StatCard label="درآمد این ماه" value={formatCurrency(stats.revenue_this_month)} sub={`${formatCurrency(stats.total_revenue)} کل`} icon={DollarSign} tone="good" />
        <StatCard label="سفارش‌های این ماه" value={formatInt(stats.orders_this_month)} sub={`${formatInt(stats.paid_orders_count)} سفارش پرداخت‌شده کل`} icon={ShoppingCart} tone="brand" />
        <StatCard label="هشدار کمبود موجودی" value={formatInt(stats.low_stock_count)} sub={`${formatInt(stats.active_products)} محصول فعال`} icon={PackageX} tone={stats.low_stock_count > 0 ? "warn" : "good"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-ink-900">روند درآمد</h3>
              <p className="text-sm text-ink-500">شش ماه اخیر، سفارش‌های پرداخت‌شده و تکمیل‌شده</p>
            </div>
            <TrendingUp className="w-5 h-5 text-good-600" />
          </div>
          {revenue_trend.length === 0 ? (
            <EmptyState title="هنوز درآمدی ثبت نشده" description="سفارش‌های پرداخت‌شده پس از شروع فروش اینجا نمایش داده می‌شوند." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenue_trend}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatJalaliMonth} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={formatCompactNumber} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#cbd5e1", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="total" name="درآمد" stroke="#0d9488" strokeWidth={2.5} fill="url(#revGradient)" activeDot={{ r: 5, fill: "#0d9488" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-ink-900 mb-1">وضعیت موجودی</h3>
          <p className="text-sm text-ink-500 mb-4">سلامت لحظه‌ای بر اساس دسته‌بندی محصول</p>
          <StockPulse categories={category_health} />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-ink-900 mb-4">قیف فروش</h3>
          {pipeline.length === 0 ? (
            <p className="text-sm text-ink-500">هنوز مشتری‌ای وجود ندارد.</p>
          ) : (
            <div className="space-y-3">
              {pipeline.map((row) => (
                <div key={row.status} className="flex items-center justify-between">
                  <Badge tone={row.status === "active" ? "good" : row.status === "lead" ? "accent" : "neutral"}>
                    {PIPELINE_LABELS[row.status] || row.status}
                  </Badge>
                  <span className="text-sm font-medium text-ink-900 font-mono">{formatInt(row.count)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900">کمبود موجودی</h3>
            <PackageX className="w-4 h-4 text-warn-600" />
          </div>
          {low_stock.length === 0 ? (
            <p className="text-sm text-ink-500">همه محصولات موجودی کافی دارند.</p>
          ) : (
            <div className="space-y-3">
              {low_stock.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900 truncate">{p.name}</p>
                    <p className="text-xs text-ink-500 font-mono">{p.sku}</p>
                  </div>
                  <Badge tone="warn">{formatInt(p.quantity_in_stock)} / {formatInt(p.reorder_level)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-ink-900 mb-4">محصولات برتر</h3>
          {top_products.length === 0 ? (
            <p className="text-sm text-ink-500">هنوز فروشی ثبت نشده.</p>
          ) : (
            <div className="space-y-3">
              {top_products.map((p) => (
                <div key={p.product__name} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-900 truncate">{p.product__name}</span>
                  <span className="text-sm font-mono text-ink-500 shrink-0">{formatCurrency(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-ink-900">سررسید نزدیک</h3>
            <Clock className="w-4 h-4 text-ink-500" />
          </div>
          {upcoming_tasks.length === 0 ? (
            <p className="text-sm text-ink-500">در ۷ روز آینده موردی سررسید ندارد.</p>
          ) : (
            <div className="space-y-3">
              {upcoming_tasks.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-900 truncate">{t.title}</p>
                    <p className="text-xs text-ink-500">{formatDate(t.due_date)}</p>
                  </div>
                  {t.is_overdue && <Badge tone="bad">سررسید گذشته</Badge>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * Custom tooltip for the revenue-trend AreaChart.
 * Renders the Jalali month as a full Persian label ("مهر ۱۴۰۳") plus the
 * formatted currency value, in a styled card that matches the app's
 * rounded, soft-shadow design language.
 */
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-xl border border-ink-100 bg-white shadow-lg p-3 max-w-xs">
      <p className="text-xs font-medium text-ink-500 mb-1.5">
        {formatJalaliMonth(label)}
      </p>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-ink-600">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: "#0d9488" }}
          />
          درآمد
        </span>
        <span className="font-mono text-ink-900 font-medium">
          {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
}
