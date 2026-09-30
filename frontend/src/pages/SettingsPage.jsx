import { useEffect, useState } from "react";
import { Plus, Trash2, Edit3, User, Camera } from "lucide-react";
import { authApi } from "../api/endpoints";
import { PageHeader, Button, Card, Badge, Input, Select, Modal, Spinner } from "../components/ui";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast, errMsg } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { ROLE, isAdmin } from "../utils/constants";

const emptyForm = { username: "", email: "", first_name: "", last_name: "", role: "staff", password: "" };

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState({ first_name: "", last_name: "", email: "", phone: "", avatar: null });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [toRemove, setToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const toast = useToast();
  const canManageTeam = isAdmin(user?.role);

  const load = () => {
    setLoading(true);
    authApi.team().then((res) => setTeam(res.data.results ?? res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (user) {
      setProfile({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone: user.phone || "",
        avatar: user.avatar || null,
      });
    }
  }, [user]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const updateProfile = (key) => (e) => setProfile((p) => ({ ...p, [key]: e.target.value }));

  const openInvite = () => {
    setEditingMember(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  };

  const openEditMember = (m) => {
    setEditingMember(m);
    setForm({ username: m.username, email: m.email, first_name: m.first_name, last_name: m.last_name, role: m.role, password: "" });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingMember) {
        const payload = { first_name: form.first_name, last_name: form.last_name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await authApi.updateTeamMember(editingMember.id, payload);
        toast.success("اطلاعات عضو به‌روز شد.");
      } else {
        await authApi.inviteTeamMember(form);
        toast.success("عضو جدید اضافه شد.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(errMsg(err, "ذخیره این عضو ممکن نشد."));
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError("");
    try {
      await authApi.updateMe({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone: profile.phone,
      });
      toast.success("پروفایل به‌روز شد.");
      refresh();
    } catch (err) {
      setProfileError(errMsg(err, "به‌روزرسانی پروفایل ناموفق بود."));
    } finally {
      setProfileSaving(false);
    }
  };

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      await authApi.updateMe(fd);
      toast.success("آواتار به‌روز شد.");
      refresh();
    } catch (err) {
      toast.error(errMsg(err, "بارگذاری آواتار ناموفق بود."));
    }
  };

  const confirmRemove = async () => {
    setRemoving(true);
    try {
      await authApi.removeTeamMember(toRemove.id);
      toast.success("عضو تیم حذف شد.");
      setToRemove(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, "حذف این عضو ممکن نشد."));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div>
      <PageHeader title="تنظیمات" description="پروفایل، کسب‌وکار و اعضای تیم شما" />

      {/* Profile */}
      <Card className="p-6 mb-6">
        <h3 className="font-display font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" /> پروفایل من
        </h3>
        <form onSubmit={submitProfile} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-ink-100 flex items-center justify-center text-ink-700 text-xl font-medium overflow-hidden">
                {profile.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : (user?.first_name?.[0] || user?.username?.[0] || "?").toUpperCase()}
              </div>
              <label className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center cursor-pointer hover:bg-brand-600 shadow-sm">
                <Camera className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              </label>
            </div>
            <div>
              <p className="font-medium text-ink-900">{user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.username}</p>
              <p className="text-sm text-ink-500">{user?.email}</p>
              <Badge tone={ROLE[user?.role]?.tone}>{ROLE[user?.role]?.label}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="نام" value={profile.first_name} onChange={updateProfile("first_name")} />
            <Input label="نام خانوادگی" value={profile.last_name} onChange={updateProfile("last_name")} />
            <Input label="ایمیل" type="email" value={profile.email} onChange={updateProfile("email")} />
            <Input label="تلفن" value={profile.phone} onChange={updateProfile("phone")} />
          </div>
          {profileError && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{profileError}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={profileSaving}>{profileSaving ? "در حال ذخیره…" : "ذخیره پروفایل"}</Button>
          </div>
        </form>
      </Card>

      {/* Business */}
      <Card className="p-6 mb-6">
        <h3 className="font-display font-semibold text-ink-900 mb-4">کسب‌وکار</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-ink-500 mb-1">نام کسب‌وکار</p>
            <p className="text-ink-900 font-medium">{user?.business_name}</p>
          </div>
          <div>
            <p className="text-ink-500 mb-1">نقش شما</p>
            <Badge tone={ROLE[user?.role]?.tone}>{ROLE[user?.role]?.label}</Badge>
          </div>
        </div>
      </Card>

      {/* Team */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          <div>
            <h3 className="font-display font-semibold text-ink-900">تیم</h3>
            <p className="text-sm text-ink-500">همه کسانی که به این فضای کاری دسترسی دارند.</p>
          </div>
          {canManageTeam && (
            <Button size="sm" onClick={openInvite}><Plus className="w-4 h-4" /> افزودن عضو</Button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="divide-y divide-ink-100">
            {team.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center text-ink-700 text-sm font-medium overflow-hidden">
                    {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : (m.first_name?.[0] || m.username[0]).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900">{m.first_name ? `${m.first_name} ${m.last_name || ""}`.trim() : m.username}</p>
                    <p className="text-xs text-ink-500">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={ROLE[m.role]?.tone}>{ROLE[m.role]?.label}</Badge>
                  {canManageTeam && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditMember(m)} className="w-8 h-8 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-brand-600 flex items-center justify-center" aria-label="ویرایش"><Edit3 className="w-4 h-4" /></button>
                      {m.role !== "owner" && m.id !== user.id && (
                        <button onClick={() => setToRemove(m)} className="w-8 h-8 rounded-lg hover:bg-bad-100 text-ink-500 hover:text-bad-600 flex items-center justify-center" aria-label="حذف"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingMember ? "ویرایش عضو تیم" : "افزودن عضو تیم"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="نام" value={form.first_name} onChange={update("first_name")} />
            <Input label="نام خانوادگی" value={form.last_name} onChange={update("last_name")} />
          </div>
          {editingMember ? (
            <>
              <Input label="نام کاربری" value={form.username} disabled />
              <Input label="ایمیل" type="email" value={form.email} onChange={update("email")} />
            </>
          ) : (
            <>
              <Input label="نام کاربری" required value={form.username} onChange={update("username")} />
              <Input label="ایمیل" type="email" value={form.email} onChange={update("email")} />
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="نقش" value={form.role} onChange={update("role")}>
              <option value="staff">کارمند</option>
              <option value="manager">مدیر</option>
              <option value="admin">مدیر سیستم</option>
            </Select>
            <Input
              label={editingMember ? "رمز عبور جدید (اختیاری)" : "رمز عبور موقت"}
              type="password"
              required={!editingMember}
              minLength={8}
              value={form.password}
              onChange={update("password")}
              placeholder={editingMember ? "خالی بگذارید تا تغییر نکند" : ""}
            />
          </div>
          {error && <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>انصراف</Button>
            <Button type="submit" disabled={saving}>{saving ? "در حال ذخیره…" : editingMember ? "ذخیره تغییرات" : "افزودن عضو"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={confirmRemove}
        loading={removing}
        title="حذف عضو تیم"
        message={`دسترسی «${toRemove?.first_name || toRemove?.username}» از این فضای کاری لغو شود؟ (کاربر غیرفعال می‌شود ولی داده‌ها باقی می‌مانند.)`}
        confirmText="لغو دسترسی"
      />
    </div>
  );
}
