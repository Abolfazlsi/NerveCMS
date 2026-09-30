import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Eye, Edit3, Trash2, PackageCheck, Package, Search } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, TextArea, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { PURCHASE_STATUS, isAdmin, canWrite } from "../utils/constants";
import { collectAll } from "../utils/fetch";
import { formatCurrency, formatDate, todayISO } from "../utils/format";

const PAGE_SIZE = 25;

const emptyItem = () => ({ product: "", quantity: 1, purchase_price: 0, key: Math.random() });

const emptyForm = {
  supplier: "",
  warehouse: "",
  purchase_date: todayISO(),
  status: "draft",
  discount: 0,
  tax: 0,
  notes: "",
  items: [emptyItem()],
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [count, setCount] = useState(0);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
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

  const [receiveConfirm, setReceiveConfirm] = useState(null);
  const [receiving, setReceiving] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  // Build id → name lookup maps for table display (the PurchaseSerializer
  // only returns supplier/warehouse IDs, not their names).
  const supplierName = useMemo(() => {
    const map = new Map();
    suppliers.forEach((s) => map.set(String(s.id), s.name));
    return map;
  }, [suppliers]);

  const warehouseName = useMemo(() => {
    const map = new Map();
    warehouses.forEach((w) => map.set(String(w.id), w.name));
    return map;
  }, [warehouses]);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listPurchases({ status: statusFilter || undefined, page })
      .then((res) => {
        setPurchases(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .catch(() => {
        setPurchases([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => {
    collectAll(inventoryApi.listSuppliers).then(setSuppliers).catch(() => {});
    collectAll(inventoryApi.listWarehouses).then(setWarehouses).catch(() => {});
    collectAll(inventoryApi.listProducts).then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, supplierFilter]);

  // Client-side supplier filter on the loaded page (no server-side search).
  const visiblePurchases = useMemo(() => {
    if (!supplierFilter) return purchases;
    return purchases.filter((p) => String(p.supplier) === String(supplierFilter));
  }, [purchases, supplierFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, purchase_date: todayISO(), items: [emptyItem()] });
    setError("");
    setModalOpen(true);
  };

  const openEdit = async (purchase) => {
    try {
      const { data } = await inventoryApi.getPurchase(purchase.id);
      setEditing(data);
      setForm({
        supplier: data.supplier || "",
        warehouse: data.warehouse || "",
        purchase_date: data.purchase_date || todayISO(),
        status: data.status,
        discount: data.discount ?? 0,
        tax: data.tax ?? 0,
        notes: data.notes || "",
        items: (data.items?.length ? data.items : [emptyItem()]).map((it) => ({
          product: it.product,
          quantity: it.quantity,
          purchase_price: it.purchase_price,
          key: Math.random(),
        })),
      });
      setError("");
      setModalOpen(true);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری خرید برای ویرایش ناموفق بود."));
    }
  };

  const openDetail = async (purchase) => {
    setDetail(purchase);
    setDetailLoading(true);
    try {
      const { data } = await inventoryApi.getPurchase(purchase.id);
      setDetail(data);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری جزئیات خرید ناموفق بود."));
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
          if (product) next.purchase_price = product.cost_price;
        }
        return next;
      }),
    }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (key) =>
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.key !== key) }));

  const subtotal = form.items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.purchase_price || 0),
    0
  );
  const grandTotal =
    subtotal - Number(form.discount || 0) + Number(form.tax || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        supplier: Number(form.supplier),
        warehouse: Number(form.warehouse),
        purchase_date: form.purchase_date,
        status: form.status,
        discount: Number(form.discount || 0),
        tax: Number(form.tax || 0),
        notes: form.notes,
        items: form.items
          .filter((it) => it.product)
          .map((it) => ({
            product: Number(it.product),
            quantity: Number(it.quantity),
            purchase_price: Number(it.purchase_price),
          })),
      };
      if (editing) {
        await inventoryApi.updatePurchase(editing.id, payload);
        toast.success("خرید به‌روز شد.");
      } else {
        await inventoryApi.createPurchase(payload);
        toast.success("خرید ایجاد شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این خرید ممکن نشد. حداقل یک آیتم نیاز است."));
    } finally {
      setSaving(false);
    }
  };

  const confirmReceive = async () => {
    if (!receiveConfirm) return;
    setReceiving(true);
    try {
      await inventoryApi.receivePurchase(receiveConfirm.id);
      toast.success("کالا دریافت شد و موجودی به‌روز شد");
      setReceiveConfirm(null);
      await load();
      if (detail?.id === receiveConfirm.id) {
        try {
          const { data } = await inventoryApi.getPurchase(receiveConfirm.id);
          setDetail(data);
        } catch {
          /* keep stale detail */
        }
      }
    } catch (e) {
      toast.error(errMsg(e, "دریافت کالا ناموفق بود. ممکن است این خرید قبلاً دریافت شده باشد."));
    } finally {
      setReceiving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await inventoryApi.removePurchase(toDelete.id);
      toast.success("خرید حذف شد.");
      if (detail?.id === toDelete.id) setDetail(null);
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف خرید ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="خریدها"
        description="مدیریت سفارشات خرید از تأمین‌کنندگان و ثبت رسید کالا"
        actions={
          writable && (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> خرید جدید
            </Button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(PURCHASE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="sm:w-56"
        >
          <option value="">همه تأمین‌کنندگان</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={Package}
            title="هنوز خریدی ثبت نشده"
            description="اولین سفارش خرید از تأمین‌کنندگان را ثبت کنید."
            action={
              writable && (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> خرید جدید
                </Button>
              )
            }
          />
        ) : visiblePurchases.length === 0 ? (
          <EmptyState
            icon={Search}
            title="موردی یافت نشد"
            description="با فیلتر انتخاب‌شده خریدی در این صفحه وجود ندارد."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">شماره خرید</th>
                  <th className="px-5 py-3 font-medium">تأمین‌کننده</th>
                  <th className="px-5 py-3 font-medium">انبار</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">تاریخ</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium text-right">مبلغ کل</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visiblePurchases.map((p) => {
                  const st = PURCHASE_STATUS[p.status] || {
                    label: p.status,
                    tone: "neutral",
                  };
                  const supName =
                    supplierName.get(String(p.supplier)) || `#${p.supplier}`;
                  const whName =
                    warehouseName.get(String(p.warehouse)) || `#${p.warehouse}`;
                  const canReceive =
                    writable && (p.status === "draft" || p.status === "ordered");
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                    >
                      <td
                        className="px-5 py-3.5 font-mono text-ink-900 cursor-pointer"
                        onClick={() => openDetail(p)}
                      >
                        {p.purchase_number}
                      </td>
                      <td
                        className="px-5 py-3.5 text-ink-900 cursor-pointer"
                        onClick={() => openDetail(p)}
                      >
                        {supName}
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">{whName}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell text-ink-500">
                        {formatDate(p.purchase_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td
                        className="px-5 py-3.5 text-right font-mono text-ink-900 cursor-pointer"
                        onClick={() => openDetail(p)}
                      >
                        {formatCurrency(p.total_amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(p)}
                            className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                            aria-label="جزئیات"
                            title="جزئیات"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {writable && (
                            <button
                              onClick={() => openEdit(p)}
                              className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                              aria-label="ویرایش"
                              title="ویرایش"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canReceive && (
                            <button
                              onClick={() => setReceiveConfirm(p)}
                              className="w-8 h-8 rounded-lg hover:bg-good-100 text-ink-500 hover:text-good-600 flex items-center justify-center"
                              aria-label="دریافت کالا"
                              title="دریافت کالا"
                            >
                              <PackageCheck className="w-4 h-4" />
                            </button>
                          )}
                          {admin && (
                            <button
                              onClick={() => setToDelete(p)}
                              className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                              aria-label="حذف"
                              title="حذف"
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
        title={editing ? `ویرایش ${editing.purchase_number}` : "خرید جدید"}
        width="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="تأمین‌کننده"
              required
              value={form.supplier}
              onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            >
              <option value="">انتخاب تأمین‌کننده…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              label="انبار"
              required
              value={form.warehouse}
              onChange={(e) => setForm((f) => ({ ...f, warehouse: e.target.value }))}
            >
              <option value="">انتخاب انبار…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="تاریخ خرید"
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
            />
            <Select
              label="وضعیت"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {Object.entries(PURCHASE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
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
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={it.quantity}
                    onChange={(e) => updateItem(it.key, "quantity", e.target.value)}
                    className="w-20 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                    aria-label="تعداد"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={it.purchase_price}
                    onChange={(e) => updateItem(it.key, "purchase_price", e.target.value)}
                    className="w-28 rounded-xl border border-ink-300 bg-white px-2.5 py-2 text-sm text-center focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none"
                    aria-label="قیمت خرید"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="w-9 h-9 shrink-0 rounded-xl hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                    aria-label="حذف آیتم"
                    title="حذف آیتم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="تخفیف"
              type="number"
              min="0"
              step="0.01"
              value={form.discount}
              onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
            />
            <Input
              label="مالیات"
              type="number"
              min="0"
              step="0.01"
              value={form.tax}
              onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))}
            />
          </div>

          <TextArea
            label="یادداشت"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <div className="border-t border-ink-100 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">جمع کل آیتم‌ها</span>
              <span className="font-mono text-ink-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">تخفیف</span>
              <span className="font-mono text-bad-600">− {formatCurrency(Number(form.discount || 0))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-500">مالیات</span>
              <span className="font-mono text-warn-600">+ {formatCurrency(Number(form.tax || 0))}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink-100 pt-2">
              <span className="text-sm font-medium text-ink-700">مبلغ کل</span>
              <span className="font-display font-semibold text-lg text-ink-900 font-mono">
                {formatCurrency(grandTotal)}
              </span>
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
              {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد خرید"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `خرید ${detail.purchase_number}` : "خرید"}
        footer={
          detail && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {writable && (detail.status === "draft" || detail.status === "ordered") && (
                  <Button
                    size="sm"
                    onClick={() => setReceiveConfirm(detail)}
                  >
                    <PackageCheck className="w-4 h-4" /> دریافت کالا
                  </Button>
                )}
                {writable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDetail(null);
                      openEdit(detail);
                    }}
                  >
                    ویرایش
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
              <DetailField
                label="تأمین‌کننده"
                value={supplierName.get(String(detail.supplier)) || `#${detail.supplier}`}
              />
              <DetailField
                label="انبار"
                value={warehouseName.get(String(detail.warehouse)) || `#${detail.warehouse}`}
              />
              <DetailField label="تاریخ خرید" value={formatDate(detail.purchase_date)} />
              <DetailField
                label="وضعیت"
                value={PURCHASE_STATUS[detail.status]?.label}
                badge={PURCHASE_STATUS[detail.status]?.tone}
              />
              <DetailField label="تاریخ ایجاد" value={formatDate(detail.created_at)} />
              <DetailField label="تاریخ به‌روزرسانی" value={formatDate(detail.updated_at)} />
            </div>

            <div>
              <h4 className="font-display font-semibold text-ink-900 mb-3">آیتم‌های خرید</h4>
              <div className="rounded-xl border border-ink-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ink-100/60 text-ink-500 text-right">
                    <tr>
                      <th className="px-3 py-2 font-medium">کالا</th>
                      <th className="px-3 py-2 font-medium text-center">تعداد</th>
                      <th className="px-3 py-2 font-medium text-right">قیمت خرید</th>
                      <th className="px-3 py-2 font-medium text-right">جمع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items?.map((it) => (
                      <tr key={it.id} className="border-t border-ink-100">
                        <td className="px-3 py-2.5 text-ink-900">
                          {it.product_name || `#${it.product}`}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono">{it.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {formatCurrency(it.purchase_price)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {formatCurrency(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-ink-100 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-500">جمع کل آیتم‌ها</span>
                <span className="font-mono text-ink-900">{formatCurrency(detail.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">تخفیف</span>
                <span className="font-mono text-bad-600">− {formatCurrency(detail.discount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500">مالیات</span>
                <span className="font-mono text-warn-600">+ {formatCurrency(detail.tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 pt-2">
                <span className="font-medium text-ink-700">مبلغ کل</span>
                <span className="font-display font-semibold text-lg text-ink-900 font-mono">
                  {formatCurrency(detail.total_amount)}
                </span>
              </div>
            </div>

            {detail.notes && (
              <div>
                <h4 className="font-display font-semibold text-ink-900 mb-2">یادداشت</h4>
                <p className="text-sm text-ink-700 whitespace-pre-line rounded-xl bg-ink-100/60 p-3">
                  {detail.notes}
                </p>
              </div>
            )}

            <div className="rounded-xl bg-ink-100/60 p-3 text-sm text-ink-500">
              <p>
                گردش کار خرید: پیش‌نویس ← سفارش‌داده‌شده ← تحویل‌گرفته‌شده. با کلیک
                روی «دریافت کالا» موجودی انبار به‌روز می‌شود و وضعیت به
                «تحویل‌گرفته‌شده» تغییر می‌کند.
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف خرید"
        message={`آیا از حذف خرید «${toDelete?.purchase_number}» مطمئن هستید؟`}
        confirmText="حذف"
        tone="danger"
      />

      <ConfirmDialog
        open={!!receiveConfirm}
        onClose={() => setReceiveConfirm(null)}
        onConfirm={confirmReceive}
        loading={receiving}
        title="دریافت کالا"
        message="دریافت کالاهای این خرید؟ موجودی انبار به‌روز می‌شود."
        confirmText="دریافت"
        tone="primary"
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
        <p className={`text-ink-900 font-medium ${mono ? "font-mono" : ""}`}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}
