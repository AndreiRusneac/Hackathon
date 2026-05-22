import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "🏠", label: "Acasă" },
  { to: "/documents", icon: "📁", label: "Documente" },
  { to: "/sharing", icon: "📱", label: "Distribuire QR" },
  { to: "/family", icon: "👨‍👩‍👦", label: "Familie" },
  { to: "/audit", icon: "🔗", label: "Jurnal Audit" },
];

export function SideNav({ user }: { user: User }) {
  const { logout } = useAuthStore();
  const { notifications } = useNotificationStore();
  const navigate = useNavigate();
  const activeNotifs = notifications.filter((n) => !n.dismissed).length;

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-full bg-actid-blue text-white">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
            <span className="text-actid-blue font-black text-sm">ID</span>
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">ActID</p>
            <p className="text-xs text-white/60 leading-tight">Digital Romania</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
            {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{user.full_name}</p>
            <p className="text-xs text-white/60 truncate">{user.city}, {user.country}</p>
          </div>
        </div>
        <div className="mt-2 px-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/15 rounded-full text-xs capitalize">
            {user.role === "funcționar" ? "👔" : "🧑"} {user.role}
          </span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1" role="navigation" aria-label="Navigare principală">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-white text-actid-blue"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <span className="text-lg w-6 text-center">{item.icon}</span>
            {item.label}
            {item.to === "/dashboard" && activeNotifs > 0 && (
              <span className="ml-auto bg-actid-red text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {activeNotifs}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <span className="text-lg w-6 text-center">🚪</span>
          Deconectare
        </button>
      </div>
    </div>
  );
}
