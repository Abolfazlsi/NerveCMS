import { useCallback, useEffect, useState } from "react";
import { TrendingUp, DollarSign, Receipt, Calendar, BarChart3, LineChart } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { financeApi } from "../api/endpoints";
import {
  PageHeader,
  Card,
  Button,
  Input,
  Spinner,
  EmptyState,
} from "../components/ui";
import StatCard from "../components/StatCard";
import { useToast, errMsg } from "../components/Toast";
import { formatCurrency, formatDate } from "../utils/format";

// ----- Date helpers (Gregorian YYYY-MM-DD for <input type="date"> + backend) -----

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

// Quick-range presets. Each returns [start_date, end_date] in ISO.
const QUICK_RANGES = [
  { key: "this_month", label: "این ماه", range: () => [firstDayOfMonthISO(), todayISO()] },
  { key: "last_30", label: "۳۰ روز گذشته", range: () => [daysAgoISO(29), todayISO()] },
  { key: "last_90", label: "۹۰ روز گذشته", range: () => [daysAgoISO(89), todayISO()] },
  { key: "this_year", label: "امسال", range: () => [firstDayOfYearISO(), todayISO()] },
];

// ----- Chart formatting helpers -----

// Short date for daily XAxis ticks: e.g. "۱۲ تیر"
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

// Month label for monthly XAxis ticks: e.g. "تیر ۱۴۰۳"
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

// Compact number for YAxis ticks (fa-IR digits, no fraction).
const compactTick = (value) => {
  const n = Number(value || 0);
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0, notation: "compact" }).format(n);
};

// Currency tooltip formatter — returns [value, label] for recharts Tooltip.
const currencyTooltipLabeled = (value, name) => [formatCurrency(value), name];

const CHART_COLORS = {
  sales: "#1abc9c",
  payments: "#10b981",
  expenses: "#f43f5e",
  net_profit: "#f59e0b",
};

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #f1f5f9",
  fontSize: 13,
  fontFamily: "inherit",
};

const AXIS_TICK = { fontSize: 12, fill: "#64748b" };

// ----- Page component -----

