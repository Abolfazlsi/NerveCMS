import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Input, Card } from "../components/ui";
import webelopLogo from "../assets/webelop-logo.png";

export default function LoginPage() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/");
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})?.[0]?.[0] ||
        "ورود ناموفق بود. لطفاً نام کاربری و رمز عبور را بررسی کنید.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src={webelopLogo} alt="Webelop" className="w-40 h-40 object-contain" />
        </div>

        <Card className="p-7 sm:p-8">
          <h1 className="font-display font-semibold text-xl text-ink-900 mb-1">خوش آمدید</h1>
          <p className="text-sm text-ink-500 mb-6">وارد فضای کاری CRM خود شوید.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="نام کاربری"
              required
              value={form.username}
              onChange={update("username")}
              autoComplete="username"
              autoFocus
            />
            <Input
              label="رمز عبور"
              type="password"
              required
              value={form.password}
              onChange={update("password")}
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-bad-600 bg-bad-100 rounded-xl px-3.5 py-2.5">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "لطفاً صبر کنید…" : "ورود"}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-ink-500 mt-6">
          اطلاعات ورود را فراموش کرده‌اید؟ با کسی که این فضای کاری را برای شما راه‌اندازی کرده تماس بگیرید.
        </p>
      </div>
    </div>
  );
}