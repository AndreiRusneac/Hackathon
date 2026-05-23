import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, FileText, QrCode, Users, Bell, Link2,
  LogOut, ZoomIn, Search, BookLock,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useElderlyStore } from "@/store/elderlyStore";
import { authApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

const CITIZEN_NAV: NavItem[] = [
  { to: "/dashboard",     icon: Home,      label: "Acasă" },
  { to: "/documents",     icon: FileText,  label: "Acte" },
  { to: "/sharing",       icon: QrCode,    label: "Distribuire QR" },
  { to: "/family",        icon: Users,     label: "Familie" },
  { to: "/notifications", icon: Bell,      label: "Notificări" },
  { to: "/audit",         icon: Link2,     label: "Jurnal Audit" },
];

const FUNCTIONAR_NAV: NavItem[] = [
  { to: "/dashboard",  icon: Home,      label: "Acasă" },
  { to: "/functionar", icon: Search,    label: "Portal Funcționar" },
  { to: "/sharing",    icon: QrCode,    label: "Distribuire QR" },
  { to: "/family",     icon: Users,     label: "Familie" },
  { to: "/audit",      icon: Link2,     label: "Jurnal Audit" },
];

export function SideNav({ user }: { user: User }) {
  const { logout } = useAuthStore();
  const { notifications } = useNotificationStore();
  const { enabled: elderlyEnabled, toggle: elderlyToggle } = useElderlyStore();
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.dismissed).length;

  const navItems = user.role === "funcționar" ? FUNCTIONAR_NAV : CITIZEN_NAV;

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-full bg-actid-blue text-white">
      {/* Brand */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center" aria-hidden="true">
            <span className="text-actid-blue font-black text-sm">ID</span>
          </div>
          <div>
            <p className="font-bold text-lg leading-tight tracking-tight">ActID</p>
            <p className="text-xs text-white/60 leading-tight">Digital Romania</p>
          </div>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
            aria-hidden="true"
          >
            {user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{user.full_name}</p>
            <p className="text-xs text-white/60 truncate">{user.city}, {user.country}</p>
          </div>
        </div>
        <div className="mt-2 px-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/15 rounded-full text-xs capitalize">
            <BookLock size={11} aria-hidden="true" />
            {user.role}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" role="navigation" aria-label="Navigare principală">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                  isActive
                    ? "bg-white text-actid-blue"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} aria-hidden="true" className={isActive ? "text-actid-blue" : ""} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/notifications" && unreadCount > 0 && (
                    <span
                      className="bg-actid-red text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                      aria-label={`${unreadCount} notificări necitite`}
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-2 border-t border-white/10 pt-3 space-y-1">
        <button
          onClick={elderlyToggle}
          aria-pressed={elderlyEnabled}
          aria-label={elderlyEnabled ? "Dezactivare mod vârstnici" : "Activare mod vârstnici"}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
            elderlyEnabled ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          <ZoomIn size={18} aria-hidden="true" />
          <span className="flex-1 text-left">Mod vârstnici</span>
          <div
            className={cn(
              "w-9 h-5 rounded-full transition-colors relative flex-shrink-0",
              elderlyEnabled ? "bg-green-400" : "bg-white/30"
            )}
            aria-hidden="true"
          >
            <div
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                elderlyEnabled ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <LogOut size={18} aria-hidden="true" />
          Deconectare
        </button>
      </div>
    </div>
  );
}
