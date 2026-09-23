import { useEffect, useState, useCallback } from "react";
import { Plus, CheckSquare, Clock } from "lucide-react";
import { tasksApi, customersApi, authApi } from "../api/endpoints";
import { PageHeader, Button, Card, Badge, Input, Select, TextArea, Modal, EmptyState, Spinner } from "../components/ui";
import { formatDate } from "../utils/format";

const COLUMNS = [
  { key: "todo", label: "برای انجام" },
  { key: "in_progress", label: "در حال انجام" },
  { key: "done", label: "انجام‌شده" },
];

const PRIORITY_TONE = { low: "neutral", medium: "warn", high: "bad" };

const PRIORITY_LABELS = {
  low: "کم",
  medium: "متوسط",
  high: "بالا",
};

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
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    tasksApi.list({}).then((res) => setTasks(res.data.results ?? res.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    authApi.team().then((res) => setTeam(res.data.results ?? res.data)).catch(() => {});
    customersApi.list({}).then((res) => setCustomers(res.data.results ?? res.data));
  }, [load]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await tasksApi.create({
        ...form,
        assigned_to: form.assigned_to || null,
        related_customer: form.related_customer || null,
        due_date: form.due_date || null,
      });
      setModalOpen(false);
      load();
    } catch {
      setError("ایجاد این وظیفه ممکن نشد. لطفاً فیلدها را بررسی کنید و دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (task, newStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    try {
      await tasksApi.update(task.id, { status: newStatus });
    } catch {
      load();
    }
  };

  return (
    <div>
      <PageHeader
        title="وظایف"
        description="پیگیری‌ها را اختصاص دهید و تیم را در حرکت نگه دارید."
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> وظیفه جدید
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckSquare}
            title="هنوز وظیفه‌ای وجود ندارد"
            description="یک وظیفه ایجاد کنید تا پیگیری‌ها را به تیم اختصاص دهید."
            action={
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" /> وظیفه جدید
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-display font-semibold text-sm text-ink-700">{col.label}</h3>
                  <span className="text-xs font-mono text-ink-500 bg-ink-100 rounded-full px-2 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colTasks.map((t) => (
                    <Card key={t.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm text-ink-900">{t.title}</p>
                        <Badge tone={PRIORITY_TONE[t.priority]}>
                          {PRIORITY_LABELS[t.priority] || t.priority}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-ink-500 mb-2 line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-ink-500 mb-3">
                        <span>{t.assigned_to_name || "اختصاص‌نیافته"}</span>
                        {t.due_date && (
                          <span className={`flex items-center gap-1 ${t.is_overdue ? "text-bad-600 font-medium" : ""}`}>
                            <Clock className="w-3 h-3" /> {formatDate(t.due_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                          <button
                            key={c.key}
                            onClick={() => moveTask(t, c.key)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-300/60 transition-colors"
                          >
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="وظیفه جدید">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="عنوان" required value={form.title} onChange={update("title")} />
          <TextArea label="توضیحات" rows={3} value={form.description} onChange={update("description")} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="اختصاص به" value={form.assigned_to} onChange={update("assigned_to")}>
              <option value="">اختصاص‌نیافته</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>{m.first_name || m.username}</option>
              ))}
            </Select>
            <Select
              label="مشتری مرتبط"
              value={form.related_customer}
              onChange={update("related_customer")}
            >
              <option value="">هیچکدام</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="اولویت" value={form.priority} onChange={update("priority")}>
              <option value="low">کم</option>
              <option value="medium">متوسط</option>
              <option value="high">بالا</option>
            </Select>
            <Input
              label="تاریخ سررسید"
              type="date"
              value={form.due_date}
              onChange={update("due_date")}
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
              {saving ? "در حال ایجاد…" : "ایجاد وظیفه"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}