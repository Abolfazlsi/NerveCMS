import { useEffect, useState, useCallback } from "react";
import { Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { salesApi, customersApi, inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import { formatCurrency, formatDate } from "../utils/format";

const STATUS_TONE = { draft: "neutral", pending: "warn", paid: "good", fulfilled: "brand", cancelled: "bad" };

const STATUS_LABELS = {
  draft: "پیش‌نویس",
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  fulfilled: "تکمیل‌شده",
  cancelled: "لغوشده",
};

const emptyItem = () => ({ product: "", quantity: 1, unit_price: 0, key: Math.random() });

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    salesApi
      .list({ status: statusFilter || undefined, search: search || undefined })
      .then((res) => setOrders(res.data.results ?? res.data))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => {
    customersApi.list({}).then((res) => setCustomers(res.data.results ?? res.data));
    inventoryApi.listProducts({}).then((res) => setProducts(res.data.results ?? res.data));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setCustomerId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setStatus("pending");
    setItems([emptyItem()]);
    setError("");
    setModalOpen(true);
  };

  const updateItem = (key, field, value) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, [field]: value };
        if (field === "product") {
          const product = products.find((p) => String(p.id) === String(value));
          if (product) next.unit_price = product.unit_price;
        }
        return next;
      })
    );
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));

  const total = items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await salesApi.create({
        customer: customerId,
        order_date: orderDate,
        status,
        items: items
          .filter((it) => it.product)
          .map((it) => ({ product: it.product, quantity: it.quantity, unit_price: it.unit_price })),
      });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(
        err.response?.data?.items?.[0] ||
          err.response?.data?.detail ||
          "ایجاد این سفارش ممکن نشد. لطفاً مشتری و حداقل یک آیتم را انتخاب کنید."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="سفارش‌ها"
        description="همه فروش‌ها، از پیش‌نویس تا تکمیل‌شده"
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> سفارش جدید
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس شماره سفارش یا مشتری…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
          <option value="">همه وضعیت‌ها</option>
          <option value="draft">پیش‌نویس</option>
          <option value="pending">در انتظار پرداخت</option>
          <option value="paid">پرداخت‌شده</option>
          <option value="fulfilled">تکمیل‌شده</option>
          <option value="cancelled">لغوشده</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="هنوز سفارشی وجود ندارد"
            description="اولین سفارش را ایجاد کنید تا فروش‌ها را پیگیری کنید."
            action={
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> سفارش جدید
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">سفارش</th>
                  <th className="px-5 py-3 font-medium">مشتری</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">تاریخ</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium text-right">مجموع</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-ink-900">{o.order_number}</td>
                    <td className="px-5 py-3.5 text-ink-900">{o.customer_name}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell text-ink-500">{formatDate(o.order_date)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={STATUS_TONE[o.status]}>
                        {STATUS_LABELS[o.status] || o.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-900">
                      {formatCurrency(o.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="سفارش جدید" width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="مشتری"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">انتخاب مشتری…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input
              label="تاریخ سفارش"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
            <Select label="وضعیت" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">پیش‌نویس</option>
              <option value="pending">در انتظار پرداخت</option>
              <option value="paid">پرداخت‌شده</option>
              <option value="fulfilled">تکمیل‌شده</option>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink-700">آیتم‌ها</span>
              <button
                type="button"
                onClick={addItem}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                + افزودن آیتم
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="flex items-center gap-2">
                  <select
                    value={it.product}
                    onChange={(e) => updateItem(it.key, "product", e.target.value)}
                    className="flex-1 rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  >
                    <option value="">انتخاب محصول…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) => updateItem(it.key, "quantity", e.target.value)}
                    className="w-20 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.unit_price}
                    onChange={(e) => updateItem(it.key, "unit_price", e.target.value)}
                    className="w-24 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="w-9 h-9 shrink-0 rounded-xl hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                    aria-label="حذف آیتم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-ink-100 pt-4">
            <span className="text-sm text-ink-500">مجموع سفارش</span>
            <span className="font-display font-semibold text-lg text-ink-900">
              {formatCurrency(total)}
            </span>
          </div>

          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ایجاد…" : "ایجاد سفارش"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}