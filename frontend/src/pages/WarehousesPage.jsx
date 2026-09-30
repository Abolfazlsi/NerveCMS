import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Search, Warehouse, Edit3, Trash2, MapPin } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, TextArea, EmptyState, Modal, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { canWrite, isAdmin } from "../utils/constants";
import { formatNumber, formatDateTime } from "../utils/format";

const PAGE_SIZE = 25;

// WarehouseViewSet is a plain BusinessScopedViewSet with NO server-side search,
// so we do client-side filtering on the loaded page results by name/code/address.
const emptyForm = {
  name: "", code: "", address: "", is_active: true, is_default: false,
};

export default function WarehousesPage() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listWarehouses({ page })
      .then((res) => {
        setItems(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .catch(() => {
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Client-side filter on the loaded page results.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) =>
      (w.name || "").toLowerCase().includes(q) ||
      (w.code || "").toLowerCase().includes(q) ||
      (w.address || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (w) => {
    setEditing(w);
    setForm({
      name: w.name || "",
      code: w.code || "",
      address: w.address || "",
      is_active: w.is_active !== false,
      is_default: !!w.is_default,
    });
    setError("");
    setModalOpen(true);
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        code: form.code,
        address: form.address,
        is_active: !!form.is_active,
        is_default: !!form.is_default,
      };
      if (editing) {
        await inventoryApi.updateWarehouse(editing.id, payload);
        toast.success("انبار به‌روز شد.");
      } else {
        await inventoryApi.createWarehouse(payload);
        toast.success("انبار اضافه شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این انبار ممکن نشد. لطفاً فیلدها را بررسی کنید."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await inventoryApi.removeWarehouse(toDelete.id);
      toast.success("انبار حذف شد.");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف این انبار ممکن نشد. ممکن است کالاهایی در آن ثبت شده باشند."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="انبارها"
        description="مدیریت انبارها و محل‌های نگهداری کالا"
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> افزودن انبار
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام، کد یا آدرس انبار…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="هنوز انباری وجود ندارد"
            description="اولین انبار را اضافه کنید تا محل نگهداری کالاها را مدیریت کنید."
            action={
              writable ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> افزودن انبار
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">نام</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">آدرس</th>
                  <th className="px-5 py-3 font-medium">پیش‌فرض</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">تعداد کالا</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">تاریخ افزودن</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr className="border-b border-ink-100 last:border-0">
                    <td colSpan={7} className="px-5 py-10 text-center text-ink-500">
                      نتیجه‌ای مطابق با جستجوی شما یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filtered.map((w) => (
                    <tr key={w.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-ink-900">{w.name}</p>
                        <p className="text-xs text-ink-500 font-mono">{w.code}</p>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-ink-700">
                        {w.address ? (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-ink-500 mt-0.5 shrink-0" />
                            <span className="text-ink-700 whitespace-pre-line">{w.address}</span>
                          </div>
                        ) : (
                          <span className="text-ink-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {w.is_default ? (
                          <Badge tone="brand">پیش‌فرض</Badge>
                        ) : (
                          <span className="text-ink-500">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {w.is_active ? (
                          <Badge tone="good">فعال</Badge>
                        ) : (
                          <Badge tone="neutral">غیرفعال</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell font-mono text-ink-700">
                        {formatNumber(w.stock_count ?? 0)}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500">
                        {formatDateTime(w.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {writable && (
                            <button
                              onClick={() => openEdit(w)}
                              className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center"
                              aria-label="ویرایش"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {admin && (
                            <button
                              onClick={() => setToDelete(w)}
                              className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                              aria-label="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading} />
      </Card>

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "ویرایش انبار" : "افزودن انبار"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="نام" required value={form.name} onChange={update("name")} />
            <Input label="کد" required value={form.code} onChange={update("code")} />
          </div>
          <TextArea label="آدرس" rows={2} value={form.address} onChange={update("address")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-ink-100 bg-ink-100/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-ink-300"
              />
              <span className="text-sm text-ink-700">فعال</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-ink-100 bg-ink-100/40 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                className="w-4 h-4 rounded border-ink-300"
              />
              <span className="text-sm text-ink-700">انبار پیش‌فرض</span>
            </label>
          </div>
          {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "افزودن انبار"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف انبار"
        message={`آیا از حذف انبار «${toDelete?.name}» مطمئن هستید؟`}
        confirmText="حذف"
      />
    </div>
  );
}
