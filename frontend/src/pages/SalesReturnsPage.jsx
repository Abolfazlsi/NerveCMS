import { useEffect, useState, useCallback } from "react";
import { Plus, Eye, Edit3, Trash2, CheckCircle2, Undo2 } from "lucide-react";
import { salesApi, inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Select, TextArea, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { RETURN_STATUS, isAdmin, canWrite } from "../utils/constants";
import { formatDateTime } from "../utils/format";
import { collectAll } from "../utils/fetch";

const PAGE_SIZE = 25;

const emptyItem = () => ({ product: "", quantity: 1, key: Math.random() });
const emptyForm = { order: "", warehouse: "", reason: "", items: [emptyItem()] };

// Label for an order in dropdowns / lookups: "سفارش {order_number}" (with optional
// customer suffix). Falls back to "سفارش #id" if order_number is missing.
const orderLabel = (o) => {
  if (!o) return "—";
  const base = o.order_number ? `سفارش ${o.order_number}` : `سفارش #${o.id}`;
  return o.customer_name ? `${base} — ${o.customer_name}` : base;
};

export default function SalesReturnsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);

  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [toComplete, setToComplete] = useState(null);
  const [completing, setCompleting] = useState(false);

  // Load dropdown sources once on mount.
  useEffect(() => {
    collectAll(salesApi.list).then(setOrders).catch(() => {});
    collectAll(inventoryApi.listWarehouses).then(setWarehouses).catch(() => {});
    collectAll(inventoryApi.listProducts).then(setProducts).catch(() => {});
  }, []);

  const orderLabelById = (id) => {
    if (!id) return "—";
    const o = orders.find((x) => String(x.id) === String(id));
    if (!o) return `سفارش #${id}`;
    return o.order_number ? `سفارش ${o.order_number}` : `سفارش #${o.id}`;
  };
  const warehouseNameById = (id) => {
    if (!id) return "—";
    const w = warehouses.find((x) => String(x.id) === String(id));
    return w ? w.name : `انبار #${id}`;
  };

  const load = useCallback(() => {
    setLoading(true);
    salesApi
      .listReturns({
        status: statusFilter || undefined,
        page,
      })
      .then((res) => {
        const data = res.data;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCount(data.count ?? results.length);
        setItems(results);
      })
      .catch(() => {
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const updateItem = (key, field, value) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => (it.key === key ? { ...it, [field]: value } : it)),
    }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (key) =>
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.key !== key) }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, items: [emptyItem()] });
    setError("");
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    try {
      const { data } = await salesApi.getReturn(row.id);
      setEditing(data);
      setForm({
        order: data.order || "",
        warehouse: data.warehouse || "",
        reason: data.reason || "",
        items: (data.items?.length ? data.items : [emptyItem()]).map((it) => ({
          product: it.product,
          quantity: it.quantity,
          key: Math.random(),
        })),
      });
      setError("");
      setModalOpen(true);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری مرجوعی برای ویرایش ناموفق بود."));
    }
  };

  const openDetail = async (row) => {
    setDetail(row);
    setDetailLoading(true);
    try {
      const { data } = await salesApi.getReturn(row.id);
      setDetail(data);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری جزئیات مرجوعی ناموفق بود."));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (id) => {
    try {
      const { data } = await salesApi.getReturn(id);
      setDetail(data);
    } catch {
      /* keep existing detail on refresh failure */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.order || !form.warehouse) {
      setError("لطفاً سفارش و انبار را انتخاب کنید.");
      return;
    }
    const cleanItems = form.items
      .filter((it) => it.product)
      .map((it) => ({
        product: Number(it.product),
        quantity: Number(it.quantity),
      }))
      .filter((it) => Number.isFinite(it.product) && Number.isFinite(it.quantity) && it.quantity > 0);
    if (cleanItems.length === 0) {
      setError("حداقل یک آیتم با کالا و تعداد معتبر نیاز است.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        order: Number(form.order),
        warehouse: Number(form.warehouse),
        reason: form.reason || undefined,
        items: cleanItems,
      };
      if (editing) {
        await salesApi.updateReturn(editing.id, payload);
        toast.success("مرجوعی به‌روز شد");
      } else {
        await salesApi.createReturn(payload);
        toast.success("مرجوعی ثبت شد");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این مرجوعی ممکن نشد. حداقل یک آیتم نیاز است."));
    } finally {
      setSaving(false);
    }
  };

  const confirmComplete = async () => {
    if (!toComplete) return;
    setCompleting(true);
    try {
      await salesApi.completeReturn(toComplete.id);
      toast.success("مرجوعی تکمیل شد و موجودی به‌روز شد");
      setToComplete(null);
      if (detail?.id === toComplete.id) await refreshDetail(toComplete.id);
      load();
    } catch (e) {
      toast.error(errMsg(e, "تکمیل مرجوعی ناموفق بود."));
    } finally {
      setCompleting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await salesApi.removeReturn(toDelete.id);
      toast.success("مرجوعی حذف شد");
      if (detail?.id === toDelete.id) setDetail(null);
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف مرجوعی ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="مرجوعی فروش"
        description="بازگشت کالا از مشتری و ورود مجدد به انبار"
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> مرجوعی جدید
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(RETURN_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title="هنوز مرجوعی فروش ثبت نشده"
            description="برای بازگرداندن کالای فروخته‌شده از سوی مشتری، یک مرجوعی جدید ثبت کنید تا ورود مجدد کالا به انبار به‌صورت خودکار انجام شود."
            action={
              writable ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> مرجوعی جدید
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">سفارش مرجط</th>
                  <th className="px-5 py-3 font-medium">انبار</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">دلیل</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">تاریخ</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">تکمیل</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const st = RETURN_STATUS[r.status] || { label: r.status, tone: "neutral" };
                  const isDraft = r.status === "draft";
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-ink-900 whitespace-nowrap">
                        {orderLabelById(r.order)}
                      </td>
                      <td className="px-5 py-3.5 text-ink-700 whitespace-nowrap">
                        {r.warehouse_name || warehouseNameById(r.warehouse)}
                      </td>
                      <td
                        className="px-5 py-3.5 hidden md:table-cell text-ink-500 max-w-xs truncate"
                        title={r.reason || ""}
                      >
                        {r.reason || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-ink-500 whitespace-nowrap">
                        {formatDateTime(r.created_at)}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500 whitespace-nowrap">
                        {r.completed_at ? formatDateTime(r.completed_at) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(r)}
                            className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                            aria-label="جزئیات"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {writable && isDraft && (
                            <button
                              onClick={() => openEdit(r)}
                              className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                              aria-label="ویرایش"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {writable && isDraft && (
                            <button
                              onClick={() => setToComplete(r)}
                              className="w-8 h-8 rounded-lg hover:bg-good-100 text-ink-500 hover:text-good-600 flex items-center justify-center"
                              aria-label="تکمیل مرجوعی"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {admin && (
                            <button
                              onClick={() => setToDelete(r)}
                              className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                              aria-label="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
        <Pagination
          count={count}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          loading={loading}
        />
      </Card>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "ویرایش مرجوعی" : "مرجوعی جدید"}
        width="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <Select
            label="سفارش"
            required
            value={form.order}
            onChange={update("order")}
          >
            <option value="">انتخاب سفارش…</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {orderLabel(o)}
              </option>
            ))}
          </Select>

          <Select
            label="انبار"
            required
            value={form.warehouse}
            onChange={update("warehouse")}
          >
            <option value="">انتخاب انبار…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>

          <TextArea
            label="دلیل (اختیاری)"
            rows={3}
            value={form.reason}
            onChange={update("reason")}
            placeholder="کالای معیوب، انقضا، سفارش اشتباه…"
          />

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
              {form.items.map((it) => (
                <div key={it.key} className="flex items-center gap-2">
                  <select
                    value={it.product}
                    onChange={(e) => updateItem(it.key, "product", e.target.value)}
                    className="flex-1 rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                  >
                    <option value="">انتخاب کالا…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) => updateItem(it.key, "quantity", e.target.value)}
                    className="w-24 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                    aria-label="تعداد"
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

          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت مرجوعی"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title="مرجوعی فروش"
        footer={
          detail && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {writable && detail.status === "draft" && (
                  <Button size="sm" onClick={() => setToComplete(detail)} disabled={completing}>
                    <CheckCircle2 className="w-4 h-4" /> تکمیل مرجوعی
                  </Button>
                )}
                {writable && detail.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetail(null);
                      openEdit(detail);
                    }}
                  >
                    <Edit3 className="w-4 h-4" /> ویرایش
                  </Button>
                )}
              </div>
              {admin && (
                <Button size="sm" variant="danger" onClick={() => setToDelete(detail)}>
                  <Trash2 className="w-4 h-4" /> حذف
                </Button>
              )}
            </div>
          )
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailField label="سفارش" value={orderLabelById(detail.order)} mono />
              <DetailField
                label="انبار"
                value={detail.warehouse_name || warehouseNameById(detail.warehouse)}
              />
              <DetailField
                label="وضعیت"
                value={RETURN_STATUS[detail.status]?.label || detail.status}
                badge={RETURN_STATUS[detail.status]?.tone}
              />
              <DetailField label="ثبت توسط" value={detail.created_by_name || "—"} />
              <DetailField label="تاریخ ایجاد" value={formatDateTime(detail.created_at)} />
              <DetailField
                label="تاریخ تکمیل"
                value={detail.completed_at ? formatDateTime(detail.completed_at) : "—"}
              />
            </div>

            {detail.reason && (
              <div>
                <h4 className="font-display font-semibold text-ink-900 mb-2">دلیل</h4>
                <p className="text-sm text-ink-700 whitespace-pre-line rounded-xl bg-ink-100/60 p-3">
                  {detail.reason}
                </p>
              </div>
            )}

            <div>
              <h4 className="font-display font-semibold text-ink-900 mb-3">آیتم‌های مرجوعی</h4>
              <div className="rounded-xl border border-ink-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ink-100/60 text-ink-500 text-right">
                    <tr>
                      <th className="px-3 py-2 font-medium">کالا</th>
                      <th className="px-3 py-2 font-medium text-center">تعداد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items?.length ? (
                      detail.items.map((it, idx) => (
                        <tr key={it.id ?? idx} className="border-t border-ink-100">
                          <td className="px-3 py-2.5 text-ink-900">{it.product_name || "—"}</td>
                          <td className="px-3 py-2.5 text-center font-mono text-ink-900">
                            {it.quantity}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-ink-100">
                        <td colSpan={2} className="px-3 py-4 text-center text-ink-500">
                          آیتمی ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl bg-ink-100/60 p-3 text-sm text-ink-500">
              <p>
                تکمیل مرجوعی، برای هر آیتم یک حرکت «ورود» به انبار ثبت می‌کند و کالاها مجدداً
                وارد انبار می‌شوند. این عملیات قابل بازگشت نیست.
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* Complete confirm */}
      <ConfirmDialog
        open={!!toComplete}
        onClose={() => setToComplete(null)}
        onConfirm={confirmComplete}
        loading={completing}
        title="تکمیل مرجوعی"
        message="تکمیل این مرجوعی؟ کالاها مجدداً وارد انبار می‌شوند."
        confirmText="تکمیل"
        tone="primary"
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف مرجوعی"
        message={`آیا از حذف مرجوعی «${toDelete ? orderLabelById(toDelete.order) : ""}» مطمئن هستید؟`}
        confirmText="حذف"
        tone="danger"
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
