import { useEffect, useState } from "react";
import { Plus, Trash2, UserCog } from "lucide-react";
import { authApi } from "../api/endpoints";
import { PageHeader, Button, Card, Badge, Input, Select, Modal, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const ROLE_TONE = { owner: "brand", admin: "good", manager: "warn", staff: "neutral" };

const ROLE_LABELS = {
  owner: "مالک",
  admin: "مدیر سیستم",
  manager: "مدیر",
  staff: "کارمند",
};

const emptyForm = { username: "", email: "", first_name: "", last_name: "", role: "staff", password: "" };

export default function SettingsPage() {
  const { user } = useAuth();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canManageTeam = user?.role === "owner" || user?.role === "admin";

  const load = () => {
    setLoading(true);
    authApi.team().then((res) => setTeam(res.data.results ?? res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await authApi.inviteTeamMember(form);
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(
        Object.values(err.response?.data || {})?.[0]?.[0] || "افزودن این عضو تیم ممکن نشد."
      );
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (id) => {
    if (!confirm("دسترسی این عضو تیم حذف شود؟")) return;
    await authApi.removeTeamMember(id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="تنظیمات"
        description="پروفایل کسب‌وکار و اعضای تیم شما"
      />

      <Card className="p-6 mb-6">
        <h3 className="font-display font-semibold text-ink-900 mb-4">کسب‌وکار</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-ink-500 mb-1">نام کسب‌وکار</p>
            <p className="text-ink-900 font-medium">{user?.business_name}</p>
          </div>
          <div>
            <p className="text-ink-500 mb-1">نقش شما</p>
            <Badge tone={ROLE_TONE[user?.role]}>
              {ROLE_LABELS[user?.role] || user?.role}
            </Badge>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h3 className="font-display font-semibold text-ink-900">تیم</h3>
            <p className="text-sm text-ink-500">همه کسانی که به این فضای کاری دسترسی دارند.</p>
          </div>
          {canManageTeam && (
            <Button
              size="sm"
              onClick={() => {
                setForm(emptyForm);
                setError("");
                setModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> افزودن عضو
            </Button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="divide-y divide-ink-100">
            {team.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center text-ink-700 text-sm font-medium">
                    {(m.first_name?.[0] || m.username[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {m.first_name ? `${m.first_name} ${m.last_name || ""}`.trim() : m.username}
                    </p>
                    <p className="text-xs text-ink-500">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={ROLE_TONE[m.role]}>
                    {ROLE_LABELS[m.role] || m.role}
                  </Badge>
                  {canManageTeam && m.role !== "owner" && m.id !== user.id && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center"
                      aria-label="حذف عضو"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="افزودن عضو تیم">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="نام" value={form.first_name} onChange={update("first_name")} />
            <Input label="نام خانوادگی" value={form.last_name} onChange={update("last_name")} />
          </div>
          <Input label="نام کاربری" required value={form.username} onChange={update("username")} />
          <Input label="ایمیل" type="email" value={form.email} onChange={update("email")} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="نقش" value={form.role} onChange={update("role")}>
              <option value="staff">کارمند</option>
              <option value="manager">مدیر</option>
              <option value="admin">مدیر سیستم</option>
            </Select>
            <Input
              label="رمز عبور موقت"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={update("password")}
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
              {saving ? "در حال افزودن…" : "افزودن عضو"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}