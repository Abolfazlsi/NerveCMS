import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Search, Truck, Edit3, Trash2, Mail, Phone } from "lucide-react";
import { inventoryApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, TextArea, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { isAdmin, canWrite } from "../utils/constants";
import { formatDateTime } from "../utils/format";

const PAGE_SIZE = 25;

const emptyForm = {
  name: "",
  company_name: "",
  phone: "",
  email: "",
  address: "",
  tax_number: "",
  notes: "",
  is_active: true,
};

export default function SuppliersPage() {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  // Server-side: page only (SupplierViewSet is a plain BusinessScopedViewSet
  // with no search filter). Search & status are filtered client-side on the
  // currently-loaded page results.
  const load = useCallback(() => {
    setLoading(true);
    inventoryApi
      .listSuppliers({ page })
      .then((res) => {
        setItems(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .catch((e) => {
        toast.error(errMsg(e, "بارگذاری تأمین‌کنندگان ناموفق بود."));
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // reset to first page when filters change (search/status are client-side,
  // but resetting page keeps UX consistent: the filtered subset lives on
  // whatever page the user is viewing, so going back to page 1 avoids
  // confusion when the filter shrinks the visible set).
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Client-side filter on the currently-loaded page results.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter === "active" && !s.is_active) return false;
      if (statusFilter === "inactive" && s.is_active) return false;
      if (!term) return true;
      const name = (s.name || "").toLowerCase();
      const company = (s.company_name || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      return name.includes(term) || company.includes(term) || phone.includes(term);
    });
  }, [items, search, statusFilter]);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name || "",
      company_name: supplier.company_name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      tax_number: supplier.tax_number || "",
      notes: supplier.notes || "",
      is_active: supplier.is_active !== false,
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        is_active: form.is_active === true || form.is_active === "true",
      };
      if (editing) {
        await inventoryApi.updateSupplier(editing.id, payload);
        toast.success("تأمین‌کننده به‌روز شد.");
      } else {
        await inventoryApi.createSupplier(payload);
        toast.success("تأمین‌کننده اضافه شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این تأمین‌کننده ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await inventoryApi.removeSupplier(toDelete.id);
      toast.success("تأمین‌کننده حذف شد.");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف این تأمین‌کننده ممکن نشد."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="تأمین‌کنندگان"
        description="مدیریت تأمین‌کنندگان کالا و خدمات"
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> افزودن تأمین‌کننده
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
            placeholder="جستجو بر اساس نام، شرکت یا تلفن…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">همه</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="هنوز تأمین‌کننده‌ای وجود ندارد"
            description="برای مدیریت خریدها و موجودی، اولین تأمین‌کننده‌ی خود را اضافه کنید."
            action={
              writable ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> افزودن تأمین‌کننده
                </Button>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="موردی یافت نشد"
            description="با فیلترهای فعلی هیچ تأمین‌کننده‌ای روی این صفحه نیست. عبارت جستجو یا وضعیت را تغییر دهید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">نام</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">تماس</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">شماره مالیاتی</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">تاریخ افزودن</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink-900">{s.name}</p>
                      {s.company_name && (
                        <p className="text-xs text-ink-500">{s.company_name}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-ink-500">
                      {s.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {s.phone}
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3.5 h-3.5" /> {s.email}
                        </div>
                      )}
                      {!s.phone && !s.email && <span className="text-ink-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-ink-700">
                      {s.tax_number || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.is_active ? (
                        <Badge tone="good">فعال</Badge>
                      ) : (
                        <Badge tone="neutral">غیرفعال</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500">
                      {formatDateTime(s.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {writable && (
                          <button
                            onClick={() => openEdit(s)}
                            className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center transition-colors"
                            aria-label="ویرایش"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {admin && (
                          <button
                            onClick={() => setToDelete(s)}
                            className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center transition-colors"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
        title={editing ? "ویرایش تأمین‌کننده" : "افزودن تأمین‌کننده"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="نام" required value={form.name} onChange={update("name")} />
          <Input
            label="نام شرکت"
            value={form.company_name}
            onChange={update("company_name")}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="تلفن" value={form.phone} onChange={update("phone")} />
            <Input
              label="ایمیل"
              type="email"
              value={form.email}
              onChange={update("email")}
            />
          </div>
          <Input
            label="شماره مالیاتی"
            value={form.tax_number}
            onChange={update("tax_number")}
          />
          <Input
            label="آدرس"
            value={form.address}
            onChange={update("address")}
          />
          <TextArea
            label="یادداشت"
            rows={3}
            value={form.notes}
            onChange={update("notes")}
          />
          <Select
            label="وضعیت"
            value={String(form.is_active)}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_active: e.target.value === "true" }))
            }
          >
            <option value="true">فعال</option>
            <option value="false">غیرفعال</option>
          </Select>
          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "در حال ذخیره…"
                : editing
                ? "ذخیره تغییرات"
                : "افزودن تأمین‌کننده"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف تأمین‌کننده"
        message={`آیا از حذف تأمین‌کننده «${toDelete?.name}» مطمئن هستید؟`}
        confirmText="حذف"
      />
    </div>
  );
}