export default function ReportsPage() {
  const toast = useToast();

  // Date inputs (controlled). Default range: this month.
  const [startDate, setStartDate] = useState(firstDayOfMonthISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [activeQuick, setActiveQuick] = useState("this_month");

  // Report data states.
  const [summary, setSummary] = useState(null); // all-time, for unpaid_amount
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [financial, setFinancial] = useState(null); // range summary
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true); // for financial+daily+monthly

  // Fetch all-time summary once on mount (only unpaid_amount is used from it).
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    financeApi
      .reportSummary()
      .then((res) => {
        if (!cancelled) setSummary(res.data);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errMsg(e, "بارگذاری گزارش ناموفق بود."));
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // Fetch range-based reports (financial + daily + monthly) in parallel.
  const load = useCallback(
    (start, end) => {
      const params = { start_date: start, end_date: end };
      setLoading(true);
      Promise.all([
        financeApi.reportFinancial(params),
        financeApi.reportDaily(params),
        financeApi.reportMonthly(params),
      ])
        .then(([finRes, dailyRes, monthlyRes]) => {
          setFinancial(finRes.data);
          setDaily(Array.isArray(dailyRes.data) ? dailyRes.data : []);
          setMonthly(Array.isArray(monthlyRes.data) ? monthlyRes.data : []);
        })
        .catch((e) => {
          toast.error(errMsg(e, "بارگذاری گزارش ناموفق بود."));
          setFinancial(null);
          setDaily([]);
          setMonthly([]);
        })
        .finally(() => setLoading(false));
    },
    [toast]
  );

  // Fetch on mount with default range (this month).
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

  // Derived summary numbers (range).
  const rangeSales = financial ? financial.total_sales : 0;
  const rangePayments = financial ? financial.total_payments : 0;
  const rangeExpenses = financial ? financial.total_expenses : 0;
  const rangeNet = financial ? financial.net_profit : 0;
  const unpaidAmount = summary ? summary.unpaid_amount : 0;

  // Empty-state for charts: only treat as empty when not loading.
  const dailyEmpty = !loading && daily.length === 0;
  const monthlyEmpty = !loading && monthly.length === 0;

  return (
    <div>
      <PageHeader
        title="گزارش مالی"
        description="خلاصه عملکرد مالی و تحلیل درآمد و هزینه"
      />

      {/* Date-range selector + quick ranges */}
      <Card className="p-5 mb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="sm:flex-1">
              <Input
                label="از تاریخ"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActiveQuick(null);
                }}
              />
            </div>
            <div className="sm:flex-1">
              <Input
                label="تا تاریخ"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActiveQuick(null);
                }}
              />
            </div>
            <div className="sm:self-end">
              <Button
                onClick={applyRange}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    <span>در حال بارگذاری…</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>اعمال</span>
                  </>
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
          </div>
        </div>
      </Card>

      {/* Summary row — 4 range stat cards + 1 all-time unpaid card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="فروش کل"
          value={loading ? "—" : formatCurrency(rangeSales)}
          sub={loading ? "در حال بارگذاری…" : "مجموع فاکتورهای صادرشده در بازه"}
          icon={TrendingUp}
          tone="good"
        />
        <StatCard
          label="پرداختی‌ها"
          value={loading ? "—" : formatCurrency(rangePayments)}
          sub={loading ? "در حال بارگذاری…" : "مجموع پرداخت‌های ثبت‌شده در بازه"}
          icon={DollarSign}
          tone="brand"
        />
        <StatCard
          label="هزینه‌ها"
          value={loading ? "—" : formatCurrency(rangeExpenses)}
          sub={loading ? "در حال بارگذاری…" : "مجموع هزینه‌های ثبت‌شده در بازه"}
          icon={Receipt}
          tone="bad"
        />
        <StatCard
          label="سود خالص"
          value={loading ? "—" : formatCurrency(rangeNet)}
          sub={loading ? "در حال بارگذاری…" : "پرداختی منهای هزینه در بازه"}
          icon={TrendingUp}
          tone={rangeNet >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="مبلغ پرداخت‌نشده"
          value={summaryLoading ? "—" : formatCurrency(unpaidAmount)}
          sub={summaryLoading ? "در حال بارگذاری…" : "مانده فاکتورهای صادرشده (از ابتدا تاکنون)"}
          icon={Calendar}
          tone="warn"
        />
      </div>

      {/* Charts: daily (with bars + net_profit line) + monthly (sales vs expenses + net line) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        {/* Daily chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-ink-900">گزارش روزانه</h3>
              <p className="text-sm text-ink-500">فروش، پرداختی و هزینه به‌تفکیک روز</p>
            </div>
            <BarChart3 className="w-5 h-5 text-brand-600" />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="w-6 h-6" />
            </div>
          ) : dailyEmpty ? (
            <EmptyState
              icon={BarChart3}
              title="داده‌ای در این بازه نیست"
              description="برای بازه انتخابی هیچ فروش، پرداخت یا هزینه‌ای ثبت نشده است."
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={daily}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickFormatter={compactTick}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={currencyTooltipLabeled}
                  labelFormatter={shortDate}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend />
                <Bar dataKey="sales" name="فروش" fill={CHART_COLORS.sales} radius={[4, 4, 0, 0]} />
                <Bar dataKey="payments" name="پرداختی" fill={CHART_COLORS.payments} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="هزینه" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                <Line
                  dataKey="net_profit"
                  name="سود خالص"
                  stroke={CHART_COLORS.net_profit}
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Monthly chart */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-ink-900">گزارش ماهانه</h3>
              <p className="text-sm text-ink-500">مقایسه فروش و هزینه و روند سود ماهانه</p>
            </div>
            <LineChart className="w-5 h-5 text-brand-600" />
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner className="w-6 h-6" />
            </div>
          ) : monthlyEmpty ? (
            <EmptyState
              icon={LineChart}
              title="داده‌ای در این بازه نیست"
              description="برای بازه انتخابی هیچ ماهی داده مالی ندارد."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={monthly}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={AXIS_TICK}
                  tickFormatter={compactTick}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  formatter={currencyTooltipLabeled}
                  labelFormatter={monthLabel}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend />
                <Bar dataKey="sales" name="فروش" fill={CHART_COLORS.sales} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="هزینه" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} />
                <Line
                  dataKey="net_profit"
                  name="سود خالص"
                  stroke={CHART_COLORS.net_profit}
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Range summary table */}
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
          <div className="flex items-center justify-center py-12">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="font-medium px-4 py-3">شاخص</th>
                  <th className="font-medium px-4 py-3 text-left">مبلغ</th>
                </tr>
              </thead>
              <tbody>
                <SummaryRow label="فروش" value={rangeSales} toneClass="text-good-600" />
                <SummaryRow label="پرداختی" value={rangePayments} toneClass="text-brand-600" />
                <SummaryRow label="هزینه" value={rangeExpenses} toneClass="text-bad-600" />
                <SummaryRow
                  label="سود خالص"
                  value={rangeNet}
                  toneClass={rangeNet >= 0 ? "text-good-600" : "text-bad-600"}
                  strong
                />
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ----- Small presentational subcomponent for the summary table rows -----

function SummaryRow({ label, value, toneClass = "text-ink-900", strong = false }) {
  return (
    <tr className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
      <td className="px-4 py-3.5 text-ink-700">
        {strong ? <span className="font-medium">{label}</span> : label}
      </td>
      <td className={`px-4 py-3.5 text-left font-mono ${toneClass} ${strong ? "font-semibold" : ""}`}>
        {formatCurrency(value)}
      </td>
    </tr>
  );
}
