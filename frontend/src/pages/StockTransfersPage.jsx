import { useEffect, useState, useCallback } from "react";
import {
  Plus, Eye, Edit3, Trash2, CheckCircle2, ArrowLeftRight, ArrowLeft,
} from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { TRANSFER_STATUS, isAdmin, canWrite } from "../utils/constants";
import { formatNumber, formatDateTime } from "../utils/format";
import { collectAll } from "../utils/fetch";

const PAGE_SIZE = 25;

const emptyForm = {
  product: "",
  source_warehouse: "",
  destination_warehouse: "",
  quantity: 1,
  reason: "",
};

export default function StockTransfersPage() {
  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // وضعیت → server-side ?status= ; source/dest warehouses → client-side filters.
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [destFilter, setDestFilter] = useState("");
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
    collectAll(inventoryApi.listProducts).then(setProducts).catch(() => {});
    collectAll(inventoryApi.listWarehouses).then(setWarehouses).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listStockTransfers({ status: statusFilter || undefined, page })
      .then((res) => {
        const data = res.data;
        const results = Array.isArray(data) ? data : data.results ?? [];
        setCount(data.count ?? results.length);
        let filtered = results;
        if (sourceFilter) {
          filtered = filtered.filter((t) => String(t.source_warehouse) === String(sourceFilter));
        }
        if (destFilter) {
          filtered = filtered.filter((t) => String(t.destination_warehouse) === String(destFilter));
        }
        setItems(filtered);
      })
      .catch(() => {
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, sourceFilter, destFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter, destFilter]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = async (transfer) => {
    try {
      const { data } = await inventoryApi.getStockTransfer(transfer.id);
      setEditing(data);
      setForm({
        product: data.product || "",
        source_warehouse: data.source_warehouse || "",
        destination_warehouse: data.destination_warehouse || "",
        quantity: data.quantity ?? 1,
        reason: data.reason || "",
      });
      setError("");
      setModalOpen(true);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری انتقال برای ویرایش ناموفق بود."));
    }
  };

  const openDetail = async (transfer) => {
    setDetail(transfer);
    setDetailLoading(true);
    try {
      const { data } = await inventoryApi.getStockTransfer(transfer.id);
      setDetail(data);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری جزئیات انتقال ناموفق بود."));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (id) => {
    try {
      const { data } = await inventoryApi.getStockTransfer(id);
      setDetail(data);
    } catch {
      // keep existing detail if refresh fails
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product || !form.source_warehouse || !form.destination_warehouse) {
      setError("لطفاً کالا و انبارهای مبدأ و مقصد را انتخاب کنید.");
      return;
    }
    if (String(form.source_warehouse) === String(form.destination_warehouse)) {
      setError("انبار مبدأ و مقصد نمی‌توانند یکسان باشند.");
      return;
    }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("مقدار باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        product: Number(form.product),
        source_warehouse: Number(form.source_warehouse),
        destination_warehouse: Number(form.destination_warehouse),
        quantity: qty,
        reason: form.reason || undefined,
      };
      if (editing) {
        await inventoryApi.updateStockTransfer(editing.id, payload);
        toast.success("انتقال به‌روز شد.");
      } else {
        await inventoryApi.createStockTransfer(payload);
        toast.success("انتقال ایجاد شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این انتقال ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const confirmComplete = async () => {
    if (!toComplete) return;
    setCompleting(true);
    try {
      await inventoryApi.completeStockTransfer(toComplete.id);
      toast.success("انتقال تکمیل شد و موجودی به‌روز شد");
      const id = toComplete.id;
      setToComplete(null);
      await load();
      if (detail?.id === id) await refreshDetail(id);
    } catch (e) {
      toast.error(errMsg(e, "تکمیل انتقال ناموفق بود. ممکن است موجودی مبدأ کافی نباشد."));
    } finally {
      setCompleting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await inventoryApi.removeStockTransfer(toDelete.id);
      toast.success("انتقال حذف شد.");
      if (detail?.id === toDelete.id) setDetail(null);
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف انتقال ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  const filteredOut = items.length === 0 && count > 0 && (!!sourceFilter || !!destFilter);

  return (
    <div>
      <PageHeader
        title="انتقال‌های بین انباری"
        description="انتقال کالا بین انبارها و پیگیری وضعیت تکمیل"
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> انتقال جدید
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(TRANSFER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </Select>
        <div className="sm:flex-1">
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">همه انبارهای مبدأ</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </div>
        <div className="sm:flex-1">
          <Select
            value={destFilter}
            onChange={(e) => setDestFilter(e.target.value)}
          >
            <option value="">همه انبارهای مقصد</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title={filteredOut ? "در این صفحه انتقالی با این فیلتر وجود ندارد" : "هنوز انتقالی ثبت نشده"}
            description={
              filteredOut
                ? "صفحه بعدی را بررسی کنید یا فیلترها را تغییر دهید."
                : "برای جابجایی کالا بین انبارها، اولین انتقال را ثبت کنید."
            }
            action={
              writable && !filteredOut ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> انتقال جدید
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">کالا</th>
                  <th className="px-5 py-3 font-medium">مسیر</th>
                  <th className="px-5 py-3 font-medium">مقدار</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">تاریخ</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">تکمیل</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const st = TRANSFER_STATUS[t.status] || { label: t.status, tone: "neutral" };
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                    >
                      <td
                        className="px-5 py-3.5 font-medium text-ink-900 cursor-pointer"
                        onClick={() => openDetail(t)}
                      >
                        {t.product_name || "—"}
                      </td>
                      <td
                        className="px-5 py-3.5 text-ink-700 cursor-pointer"
                        onClick={() => openDetail(t)}
                      >
                        <div className="flex flex-row items-center gap-2 whitespace-nowrap">
                          <span className="font-medium text-ink-900">
                            {t.source_warehouse_name || "—"}
                          </span>
                          <ArrowLeft className="w-4 h-4 text-ink-400 shrink-0" />
                          <span className="text-ink-500">
                            {t.destination_warehouse_name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono whitespace-nowrap text-ink-900">
                        {formatNumber(t.quantity)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-ink-500 whitespace-nowrap">
                        {formatDateTime(t.created_at)}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500 whitespace-nowrap">
                        {formatDateTime(t.completed_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(t)}
                            className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                            aria-label="جزئیات"
                            title="جزئیات"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {writable && t.status === "draft" && (
                            <button
                              onClick={() => openEdit(t)}
                              className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                              aria-label="ویرایش"
                              title="ویرایش"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {writable && t.status === "draft" && (
                            <button
                              onClick={() => setToComplete(t)}
                              className="w-8 h-8 rounded-lg hover:bg-good-100 text-ink-500 hover:text-good-600 flex items-center justify-center"
                              aria-label="تکمیل انتقال"
                              title="تکمیل انتقال"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {admin && (
                            <button
                              onClick={() => setToDelete(t)}
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
        title={editing ? "ویرایش انتقال" : "انتقال جدید"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="کالا" required value={form.product} onChange={update("product")}>
            <option value="">انتخاب کالا…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="انبار مبدأ"
              required
              value={form.source_warehouse}
              onChange={update("source_warehouse")}
            >
              <option value="">انتخاب انبار…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
            <Select
              label="انبار مقصد"
              required
              value={form.destination_warehouse}
              onChange={update("destination_warehouse")}
            >
              <option value="">انتخاب انبار…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="مقدار"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.quantity}
              onChange={update("quantity")}
            />
            <Input
              label="دلیل (اختیاری)"
              value={form.reason}
              onChange={update("reason")}
              placeholder="مثلاً جابجایی بین شعبه‌ها…"
            />
          </div>
          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت انتقال"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title="انتقال"
        footer={
          detail && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {writable && detail.status === "draft" && (
                  <Button
                    size="sm"
                    onClick={() => setToComplete(detail)}
                    disabled={completing}
                  >
                    <CheckCircle2 className="w-4 h-4" /> تکمیل انتقال
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {writable && detail.status === "draft" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDetail(null); openEdit(detail); }}
                  >
                    ویرایش
                  </Button>
                )}
                {admin && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setToDelete(detail)}
                  >
                    <Trash2 className="w-4 h-4" /> حذف
                  </Button>
                )}
              </div>
            </div>
          )
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : detail ? (
          <div className="space-y-6">
            <div>
              <p className="text-ink-500 mb-1">کالا</p>
              <p className="text-ink-900 font-medium">{detail.product_name || "—"}</p>
            </div>

            <div>
              <p className="text-ink-500 mb-2">مسیر انتقال</p>
              <div className="flex flex-row items-center gap-3 rounded-xl bg-ink-100/60 p-3">
                <span className="font-medium text-ink-900">
                  {detail.source_warehouse_name || "—"}
                </span>
                <ArrowLeft className="w-5 h-5 text-brand-500 shrink-0" />
                <span className="text-ink-700">
                  {detail.destination_warehouse_name || "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailField label="مقدار" value={formatNumber(detail.quantity)} mono />
              <DetailField
                label="وضعیت"
                value={TRANSFER_STATUS[detail.status]?.label || detail.status}
                badge={TRANSFER_STATUS[detail.status]?.tone}
              />
              <DetailField label="ثبت توسط" value={detail.created_by_name} />
              <DetailField label="تاریخ ایجاد" value={formatDateTime(detail.created_at)} />
              <DetailField
                label="تاریخ تکمیل"
                value={formatDateTime(detail.completed_at)}
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

            <div className="rounded-xl bg-ink-100/60 p-3 text-sm text-ink-500">
              <p>
                تکمیل انتقال باعث خروج کالا از انبار مبدأ و ورود به انبار مقصد می‌شود.
                موجودی انبار مبدأ باید کافی باشد.
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
        title="تکمیل انتقال"
        message="تکمیل این انتقال؟ کالا از انبار مبدأ خارج و در انبار مقصد وارد می‌شود. موجودی مبدأ باید کافی باشد."
        confirmText="تکمیل انتقال"
        tone="primary"
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف انتقال"
        message={`آیا از حذف انتقال «${toDelete?.product_name || ""}» مطمئن هستید؟`}
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
        <p className={`text-ink-900 font-medium ${mono ? "font-mono" : ""}`}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}
