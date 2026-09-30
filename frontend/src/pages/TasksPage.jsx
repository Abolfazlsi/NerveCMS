import { useEffect, useState, useCallback } from "react";
import { Plus, CheckSquare, Clock, Trash2, Edit3, Filter } from "lucide-react";
import { tasksApi, customersApi, authApi } from "../api/endpoints";
import { PageHeader, Button, Card, Badge, Input, Select, TextArea, Modal, EmptyState, Spinner } from "../components/ui";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, errMsg } from "../components/Toast";
import { TASK_STATUS, TASK_PRIORITY, isAdmin } from "../utils/constants";
import { collectAll } from "../utils/fetch";
import { formatDate } from "../utils/format";

const COLUMNS = [
  { key: "todo", label: "برای انجام" },
  { key: "in_progress", label: "در حال انجام" },
  { key: "done", label: "انجام‌شده" },
];

const emptyForm = {
  title: "", description: "", assigned_to: "", related_customer: "", priority: "medium",
  due_date: "", status: "todo",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [myOnly, setMyOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();
  const { user } = useAuth();
  const admin = isAdmin(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    tasksApi
      .list({
        assigned_to: assigneeFilter || undefined,
        status: undefined, // we keep kanban grouping so don't filter status
      })
      .then((res) => setTasks(res.data.results ?? res.data))
      .finally(() => setLoading(false));
  }, [assigneeFilter]);

  useEffect(() => {
    load();
    authApi.team().then((res) => setTeam(res.data.results ?? res.data)).catch(() => {
      toast.error("بارگذاری اعضای تیم ناموفق بود.");
    });
    collectAll(customersApi.list).then(setCustomers).catch(() => {});
  }, [load]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (task) => {
    setEditing(task);
    setForm({
      title: task.title, description: task.description || "", assigned_to: task.assigned_to || "",
      related_customer: task.related_customer || "", priority: task.priority,
      due_date: task.due_date || "", status: task.status,
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
        assigned_to: form.assigned_to || null,
        related_customer: form.related_customer || null,
        due_date: form.due_date || null,
      };
      if (editing) {
        await tasksApi.update(editing.id, payload);
        toast.success("وظیفه به‌روز شد.");
      } else {
        await tasksApi.create(payload);
        toast.success("وظیفه ایجاد شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این وظیفه ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (task, newStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await tasksApi.update(task.id, { status: newStatus });
    } catch {
      toast.error("انتقال وظیفه ناموفق بود.");
      load();
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await tasksApi.remove(toDelete.id);
      toast.success("وظیفه حذف شد.");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف وظیفه ناموفق بود."));
    } finally {
      setDeleting(false);
    }
  };

  // apply filters (assignee is server-side; priority/overdue/my are client-side for simplicity)
  let visible = tasks;
  if (priorityFilter) visible = visible.filter((t) => t.priority === priorityFilter);
  if (overdueOnly) visible = visible.filter((t) => t.is_overdue);
  if (myOnly && user) visible = visible.filter((t) => t.assigned_to === user.id);

  return (
    <div>
      <PageHeader
        title="وظایف"
        description="پیگیری‌ها را اختصاص دهید و تیم را در حرکت نگه دارید."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowFilters((v) => !v)}><Filter className="w-4 h-4" /> فیلترها</Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> وظیفه جدید</Button>
          </>
        }
      />

      {showFilters && (
        <Card className="p-4 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select label="مسئول" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">همه</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.first_name || m.username}</option>)}
            </Select>
            <Select label="اولویت" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">همه</option>
              {Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <label className="flex items-end gap-2 pb-2 text-sm text-ink-700">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} className="w-4 h-4 rounded border-ink-300" />
              فقط سررسید گذشته
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-ink-700">
              <input type="checkbox" checked={myOnly} onChange={(e) => setMyOnly(e.target.checked)} className="w-4 h-4 rounded border-ink-300" />
              فقط وظایف من
            </label>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title="وظیفه‌ای یافت نشد"
            description="با فیلترهای فعلی وظیفه‌ای وجود ندارد. یک وظیفه جدید ایجاد کنید."
            action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> وظیفه جدید</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = visible.filter((t) => t.status === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-display font-semibold text-sm text-ink-700">{col.label}</h3>
                  <span className="text-xs font-mono text-ink-500 bg-ink-100 rounded-full px-2 py-0.5">{colTasks.length}</span>
                </div>
                <div className="space-y-3">
                  {colTasks.map((t) => (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm text-ink-900">{t.title}</p>
                        <Badge tone={TASK_PRIORITY[t.priority].tone}>{TASK_PRIORITY[t.priority].label}</Badge>
                      </div>
                      {t.description && <p className="text-xs text-ink-500 mb-2 line-clamp-2">{t.description}</p>}
                      <div className="flex items-center justify-between text-xs text-ink-500 mb-3">
                        <span>{t.assigned_to_name || "اختصاص‌نیافته"}</span>
                        {t.due_date && (
                          <span className={`flex items-center gap-1 ${t.is_overdue ? "text-bad-600 font-medium" : ""}`}>
                            <Clock className="w-3 h-3" /> {formatDate(t.due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex gap-1.5">
                          {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                            <button key={c.key} onClick={() => moveTask(t, c.key)} className="text-xs px-2.5 py-1 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-300/60 transition-colors">
                              → {c.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(t)} className="w-7 h-7 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="ویرایش"><Edit3 className="w-3.5 h-3.5" /></button>
                          {admin && (
                            <button onClick={() => setToDelete(t)} className="w-7 h-7 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "ویرایش وظیفه" : "وظیفه جدید"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="عنوان" required value={form.title} onChange={update("title")} />
          <TextArea label="توضیحات" rows={3} value={form.description} onChange={update("description")} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="اختصاص به" value={form.assigned_to} onChange={update("assigned_to")}>
              <option value="">اختصاص‌نیافته</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.first_name || m.username}</option>)}
            </Select>
            <Select label="مشتری مرتبط" value={form.related_customer} onChange={update("related_customer")}>
              <option value="">هیچکدام</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="اولویت" value={form.priority} onChange={update("priority")}>
              {Object.entries(TASK_PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Select label="وضعیت" value={form.status} onChange={update("status")}>
              {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
            <Input label="تاریخ سررسید" type="date" value={form.due_date} onChange={update("due_date")} />
          </div>
          {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد وظیفه"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="حذف وظیفه"
        message={`آیا از حذف وظیفه «${toDelete?.title}» مطمئن هستید؟`}
        confirmText="حذف"
      />
    </div>
  );
}
