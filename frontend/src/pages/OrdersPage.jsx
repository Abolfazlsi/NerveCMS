import { useEffect, useState, useCallback } from "react";
import { Plus, Search, ShoppingCart, Trash2, Eye, Edit3, CheckCircle2, DollarSign, PackageCheck } from "lucide-react";
import { salesApi, customersApi, inventoryApi, financeApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { ORDER_STATUS, isAdmin, canWrite } from "../utils/constants";
import { collectAll } from "../utils/fetch";
import { formatCurrency, formatDate, todayISO } from "../utils/format";

const PAGE_SIZE = 25;

const emptyItem = () => ({ product: "", quantity: 1, unit_price: 0, key: Math.random() });

const emptyForm = { customer: "", order_date: todayISO(), due_date: "", status: "draft", notes: "", items: [emptyItem()] };

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    salesApi
      .list({ status: statusFilter || undefined, search: search || undefined, page })
      .then((res) => {
        setOrders(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, search, page]);

  useEffect(() => {
    collectAll(customersApi.list).then(setCustomers).catch(() => {});
    collectAll(inventoryApi.listProducts).then(setProducts).catch(() => {});
    inventoryApi.listWarehouses({}).then((res) => setWarehouses(res.data.results ?? res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, order_date: todayISO(), items: [emptyItem()] });
    setError("");
    setModalOpen(true);
  };

  const openEdit = async (order) => {
    try {
      const { data } = await salesApi.get(order.id);
      setEditing(data);
      setForm({
        customer: data.customer || "",
        order_date: data.order_date || todayISO(),
        due_date: data.due_date || "",
        status: data.status,
        notes: data.notes || "",
        warehouse: data.warehouse || "",
        items: (data.items?.length ? data.items : [emptyItem()]).map((it) => ({
          product: it.product, quantity: it.quantity, unit_price: it.unit_price, key: Math.random(),
        })),
      });
      setError("");
      setModalOpen(true);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری سفارش برای ویرایش ناموفق بود."));
    }
  };

  const openDetail = async (order) => {
    setDetail(order);
    setDetailLoading(true);
    try {
      const { data } = await salesApi.get(order.id);
      setDetail(data);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری جزئیات سفارش ناموفق بود."));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateItem = (key, field, value) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, [field]: value };
        if (field === "product") {
          const product = products.find((p) => String(p.id) === String(value));
          if (product) next.unit_price = product.unit_price;
        }
        return next;
      }),
    }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (key) => setForm((f) => ({ ...f, items: f.items.filter((it) => it.key !== key) }));

  const total = form.items.reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        customer: form.customer,
        order_date: form.order_date,
        due_date: form.due_date || null,
        status: form.status,
        notes: form.notes,
        warehouse: form.warehouse || null,
        items: form.items
          .filter((it) => it.product)
          .map((it) => ({ product: it.product, quantity: it.quantity, unit_price: it.unit_price })),
      };
      if (editing) {
        await salesApi.update(editing.id, payload);
        toast.success("سفارش به‌روز شد.");
      } else {
        await salesApi.create(payload);
        toast.success("سفارش ایجاد شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ایجاد این سفارش ممکن نشد. لطفاً مشتری و حداقل یک آیتم را انتخاب کنید."));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (order, kind) => {
    setActing(true);
    try {
      if (kind === "confirm") await salesApi.confirmOrder(order.id);
      else if (kind === "pay") await salesApi.payOrder(order.id);
      else if (kind === "fulfill") await salesApi.fulfillOrder(order.id);
      toast.success("وضعیت سفارش به‌روز شد.");
      await load();
      if (detail?.id === order.id) await openDetail(order);
    } catch (e) {
      toast.error(errMsg(e, "تغییر وضعیت سفارش ناموفق بود."));
    } finally {
      setActing(false);
    }
  };

  const createInvoice = async (order) => {
    setActing(true);
    try {
      const { data } = await financeApi.createInvoiceFromOrder(order.id);
      toast.success(`فاکتور ${data.invoice_number} صادر شد.`);
      await openDetail(order);
    } catch (e) {
      toast.error(errMsg(e, "صدور فاکتور ناموفق بود. ممکن است این سفارش قبلاً فاکتور داشته یا لغوشده باشد."));
    } finally {
      setActing(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await salesApi.remove(toDelete.id);
      toast.success("سفارش حذف شد.");
      if (detail?.id === toDelete.id) setDetail(null);
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف سفارش ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="سفارش‌ها"
        description="همه فروش‌ها، از پیش‌نویس تا تکمیل‌شده"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> سفارش جدید</Button>}
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
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
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
            action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> سفارش جدید</Button>}
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
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const st = ORDER_STATUS[o.status] || { label: o.status, tone: "neutral" };
                  return (
                    <tr key={o.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-ink-900 cursor-pointer" onClick={() => openDetail(o)}>{o.order_number}</td>
                      <td className="px-5 py-3.5 text-ink-900 cursor-pointer" onClick={() => openDetail(o)}>{o.customer_name}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-ink-500">{formatDate(o.order_date)}</td>
                      <td className="px-5 py-3.5"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="px-5 py-3.5 text-right font-mono text-ink-900 cursor-pointer" onClick={() => openDetail(o)}>{formatCurrency(o.total_amount)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(o)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="جزئیات"><Eye className="w-4 h-4" /></button>
                          {writable && (
                            <button onClick={() => openEdit(o)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="ویرایش"><Edit3 className="w-4 h-4" /></button>
                          )}
                          {admin && (
                            <button onClick={() => setToDelete(o)} className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading} />
      </Card>

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `ویرایش ${editing.order_number}` : "سفارش جدید"} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="مشتری" required value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}>
              <option value="">انتخاب مشتری…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {warehouses.length > 0 && (
              <Select label="انبار" value={form.warehouse} onChange={(e) => setForm((f) => ({ ...f, warehouse: e.target.value }))}>
                <option value="">پیش‌فرض</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="تاریخ سفارش" type="date" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} />
            <Input label="سررسید (اختیاری)" type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            <Select label="وضعیت" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink-700">آیتم‌ها</span>
              <button type="button" onClick={addItem} className="text-xs font-medium text-brand-500 hover:text-brand-600">+ افزودن آیتم</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it) => (
                <div key={it.key} className="flex items-center gap-2">
                  <select value={it.product} onChange={(e) => updateItem(it.key, "product", e.target.value)} className="flex-1 rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none">
                    <option value="">انتخاب محصول…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <input type="number" min="0.01" step="0.01" value={it.quantity} onChange={(e) => updateItem(it.key, "quantity", e.target.value)} className="w-20 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" />
                  <input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => updateItem(it.key, "unit_price", e.target.value)} className="w-24 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none" />
                  <button type="button" onClick={() => removeItem(it.key)} className="w-9 h-9 shrink-0 rounded-xl hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف آیتم"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <Input label="یادداشت" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

          <div className="flex items-center justify-between border-t border-ink-100 pt-4">
            <span className="text-sm text-ink-500">مجموع سفارش</span>
            <span className="font-display font-semibold text-lg text-ink-900">{formatCurrency(total)}</span>
          </div>

          {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد سفارش"}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `سفارش ${detail.order_number}` : "سفارش"}
        footer={
          detail && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {writable && detail.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => runAction(detail, "confirm")} disabled={acting}>
                    <CheckCircle2 className="w-4 h-4" /> تایید سفارش
                  </Button>
                )}
                {writable && detail.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => runAction(detail, "pay")} disabled={acting}>
                    <DollarSign className="w-4 h-4" /> ثبت پرداخت
                  </Button>
                )}
                {writable && detail.status === "paid" && (
                  <Button size="sm" onClick={() => runAction(detail, "fulfill")} disabled={acting}>
                    <PackageCheck className="w-4 h-4" /> تکمیل و تحویل
                  </Button>
                )}
                {writable && (detail.status === "paid" || detail.status === "fulfilled") && (
                  <Button size="sm" variant="outline" onClick={() => createInvoice(detail)} disabled={acting}>
                    صدور فاکتور
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {writable && <Button size="sm" variant="ghost" onClick={() => { setDetail(null); openEdit(detail); }}>ویرایش</Button>}
                {admin && <Button size="sm" variant="danger" onClick={() => setToDelete(detail)}><Trash2 className="w-4 h-4" /> حذف</Button>}
              </div>
            </div>
          )
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailField label="مشتری" value={detail.customer_name} />
              <DetailField label="وضعیت" value={ORDER_STATUS[detail.status]?.label} badge={ORDER_STATUS[detail.status]?.tone} />
              <DetailField label="تاریخ سفارش" value={formatDate(detail.order_date)} />
              <DetailField label="سررسید" value={formatDate(detail.due_date)} />
              <DetailField label="تاریخ ایجاد" value={formatDate(detail.created_at)} />
              <DetailField label="مجموع" value={formatCurrency(detail.total_amount)} mono />
            </div>

            <div>
              <h4 className="font-display font-semibold text-ink-900 mb-3">آیتم‌های سفارش</h4>
              <div className="rounded-xl border border-ink-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ink-100/60 text-ink-500 text-right">
                    <tr>
                      <th className="px-3 py-2 font-medium">محصول</th>
                      <th className="px-3 py-2 font-medium text-center">تعداد</th>
                      <th className="px-3 py-2 font-medium text-right">قیمت واحد</th>
                      <th className="px-3 py-2 font-medium text-right">جمع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items?.map((it) => (
                      <tr key={it.id} className="border-t border-ink-100">
                        <td className="px-3 py-2.5 text-ink-900">{it.product_name}<span className="text-xs text-ink-500 font-mono block">{it.sku}</span></td>
                        <td className="px-3 py-2.5 text-center font-mono">{it.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(it.unit_price)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(it.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ink-100 bg-ink-100/40">
                      <td colSpan={3} className="px-3 py-2.5 text-left font-medium text-ink-700">مجموع کل</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink-900">{formatCurrency(detail.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {detail.notes && (
              <div>
                <h4 className="font-display font-semibold text-ink-900 mb-2">یادداشت</h4>
                <p className="text-sm text-ink-700 whitespace-pre-line rounded-xl bg-ink-100/60 p-3">{detail.notes}</p>
              </div>
            )}

            <div className="rounded-xl bg-ink-100/60 p-3 text-sm text-ink-500">
              <p>گردش کار سفارش: پیش‌نویس ← در انتظار پرداخت ← پرداخت‌شده ← تکمیل‌شده. از دکمه‌های پایین صفحه برای پیش بردن وضعیت استفاده کنید (تغییر مستقیم فیلد وضعیت، حرکت موجودی را انجام نمی‌دهد).</p>
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف سفارش"
        message={`آیا از حذف سفارش «${toDelete?.order_number}» مطمئن هستید؟`}
        confirmText="حذف"
      />
    </div>
  );
}

function DetailField({ label, value, badge, mono }) {
  return (
    <div>
      <p className="text-ink-500 mb-1">{label}</p>
      {badge ? (
        <Badge tone={badge}>{value || "—"}</Badge>
      ) : (
        <p className={`text-ink-900 font-medium ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
      )}
    </div>
  );
}
