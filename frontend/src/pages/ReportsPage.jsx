import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, Calendar,
  BarChart3, LineChart, PieChart as PieIcon, Wallet, Target,
  ArrowUpRight, ArrowDownRight, Lightbulb, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { financeApi } from "../api/endpoints";
import {
  PageHeader, Card, Button, Input, Spinner, EmptyState,
} from "../components/ui";
import StatCard from "../components/StatCard";
import { useToast, errMsg } from "../components/Toast";
import { formatCurrency, formatDate, formatNumber } from "../utils/format";
import { PAYMENT_METHOD } from "../utils/constants";
import { collectAll } from "../utils/fetch";

/* ============================================================= *
 * Date helpers (Gregorian YYYY-MM-DD for <input type="date"> +  *
 * the backend report endpoints)                                 *
 * ============================================================= */

const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayISO = () => toISO(new Date());

const firstDayOfMonthISO = () => {
  const d = new Date();
  d.setDate(1);
  return toISO(d);
};

const firstDayOfYearISO = () => `${new Date().getFullYear()}-01-01`;

const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
};

// Compute the start/end of the *previous* period of the same length.
// Used for period-over-period comparison.
const previousPeriod = (startISO, endISO) => {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const lengthMs = e.getTime() - s.getTime();
  const prevEnd = new Date(s.getTime() - 24 * 60 * 60 * 1000); // day before start
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  return [toISO(prevStart), toISO(prevEnd)];
};

const QUICK_RANGES = [
  { key: "this_month", label: "این ماه", range: () => [firstDayOfMonthISO(), todayISO()] },
  { key: "last_30", label: "۳۰ روز گذشته", range: () => [daysAgoISO(29), todayISO()] },
  { key: "last_90", label: "۹۰ روز گذشته", range: () => [daysAgoISO(89), todayISO()] },
  { key: "this_year", label: "امسال", range: () => [firstDayOfYearISO(), todayISO()] },
];

/* ============================================================= *
 * Chart formatting helpers (fa-IR locale, Persian digits)      *
 * ============================================================= */

const shortDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
  } catch {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

const fullDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString("fa-IR", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } catch {
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
};

const monthLabel = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString("fa-IR", { month: "long", year: "numeric" });
  } catch {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
};

const compactTick = (value) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0, notation: "compact" }).format(n);
};

const CHART_COLORS = {
  sales: "#1abc9c",
  payments: "#10b981",
  expenses: "#f43f5e",
  net_profit: "#f59e0b",
};

// Distinct, accessible palette for the pie/donut breakdowns.
const PIE_PALETTE = [
  "#1abc9c", "#3b82f6", "#f59e0b", "#f43f5e", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#eab308", "#6366f1",
];

const AXIS_TICK = { fontSize: 12, fill: "#64748b" };

/* ============================================================= *
 * Derived analytics                                             *
 * ============================================================= */

// Sum a key over a daily/monthly series.
const sumKey = (series, key) =>
  series.reduce((acc, row) => acc + Number(row[key] || 0), 0);

// Percentage change between two numbers, clamped & null-safe.
const pctChange = (curr, prev) => {
  const c = Number(curr || 0);
  const p = Number(prev || 0);
  if (p === 0) return c === 0 ? 0 : null; // null = "new" (no prior baseline)
  return ((c - p) / Math.abs(p)) * 100;
};

/* ============================================================= *
 * Page                                                          *
 * ============================================================= */

