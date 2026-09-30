import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Search, Edit3, Trash2, Receipt, Tags } from "lucide-react";
import { financeApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, TextArea, Modal, EmptyState, Spinner,
} from "../components/ui";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { isAdmin, canWrite } from "../utils/constants";
import { formatCurrency, formatDate, todayISO } from "../utils/format";

const PAGE_SIZE = 25;

// Free-text category on the backend, but the UI offers a fixed list of
// common Persian categories plus "سایر" (other) for both the filter Select
// and the create/edit form Select. The backend accepts any string here
// (max 100 chars), so previously-saved categories outside this list still
// render via the Badge in the table.
const COMMON_CATEGORIES = [
  "اجاره",
  "حقوق",
  "تأمین",
  "تسویه",
  "بازاریابی",
  "اداری",
  "سایر",
];

const emptyForm = {
  title: "",
  amount: "",
  category: "سایر",
  description: "",
  expense_date: todayISO(),
};

export default function ExpensesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const writable = canWrite(user?.role);
  const admin = isAdmin(user?.role);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Server-side: ?category=<string> + ?page. Backend ordering is
  // -expense_date, -created_at. There is no server-side text search, so
  // ?title=/description search is done client-side on the loaded page.
  const load = useCallback(() => {
    setLoading(true);
    financeApi
      .listExpenses({
        category: categoryFilter || undefined,
        page,
      })
      .then((res) => {
        const results = res.data.results ?? res.data;
        setItems(results);
        setCount(res.data.count ?? results.length);
      })
      .catch((e) => {
        toast.error(errMsg(e, "بارگذاری هزینه‌ها ناموفق بود."));
        setItems([]);
        setCount(0);
      })
      .finally(() => setLoading(false));
  }, [categoryFilter, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to first page when the server-side category filter changes.
  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  // Client-side search filter on title + description of the loaded page.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((e) => {
      const title = (e.title || "").toLowerCase();
      const desc = (e.description || "").toLowerCase();
      return title.includes(term) || desc.includes(term);
    });
  }, [items, search]);

  // Sum of the currently-loaded page's expenses. "این صفحه" refers to the
  // server-paginated page (the items state) — not the client-side search
  // subset, so the total stays consistent as the user types in the search.
  const pageSum = useMemo(
    () => items.reduce((acc, e) => acc + Number(e.amount || 0), 0),
    [items]
  );

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, expense_date: todayISO() });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setForm({
      title: expense.title || "",
      amount: expense.amount != null ? String(expense.amount) : "",
      category: expense.category || "سایر",
      description: expense.description || "",
      expense_date: expense.expense_date || todayISO(),
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("عنوان هزینه را وارد کنید.");
      return;
    }
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("مبلغ باید عددی بزرگ‌تر از صفر باشد.");
      return;
    }
    if (!form.expense_date) {
      setError("تاریخ هزینه را وارد کنید.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        amount: amountNum,
        category: form.category || "سایر",
        description: form.description || "",
        expense_date: form.expense_date,
      };
      if (editing) {
        await financeApi.updateExpense(editing.id, payload);
        toast.success("هزینه به‌روز شد");
      } else {
        await financeApi.createExpense(payload);
        toast.success("هزینه ثبت شد");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این هزینه ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await financeApi.removeExpense(toDelete.id);
      toast.success("هزینه حذف شد");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف این هزینه ممکن نشد."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="هزینه‌ها"
        description="ثبت و پیگیری هزینه‌های کسب‌وکار"
        actions={
          writable ? (
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> افزودن هزینه
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس عنوان یا توضیح…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="sm:w-48"
        >
          <option value="">همه دسته‌ها</option>
          {COMMON_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm text-ink-500">
        <Tags className="w-4 h-4 text-ink-500" />
        <span>
          مجموع این صفحه:{" "}
          <span className="font-mono text-ink-900">{formatCurrency(pageSum)}</span>
        </span>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="هنوز هزینه‌ای ثبت نشده"
            description="برای پیگیری هزینه‌های کسب‌وکار، اولین هزینه را ثبت کنید."
            action={
              writable ? (
                <Button onClick={openCreate}>
                  <Plus className="w-4 h-4" /> افزودن هزینه
                </Button>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="موردی یافت نشد"
            description="با عبارت جستجوی فعلی روی این صفحه موردی پیدا نشد. عبارت را تغییر دهید یا صفحه بعدی را بررسی کنید."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">عنوان</th>
                  <th className="px-5 py-3 font-medium">دسته‌بندی</th>
                  <th className="px-5 py-3 font-medium text-right">مبلغ</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">
                    تاریخ
                  </th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">
                    ثبت توسط
                  </th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink-900">{e.title}</p>
                      {e.description && (
                        <p className="text-xs text-ink-500 line-clamp-1 max-w-xs">
                          {e.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone="neutral">{e.category || "سایر"}</Badge>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-ink-900 text-right whitespace-nowrap">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell text-ink-700 whitespace-nowrap">
                      {formatDate(e.expense_date)}
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500 whitespace-nowrap">
                      {e.created_by_name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        {writable && (
                          <button
                            onClick={() => openEdit(e)}
                            className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center transition-colors"
                            aria-label="ویرایش"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {admin && (
                          <button
                            onClick={() => setToDelete(e)}
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
        title={editing ? "ویرایش هزینه" : "افزودن هزینه"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="عنوان"
            required
            value={form.title}
            onChange={update("title")}
            placeholder="مثلاً: اجاره دفتر مرداد"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="مبلغ"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={update("amount")}
            />
            <Select
              label="دسته‌بندی"
              value={form.category}
              onChange={update("category")}
            >
              {COMMON_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="تاریخ هزینه"
            type="date"
            required
            max={todayISO()}
            value={form.expense_date}
            onChange={update("expense_date")}
          />
          <TextArea
            label="توضیحات"
            rows={3}
            value={form.description}
            onChange={update("description")}
            placeholder="توضیحات اختیاری درباره این هزینه…"
          />
          {error && (
            <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت هزینه"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف هزینه"
        message={`آیا از حذف هزینه «${toDelete?.title}» مطمئن هستید؟`}
        confirmText="حذف"
      />
    </div>
  );
}
