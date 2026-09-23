import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Package, ShoppingCart, CheckSquare, Settings, LogOut, Menu, X,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import webelopIcon from "../assets/webelop-icon.png";

const NAV_ITEMS = [
  { to: "/", label: "داشبورد", icon: LayoutDashboard, end: true },
  { to: "/customers", label: "مشتریان", icon: Users },
  { to: "/inventory", label: "انبار", icon: Package },
  { to: "/orders", label: "سفارشات", icon: ShoppingCart },
  { to: "/tasks", label: "وظایف", icon: CheckSquare },
  { to: "/settings", label: "تنظیمات", icon: Settings },
];

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full bg-ink-950 text-ink-300">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <img src={webelopIcon} alt="" className="w-8 h-8 object-contain shrink-0" />
        <span className="font-display font-semibold text-white text-lg tracking-tight">Webelop</span>
      </div>

      <div className="px-4 mb-2">
        <div className="rounded-xl bg-ink-900/60 px-3.5 py-3">
          <p className="text-xs uppercase tracking-wide text-ink-500 mb-0.5">Business</p>
          <p className="text-sm text-white font-medium truncate">{user?.business_name || "—"}</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-500 text-white"
                  : "text-ink-300 hover:bg-ink-900 hover:text-white"
              )
            }
          >
            <Icon className="w-[18px] h-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 pb-5 pt-3 border-t border-ink-900">
        <div className="flex items-center gap-3 px-1 mb-3">
          <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center text-white text-sm font-medium shrink-0">
            {(user?.first_name?.[0] || user?.username?.[0] || "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user?.username}
            </p>
            <p className="text-xs text-ink-500 capitalize truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm text-ink-300 hover:bg-ink-900 hover:text-white transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          خروج از حساب کاربری
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-full">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-ink-950/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 h-full">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-ink-100 bg-white shrink-0">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="w-6 h-6 text-ink-700" />
          </button>
          <span className="font-display font-semibold text-ink-900">Webelop</span>
          <div className="w-6" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