export default function ReportsPage() {
  const toast = useToast();

  // Date inputs (controlled). Default range: this month.
  const [startDate, setStartDate] = useState(firstDayOfMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [activeQuick, setActiveQuick] = useState("this_month");

  // Chart-series display options.
  const [chartType, setChartType] = useState("area"); // area | bar | line
  const [showNet, setShowNet] = useState(true);

  // Report data states.
  const [summary, setSummary] = useState(null); // all-time, for unpaid_amount
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [financial, setFinancial] = useState(null); // range summary
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [prevFinancial, setPrevFinancial] = useState(null); // previous-period summary
  const [loading, setLoading] = useState(true);

  // Breakdown data (expenses by category, payments by method) over the range.
  const [expenseBreakdown, setExpenseBreakdown] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // ---- All-time summary (only unpaid_amount is used) ----
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    financeApi
      .reportSummary()
      .then((res) => { if (!cancelled) setSummary(res.data); })
      .catch((e) => { if (!cancelled) toast.error(errMsg(e, "بارگذاری گزارش ناموفق بود.")); })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  // ---- Range reports: financial + daily + monthly + previous-period financial ----
  const load = useCallback(
    (start, end) => {
      const params = { start_date: start, end_date: end };
      const [prevStart, prevEnd] = previousPeriod(start, end);
      setLoading(true);
      Promise.all([
        financeApi.reportFinancial(params),
        financeApi.reportDaily(params),
        financeApi.reportMonthly(params),
        financeApi.reportFinancial({ start_date: prevStart, end_date: prevEnd }),
      ])
        .then(([finRes, dailyRes, monthlyRes, prevRes]) => {
          setFinancial(finRes.data);
          setDaily(Array.isArray(dailyRes.data) ? dailyRes.data : []);
          setMonthly(Array.isArray(monthlyRes.data) ? monthlyRes.data : []);
          setPrevFinancial(prevRes.data);
        })
        .catch((e) => {
          toast.error(errMsg(e, "بارگذاری گزارش ناموفق بود."));
          setFinancial(null);
          setDaily([]);
          setMonthly([]);
          setPrevFinancial(null);
        })
        .finally(() => setLoading(false));

      // Breakdown fetch (separate so a slow /payments or /expenses doesn't
      // block the main charts). Expenses & payments are paginated lists.
      setBreakdownLoading(true);
      Promise.all([
        collectAll(financeApi.listExpenses, {}).catch(() => []),
        collectAll(financeApi.listPayments, {}).catch(() => []),
      ])
        .then(([allExpenses, allPayments]) => {
          // Filter client-side to the active range (these endpoints have no
          // server-side date filter in the current backend).
          const inRange = (iso) => {
            if (!iso) return false;
            const d = new Date(iso);
            const s = new Date(start);
            s.setHours(0, 0, 0, 0);
            const e = new Date(end);
            e.setHours(23, 59, 59, 999);
            return d >= s && d <= e;
          };
          const expInRange = allExpenses.filter((x) => inRange(x.expense_date));
          const payInRange = allPayments.filter((x) => inRange(x.paid_at));

          // Aggregate expenses by category.
          const expMap = {};
          expInRange.forEach((e) => {
            const cat = e.category || "سایر";
            expMap[cat] = (expMap[cat] || 0) + Number(e.amount || 0);
          });
          setExpenseBreakdown(
            Object.entries(expMap)
              .map(([name, value]) => ({ name, value: Number(value) }))
              .sort((a, b) => b.value - a.value)
          );

          // Aggregate payments by method.
          const payMap = {};
          payInRange.forEach((p) => {
            const m = PAYMENT_METHOD[p.payment_method] || p.payment_method || "سایر";
            payMap[m] = (payMap[m] || 0) + Number(p.amount || 0);
          });
          setPaymentBreakdown(
            Object.entries(payMap)
              .map(([name, value]) => ({ name, value: Number(value) }))
              .sort((a, b) => b.value - a.value)
          );
        })
        .finally(() => setBreakdownLoading(false));
    },
    [toast]
  );

  // Fetch on mount with the default range.
  useEffect(() => {
    load(firstDayOfMonthISO(), todayISO());
  }, [load]);

  const applyRange = () => {
    if (!startDate || !endDate) {
      toast.error("تاریخ شروع و پایان را انتخاب کنید.");
      return;
    }
    if (startDate > endDate) {
      toast.error("تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.");
      return;
    }
    setActiveQuick(null);
    load(startDate, endDate);
  };

  const handleQuickRange = (key) => {
    const preset = QUICK_RANGES.find((q) => q.key === key);
    if (!preset) return;
    const [s, e] = preset.range();
    setStartDate(s);
    setEndDate(e);
    setActiveQuick(key);
    load(s, e);
  };

  /* ---------- Derived values ---------- */

  const rangeSales = financial ? Number(financial.total_sales) : 0;
  const rangePayments = financial ? Number(financial.total_payments) : 0;
  const rangeExpenses = financial ? Number(financial.total_expenses) : 0;
  const rangeNet = financial ? Number(financial.net_profit) : 0;
  const unpaidAmount = summary ? Number(summary.unpaid_amount) : 0;

  const prevSales = prevFinancial ? Number(prevFinancial.total_sales) : 0;
  const prevPayments = prevFinancial ? Number(prevFinancial.total_payments) : 0;
  const prevExpenses = prevFinancial ? Number(prevFinancial.total_expenses) : 0;
  const prevNet = prevFinancial ? Number(prevFinancial.net_profit) : 0;

  const dSales = pctChange(rangeSales, prevSales);
  const dPayments = pctChange(rangePayments, prevPayments);
  const dExpenses = pctChange(rangeExpenses, prevExpenses);
  const dNet = pctChange(rangeNet, prevNet);

  // Decide which series to chart: if the range spans > 92 days, prefer monthly
  // granularity (cleaner). Otherwise use daily.
  const useMonthly = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const days = Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1;
    return days > 92;
  }, [startDate, endDate]);

  const series = useMonthly ? monthly : daily;
  const seriesKey = useMonthly ? "month" : "date";
  const seriesLabel = useMonthly ? "ماهانه" : "روزانه";
  const seriesTickFormatter = useMonthly ? monthLabel : shortDate;
  const seriesLabelFormatter = useMonthly ? monthLabel : fullDate;

  const seriesEmpty = !loading && series.length === 0;

  // Smart insights computed from the daily/monthly data.
  const insights = useMemo(() => {
    if (!daily.length && !monthly.length) return [];
    const src = useMonthly ? monthly : daily;
    const key = useMonthly ? "month" : "date";
    const out = [];

    // Best day/month by net profit.
    let best = null;
    src.forEach((row) => {
      const np = Number(row.net_profit || 0);
      if (!best || np > best.np) best = { np, date: row[key], sales: Number(row.sales || 0) };
    });
    if (best) {
      out.push({
        icon: TrendingUp,
        tone: "good",
        title: useMonthly ? "سودآورترین ماه" : "سودآورترین روز",
        body: `${formatDate(best.date)} با سود خالص ${formatCurrency(best.np)} (فروش ${formatCurrency(best.sales)})`,
      });
    }

    // Worst day/month.
    let worst = null;
    src.forEach((row) => {
      const np = Number(row.net_profit || 0);
      if (!worst || np < worst.np) worst = { np, date: row[key] };
    });
    if (worst && worst.np < 0) {
      out.push({
        icon: TrendingDown,
        tone: "bad",
        title: useMonthly ? "زیان‌ده‌ترین ماه" : "زیان‌ده‌ترین روز",
        body: `${formatDate(worst.date)} با ${formatCurrency(worst.np)}`,
      });
    }

    // Average daily net profit (from daily only, else derive from monthly count).
    const totalNet = sumKey(src, "net_profit");
    const count = src.length || 1;
    const avgNet = totalNet / count;
    out.push({
      icon: Activity,
      tone: "brand",
      title: useMonthly ? "میانگین سود ماهانه" : "میانگین سود روزانه",
      body: `${formatCurrency(avgNet)} در طول ${formatNumber(count)} ${useMonthly ? "ماه" : "روز"}`,
    });

    // Collection rate (payments / sales) — how much of billed revenue was actually collected.
    if (rangeSales > 0) {
      const rate = (rangePayments / rangeSales) * 100;
      out.push({
        icon: Target,
        tone: rate >= 80 ? "good" : rate >= 50 ? "warn" : "bad",
        title: "نرخ وصول مطالبات",
        body: `${formatNumber(rate)}٪ از فروش صادرشده در این بازه وصول شده است.`,
      });
    }

    // Profit margin (net / payments).
    if (rangePayments > 0) {
      const margin = (rangeNet / rangePayments) * 100;
      out.push({
        icon: Wallet,
        tone: margin >= 20 ? "good" : margin >= 0 ? "warn" : "bad",
        title: "حاشیه سود",
        body: `${formatNumber(margin)}٪ سود نسبت به پرداخت‌های دریافتی.`,
      });
    }

    return out;
  }, [daily, monthly, useMonthly, rangeSales, rangePayments, rangeNet]);

  /* ---------- Render ---------- */

  return (
    <div>
      <PageHeader
        title="گزارش مالی"
        description="تحلیل درآمد، هزینه و سود — با مقایسه‌ی دوره‌ی قبلی و تحلیل هوشمند"
      />

      {/* ---------- Date-range selector + quick ranges ---------- */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="sm:flex-1">
              <Input
                label="از تاریخ"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => { setStartDate(e.target.value); setActiveQuick(null); }}
              />
            </div>
            <div className="sm:flex-1">
              <Input
                label="تا تاریخ"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => { setEndDate(e.target.value); setActiveQuick(null); }}
              />
            </div>
            <div className="sm:self-end">
              <Button onClick={applyRange} disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <><Spinner className="w-4 h-4" /><span>در حال بارگذاری…</span></>
                ) : (
                  <><Calendar className="w-4 h-4" /><span>اعمال</span></>
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-500 ml-1">بازه‌های سریع:</span>
            {QUICK_RANGES.map((q) => (
              <Button
                key={q.key}
                size="sm"
                variant={activeQuick === q.key ? "primary" : "outline"}
                onClick={() => handleQuickRange(q.key)}
                disabled={loading}
              >
                {q.label}
              </Button>
            ))}
            <span className="text-xs text-ink-400 mr-auto mt-1">
              نمودار به‌صورت خودکار {useMonthly ? "ماهانه" : "روزانه"} نمایش داده می‌شود
              {useMonthly ? " (بازه بیش از ۹۲ روز است)" : ""}
            </span>
          </div>
        </div>
      </Card>

      {/* ---------- KPI row with period-over-period deltas ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="فروش کل"
          value={loading ? null : rangeSales}
          delta={loading ? null : dSales}
          icon={TrendingUp}
          tone="good"
          sub="مجموع فاکتورهای صادرشده"
        />
        <KpiCard
          label="پرداختی‌ها"
          value={loading ? null : rangePayments}
          delta={loading ? null : dPayments}
          icon={DollarSign}
          tone="brand"
          sub="مجموع پرداخت‌های دریافتی"
        />
        <KpiCard
          label="هزینه‌ها"
          value={loading ? null : rangeExpenses}
          delta={loading ? null : dExpenses}
          icon={Receipt}
          tone="bad"
          sub="مجموع هزینه‌های ثبت‌شده"
          invertDelta /* for expenses, up = bad */
        />
        <KpiCard
          label="سود خالص"
          value={loading ? null : rangeNet}
          delta={loading ? null : dNet}
          icon={Wallet}
          tone={rangeNet >= 0 ? "good" : "bad"}
          sub="پرداختی منهای هزینه"
        />
        <StatCard
          label="مبلغ پرداخت‌نشده"
          value={summaryLoading ? "—" : formatCurrency(unpaidAmount)}
          sub={summaryLoading ? "در حال بارگذاری…" : "مانده فاکتورها (از ابتدا تاکنون)"}
          icon={Calendar}
          tone="warn"
        />
      </div>

      {/* ---------- Main trend chart with chart-type toggle ---------- */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" />
              روند {seriesLabel}
            </h3>
            <p className="text-sm text-ink-500">
              فروش، پرداختی و هزینه {useMonthly ? "به‌تفکیک ماه" : "به‌تفکیک روز"}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-ink-100 rounded-xl p-1">
            {[
              { key: "area", label: "ناحیه‌ای", icon: Activity },
              { key: "bar", label: "میله‌ای", icon: BarChart3 },
              { key: "line", label: "خطی", icon: LineChart },
            ].map((opt) => {
              const OptIcon = opt.icon;
              const active = chartType === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setChartType(opt.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active ? "bg-white text-brand-600 shadow-sm" : "text-ink-500 hover:text-ink-700"
                  }`}
                  aria-pressed={active}
                >
                  <OptIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggle: show/hide net profit line overlay */}
        <div className="flex items-center gap-4 mb-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNet}
              onChange={(e) => setShowNet(e.target.checked)}
              className="w-4 h-4 rounded border-ink-300 accent-brand-500"
            />
            <span className="text-ink-600">نمایش خط سود خالص</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner className="w-6 h-6" /></div>
        ) : seriesEmpty ? (
          <EmptyState
            icon={BarChart3}
            title="داده‌ای در این بازه نیست"
            description="برای بازه انتخابی هیچ فروش، پرداخت یا هزینه‌ای ثبت نشده است."
          />
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.sales} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={CHART_COLORS.sales} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.payments} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={CHART_COLORS.payments} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.expenses} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={CHART_COLORS.expenses} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey={seriesKey}
                tickFormatter={seriesTickFormatter}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tick={AXIS_TICK}
                tickFormatter={compactTick}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={<RichTooltip labelFormatter={seriesLabelFormatter} />}
                cursor={{ fill: "#f1f5f9", opacity: 0.5 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                iconType="circle"
              />

              {chartType === "area" && (
                <>
                  <Area type="monotone" dataKey="sales" name="فروش" stroke={CHART_COLORS.sales} strokeWidth={2} fill="url(#gradSales)" />
                  <Area type="monotone" dataKey="payments" name="پرداختی" stroke={CHART_COLORS.payments} strokeWidth={2} fill="url(#gradPayments)" />
                  <Area type="monotone" dataKey="expenses" name="هزینه" stroke={CHART_COLORS.expenses} strokeWidth={2} fill="url(#gradExpenses)" />
                </>
              )}
              {chartType === "bar" && (
                <>
                  <Bar dataKey="sales" name="فروش" fill={CHART_COLORS.sales} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="payments" name="پرداختی" fill={CHART_COLORS.payments} radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" name="هزینه" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </>
              )}
              {chartType === "line" && (
                <>
                  <Line type="monotone" dataKey="sales" name="فروش" stroke={CHART_COLORS.sales} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="payments" name="پرداختی" stroke={CHART_COLORS.payments} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="هزینه" stroke={CHART_COLORS.expenses} strokeWidth={2.5} dot={false} />
                </>
              )}
              {showNet && (
                <Line
                  type="monotone"
                  dataKey="net_profit"
                  name="سود خالص"
                  stroke={CHART_COLORS.net_profit}
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={false}
                  yAxisId={0}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ---------- Two donut breakdowns side by side ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <DonutCard
          title="تفکیک هزینه‌ها بر اساس دسته"
          subtitle="سهم هر دسته از کل هزینه‌های بازه"
          icon={Receipt}
          loading={breakdownLoading}
          data={expenseBreakdown}
          emptyTitle="هزینه‌ای ثبت نشده"
          emptyDescription="در این بازه هیچ هزینه‌ای ثبت نشده است."
          totalLabel="مجموع هزینه"
        />
        <DonutCard
          title="تفکیک پرداخت‌ها بر اساس روش"
          subtitle="سهم هر روش پرداخت از کل پرداخت‌های دریافتی"
          icon={PieIcon}
          loading={breakdownLoading}
          data={paymentBreakdown}
          emptyTitle="پرداختی ثبت نشده"
          emptyDescription="در این بازه هیچ پرداختی ثبت نشده است."
          totalLabel="مجموع پرداخت"
        />
      </div>

      {/* ---------- Period comparison + smart insights ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Period-over-period comparison table */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand-600" />
                مقایسه با دوره‌ی قبلی
              </h3>
              <p className="text-sm text-ink-500">
                این دوره: {formatDate(startDate)} تا {formatDate(endDate)}
              </p>
            </div>
            {loading && <Spinner className="w-5 h-5" />}
          </div>
          {loading && !financial ? (
            <div className="flex items-center justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-right text-ink-500">
                    <th className="font-medium px-4 py-3">شاخص</th>
                    <th className="font-medium px-4 py-3 text-left">این دوره</th>
                    <th className="font-medium px-4 py-3 text-left">دوره‌ی قبل</th>
                    <th className="font-medium px-4 py-3 text-left">تغییر</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="فروش" curr={rangeSales} prev={prevSales} />
                  <CompareRow label="پرداختی" curr={rangePayments} prev={prevPayments} />
                  <CompareRow label="هزینه" curr={rangeExpenses} prev={prevExpenses} invert />
                  <CompareRow
                    label="سود خالص"
                    curr={rangeNet}
                    prev={prevNet}
                    strong
                  />
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Smart insights */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-warn-500" />
                تحلیل هوشمند
              </h3>
              <p className="text-sm text-ink-500">نکات کلیدی به‌دست‌آمده از داده‌های این بازه</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Spinner className="w-6 h-6" /></div>
          ) : insights.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="داده‌ای برای تحلیل نیست"
              description="در این بازه داده‌ی کافی برای تولید تحلیل وجود ندارد."
            />
          ) : (
            <div className="space-y-3">
              {insights.map((ins, i) => {
                const InsightIcon = ins.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-ink-100 p-3.5 hover:bg-ink-100/40 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${INSIGHT_TONES[ins.tone]}`}>
                      <InsightIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">{ins.title}</p>
                      <p className="text-sm text-ink-500 mt-0.5 break-words">{ins.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ---------- Range summary with ratio bars ---------- */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-ink-900">خلاصه بازه</h3>
            <p className="text-sm text-ink-500">
              از {formatDate(startDate)} تا {formatDate(endDate)}
            </p>
          </div>
          {loading && <Spinner className="w-5 h-5" />}
        </div>
        {loading && !financial ? (
          <div className="flex items-center justify-center py-12"><Spinner className="w-6 h-6" /></div>
        ) : (
          <div className="space-y-4">
            <RatioBar
              label="فروش در برابر هزینه"
              left={{ label: "فروش", value: rangeSales, color: CHART_COLORS.sales }}
              right={{ label: "هزینه", value: rangeExpenses, color: CHART_COLORS.expenses }}
            />
            <RatioBar
              label="پرداختی در برابر هزینه"
              left={{ label: "پرداختی", value: rangePayments, color: CHART_COLORS.payments }}
              right={{ label: "هزینه", value: rangeExpenses, color: CHART_COLORS.expenses }}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <MiniStat label="فروش" value={formatCurrency(rangeSales)} tone="text-good-600" />
              <MiniStat label="پرداختی" value={formatCurrency(rangePayments)} tone="text-brand-600" />
              <MiniStat label="هزینه" value={formatCurrency(rangeExpenses)} tone="text-bad-600" />
              <MiniStat
                label="سود خالص"
                value={formatCurrency(rangeNet)}
                tone={rangeNet >= 0 ? "text-good-600" : "text-bad-600"}
                strong
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================= *
 * Subcomponents                                                  *
 * ============================================================= */

const INSIGHT_TONES = {
  good: "bg-good-100 text-good-600",
  warn: "bg-warn-100 text-warn-600",
  bad: "bg-bad-100 text-bad-600",
  brand: "bg-brand-100 text-brand-600",
  neutral: "bg-ink-100 text-ink-500",
};

// KPI card with a delta chip vs previous period.
function KpiCard({ label, value, delta, icon: Icon, tone, sub, invertDelta = false }) {
  // Format delta sign + Persian digits.
  let deltaText = null;
  let deltaGood = null;
  if (delta !== null && delta !== undefined && !Number.isNaN(delta)) {
    const sign = delta > 0 ? "+" : "";
    const pct = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.abs(delta));
    deltaText = `${sign}${pct}٪`;
    // "good" direction: increases are good unless invertDelta (expenses).
    if (delta === 0) {
      deltaGood = null;
    } else {
      const increased = delta > 0;
      deltaGood = invertDelta ? !increased : increased;
    }
  }
  const DeltaIcon = deltaGood === null ? null : deltaGood ? ArrowUpRight : ArrowDownRight;
  const deltaTone =
    deltaGood === null ? "text-ink-400 bg-ink-100"
    : deltaGood ? "text-good-600 bg-good-100"
    : "text-bad-600 bg-bad-100";

  return (
    <StatCard
      label={label}
      value={value === null ? "—" : formatCurrency(value)}
      sub={sub}
      icon={Icon}
      tone={tone}
    >
      {deltaText && (
        <div className={`inline-flex items-center gap-0.5 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${deltaTone}`}>
          {DeltaIcon && <DeltaIcon className="w-3 h-3" />}
          <span>{deltaText}</span>
          <span className="text-ink-400 font-normal mr-0.5">نسبت به دوره قبل</span>
        </div>
      )}
    </StatCard>
  );
}

// Rich custom tooltip for the main trend chart.
function RichTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-ink-100 bg-white shadow-lg p-3 max-w-xs">
      <p className="text-xs font-medium text-ink-500 mb-2">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-ink-600">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: entry.color || entry.stroke || entry.fill }}
              />
              {entry.name}
            </span>
            <span className="font-mono text-ink-900 font-medium">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut chart card with center total + legend list.
function DonutCard({ title, subtitle, icon: Icon, loading, data, emptyTitle, emptyDescription, totalLabel }) {
  const total = data.reduce((acc, d) => acc + Number(d.value || 0), 0);
  const hasData = data.length > 0 && total > 0;

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="font-display font-semibold text-ink-900 flex items-center gap-2">
          <Icon className="w-5 h-5 text-brand-600" />
          {title}
        </h3>
        <p className="text-sm text-ink-500">{subtitle}</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner className="w-6 h-6" /></div>
      ) : !hasData ? (
        <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0];
                    const pct = total ? (p.value / total) * 100 : 0;
                    return (
                      <div className="rounded-xl border border-ink-100 bg-white shadow-lg p-2.5 text-sm">
                        <p className="font-medium text-ink-900 mb-0.5">{p.name}</p>
                        <p className="font-mono text-ink-700">{formatCurrency(p.value)}</p>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(pct)}٪ از کل
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-ink-500">{totalLabel}</span>
              <span className="font-display font-semibold text-lg text-ink-900 mt-0.5">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Legend list with values + percentages */}
          <div className="flex-1 w-full space-y-1.5 max-h-56 overflow-y-auto">
            {data.map((d, i) => {
              const pct = total ? (d.value / total) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }}
                  />
                  <span className="text-ink-700 flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-ink-400 font-mono w-12 text-left">
                    {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(pct)}٪
                  </span>
                  <span className="font-mono text-ink-900 w-24 text-left">
                    {formatCurrency(d.value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// Period-over-period comparison table row with delta.
function CompareRow({ label, curr, prev, invert = false, strong = false }) {
  const delta = pctChange(curr, prev);
  let deltaText = "—";
  let deltaCls = "text-ink-400";
  if (delta !== null) {
    const sign = delta > 0 ? "+" : "";
    deltaText = `${sign}${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(delta)}٪`;
    if (delta === 0) {
      deltaCls = "text-ink-400";
    } else {
      const good = invert ? delta < 0 : delta > 0;
      deltaCls = good ? "text-good-600" : "text-bad-600";
    }
  } else if (prev === 0 && curr > 0) {
    deltaText = "جدید";
    deltaCls = "text-brand-600";
  }
  return (
    <tr className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
      <td className="px-4 py-3.5 text-ink-700">
        {strong ? <span className="font-medium">{label}</span> : label}
      </td>
      <td className={`px-4 py-3.5 text-left font-mono ${strong ? "font-semibold" : ""} text-ink-900`}>
        {formatCurrency(curr)}
      </td>
      <td className="px-4 py-3.5 text-left font-mono text-ink-500">
        {formatCurrency(prev)}
      </td>
      <td className={`px-4 py-3.5 text-left font-medium ${deltaCls}`}>
        {deltaText}
      </td>
    </tr>
  );
}

// Horizontal ratio bar comparing two values (e.g. sales vs expenses).
function RatioBar({ label, left, right }) {
  const total = Number(left.value || 0) + Number(right.value || 0);
  const leftPct = total > 0 ? (left.value / total) * 100 : 0;
  const rightPct = total > 0 ? (right.value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="text-ink-500">{label}</span>
        <span className="text-ink-400 text-xs">
          نسبت {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(leftPct)} به {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(rightPct)}
        </span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-ink-100">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${leftPct}%`, backgroundColor: left.color }}
          title={`${left.label}: ${formatCurrency(left.value)}`}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${rightPct}%`, backgroundColor: right.color }}
          title={`${right.label}: ${formatCurrency(right.value)}`}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-ink-600">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: left.color }} />
          {left.label}: <span className="font-mono">{formatCurrency(left.value)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-ink-600">
          <span className="font-mono">{formatCurrency(right.value)}</span> :{right.label}
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: right.color }} />
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, strong = false }) {
  return (
    <div className="rounded-xl border border-ink-100 px-3 py-2.5">
      <p className="text-xs text-ink-500 mb-0.5">{label}</p>
      <p className={`font-mono ${tone} ${strong ? "font-semibold text-sm" : "text-sm"}`}>{value}</p>
    </div>
  );
}
