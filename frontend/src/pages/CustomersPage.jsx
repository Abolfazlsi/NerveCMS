import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Users, Mail, Phone, Upload, Trash2, Eye, StickyNote, ShoppingCart } from "lucide-react";
import { customersApi, salesApi } from "../api/endpoints";
import {
  PageHeader, Button, Card, Badge, Input, Select, TextArea, Modal, EmptyState, Spinner,
} from "../components/ui";
import ImportCsvModal from "../components/ImportCsvModal";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import Drawer from "../components/Drawer";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { collectAll } from "../utils/fetch";
import { CUSTOMER_STATUS, CUSTOMER_SOURCE, isAdmin } from "../utils/constants";
import { formatCurrency, formatDate, formatDateTime } from "../utils/format";

const PAGE_SIZE = 25;

const emptyForm = {
  name: "", company: "", email: "", phone: "", address: "", status: "lead",
  source: "", estimated_value: 0, tags: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState(null); // customer in drawer
  const [detailLoading, setDetailLoading] = useState(false);
  const [notes, setNotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    customersApi
      .list({ search: search || undefined, status: statusFilter || undefined, page })
      .then((res) => {
        setCustomers(res.data.results ?? res.data);
        setCount(res.data.count ?? (res.data.results ?? res.data).length);
      })
      .finally(() => setLoading(false));
  }, [search, statusFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // reset to first page when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name, company: customer.company, email: customer.email,
      phone: customer.phone, address: customer.address, status: customer.status,
      source: customer.source || "", estimated_value: customer.estimated_value, tags: customer.tags,
    });
    setError("");
    setModalOpen(true);
  };

  const openDetail = async (customer) => {
    setDetail(customer);
    setDetailLoading(true);
    setNotes([]);
    setOrders([]);
    setNoteBody("");
    try {
      const [full, noteRes, orderRes] = await Promise.all([
        customersApi.get(customer.id),
        customersApi.listNotes({ customer: customer.id }),
        collectAll(salesApi.list, { customer: customer.id }),
      ]);
      setDetail(full.data);
      // CustomerNoteViewSet doesn't filter by ?customer= server-side, so filter client-side.
      const allNotes = noteRes.data.results ?? noteRes.data;
      setNotes(allNotes.filter((n) => n.customer === customer.id));
      setOrders(orderRes);
    } catch (e) {
      toast.error(errMsg(e, "بارگذاری جزئیات مشتری ناموفق بود."));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await customersApi.update(editing.id, form);
        toast.success("مشتری به‌روز شد.");
      } else {
        await customersApi.create(form);
        toast.success("مشتری اضافه شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این مشتری ممکن نشد. لطفاً فیلدها را بررسی کنید."));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await customersApi.remove(toDelete.id);
      toast.success("مشتری حذف شد.");
      setToDelete(null);
      if (detail?.id === toDelete.id) setDetail(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف این مشتری ممکن نشد."));
    } finally {
      setDeleting(false);
    }
  };

  const addNote = async () => {
    if (!noteBody.trim() || !detail) return;
    setNoteSaving(true);
    try {
      const { data } = await customersApi.addNote(detail.id, noteBody.trim());
      setNotes((prev) => [...prev, data]);
      setNoteBody("");
      toast.success("یادداشت ثبت شد.");
    } catch (e) {
      toast.error(errMsg(e, "ثبت یادداشت ناموفق بود."));
    } finally {
      setNoteSaving(false);
    }
  };

  const removeNote = async (id) => {
    try {
      await customersApi.removeNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("یادداشت حذف شد.");
    } catch (e) {
      toast.error(errMsg(e, "حذف یادداشت ناموفق بود."));
    }
  };

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="مشتریان"
        description="همه در انتظار‌ها و روابط مشتری در یک مکان"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> وارد کردن CSV
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> افزودن مشتری
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-ink-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام، شرکت یا ایمیل…"
            className="w-full rounded-xl border border-ink-300 bg-white pl-10 pr-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48">
          <option value="">همه وضعیت‌ها</option>
          <option value="lead">در انتظار</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="هنوز مشتری‌ای وجود ندارد"
            description="اولین در انتظار یا مشتری را اضافه کنید تا قیف فروش خود را بسازید."
            action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> افزودن مشتری</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-right text-ink-500">
                  <th className="px-5 py-3 font-medium">نام</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">تماس</th>
                  <th className="px-5 py-3 font-medium">وضعیت</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">سفارش‌ها</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">مجموع خرید</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">تاریخ افزودن</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const st = CUSTOMER_STATUS[c.status] || { label: c.status, tone: "neutral" };
                  return (
                    <tr key={c.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-100/60 transition-colors">
                      <td className="px-5 py-3.5 cursor-pointer" onClick={() => openDetail(c)}>
                        <p className="font-medium text-ink-900">{c.name}</p>
                        {c.company && <p className="text-xs text-ink-500">{c.company}</p>}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-ink-500">
                        <div className="flex items-center gap-1.5">{c.email && <Mail className="w-3.5 h-3.5" />} {c.email}</div>
                        {c.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5"><Phone className="w-3.5 h-3.5" /> {c.phone}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="px-5 py-3.5 hidden sm:table-cell font-mono text-ink-700">{c.order_count ?? 0}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell font-mono text-ink-700">{formatCurrency(c.total_spent)}</td>
                      <td className="px-5 py-3.5 hidden lg:table-cell text-ink-500">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openDetail(c)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="جزئیات">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="ویرایش">
                            <StickyNote className="w-4 h-4" />
                          </button>
                          {admin && (
                            <button onClick={() => setToDelete(c)} className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف">
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
        <Pagination count={count} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loading} />
      </Card>

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "ویرایش مشتری" : "افزودن مشتری"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="نام" required value={form.name} onChange={update("name")} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="شرکت" value={form.company} onChange={update("company")} />
            <Select label="وضعیت" value={form.status} onChange={update("status")}>
              <option value="lead">در انتظار</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="ایمیل" type="email" value={form.email} onChange={update("email")} />
            <Input label="تلفن" value={form.phone} onChange={update("phone")} />
          </div>
          <Input label="آدرس" value={form.address} onChange={update("address")} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="منبع" value={form.source} onChange={update("source")}>
              <option value="">—</option>
              {Object.entries(CUSTOMER_SOURCE).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Input label="ارزش تخمینی" type="number" step="0.01" value={form.estimated_value} onChange={update("estimated_value")} />
          </div>
          <Input label="برچسب‌ها" placeholder="vip، عمده، تکراری" value={form.tags} onChange={update("tags")} />
          {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "افزودن مشتری"}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || "مشتری"}
        footer={
          detail && (
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => { setDetail(null); openEdit(detail); }}>
                ویرایش
              </Button>
              {admin && (
                <Button variant="danger" size="sm" onClick={() => setToDelete(detail)}>
                  <Trash2 className="w-4 h-4" /> حذف مشتری
                </Button>
              )}
            </div>
          )
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Profile */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="شرکت" value={detail.company} />
              <Field label="وضعیت" value={CUSTOMER_STATUS[detail.status]?.label} badge={CUSTOMER_STATUS[detail.status]?.tone} />
              <Field label="ایمیل" value={detail.email} />
              <Field label="تلفن" value={detail.phone} />
              <Field label="منبع" value={CUSTOMER_SOURCE[detail.source]} />
              <Field label="ارزش تخمینی" value={formatCurrency(detail.estimated_value)} mono />
              <Field label="برچسب‌ها" value={detail.tags} />
              <Field label="مسئول" value={detail.assigned_name} />
              <div className="col-span-2">
                <Field label="آدرس" value={detail.address} />
              </div>
              <div className="col-span-2">
                <Field label="مجموع خرید" value={formatCurrency(detail.total_spent)} mono />
              </div>
            </div>

            {/* Notes */}
            <div>
              <h4 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> یادداشت‌ها ({notes.length})
              </h4>
              <div className="flex gap-2 mb-3">
                <TextArea
                  rows={2}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="یادداشت جدید…"
                />
                <Button type="button" size="sm" onClick={addNote} disabled={noteSaving || !noteBody.trim()} className="self-end">
                  {noteSaving ? "…" : "افزودن"}
                </Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {notes.length === 0 ? (
                  <p className="text-sm text-ink-500">هنوز یادداشتی ثبت نشده.</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="rounded-xl bg-ink-100/60 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-ink-700">{n.author_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-500">{formatDateTime(n.created_at)}</span>
                          <button onClick={() => removeNote(n.id)} className="text-ink-400 hover:text-bad-600" aria-label="حذف یادداشت">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-ink-900 whitespace-pre-line">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent orders */}
            <div>
              <h4 className="font-display font-semibold text-ink-900 mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> سفارش‌های اخیر ({orders.length})
              </h4>
              {orders.length === 0 ? (
                <p className="text-sm text-ink-500">هنوز سفارشی برای این مشتری ثبت نشده.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-mono text-ink-900">{o.order_number}</p>
                        <p className="text-xs text-ink-500">{formatDate(o.order_date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone={(CUSTOMER_STATUS[o.status] || { tone: "neutral" }).tone}>{o.status}</Badge>
                        <span className="text-sm font-mono text-ink-900">{formatCurrency(o.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف مشتری"
        message={`آیا از حذف «${toDelete?.name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست و تاریخچه‌ی سفارش‌ها باقی می‌ماند.`}
        confirmText="حذف"
      />

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="وارد کردن مشتریان از فایل CSV"
        columnsHint="ستون‌های قابل تشخیص: name (الزامی)، company، email، phone، address، status (lead/active/inactive)، source، estimated_value، tags. مشتریان موجود بر اساس ایمیل شناسایی می‌شوند تا تکراری ایجاد نشود."
        onImport={customersApi.importCsv}
        onDone={load}
      />
    </div>
  );
}

function Field({ label, value, badge, mono }) {
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
