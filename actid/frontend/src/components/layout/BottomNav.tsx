import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, FileText, Bell, QrCode, Shield, ShieldCheck,
  Users, Search, Link2, UserCircle, LogOut, Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { useElderlyStore } from "@/store/elderlyStore";
import { authApi } from "@/lib/api";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

const CITIZEN_ITEMS: NavItem[] = [
  { to: "/dashboard",     icon: Home,        label: "Acasă" },
  { to: "/documents",     icon: FileText,    label: "Acte" },
  { to: "/sharing",       icon: QrCode,      label: "QR" },
  { to: "/presentations", icon: Shield,      label: "EUDI" },
  { to: "/securitate",    icon: ShieldCheck, label: "Securitate" },
  { to: "/notifications", icon: Bell,        label: "Notificări" },
];

const FUNCTIONAR_ITEMS: NavItem[] = [
  { to: "/functionar", icon: Search, label: "Portal" },
  { to: "/audit",      icon: Link2,  label: "Jurnal" },
];

export function BottomNav() {
  const { notifications } = useNotificationStore();
  const { user, logout } = useAuthStore();
  const { enabled: elderly } = useElderlyStore();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const unreadCount = notifications.filter((n) => !n.dismissed).length;
  const isFunctionar = user?.role === "funcționar";
  const items = isFunctionar ? FUNCTIONAR_ITEMS : CITIZEN_ITEMS;

  const handleLogout = async () => {
    setProfileOpen(false);
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate("/", { replace: true });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await authApi.deleteAccount();
      logout();
      navigate("/", { replace: true });
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      {/* Profile sheet overlay */}
      {profileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setProfileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl safe-bottom animate-slide-up">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5 pb-2">
              <p className="font-semibold text-base truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <span className="inline-block mt-1.5 text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full capitalize">
                {user?.role}
              </span>
            </div>
            <div className="p-3 space-y-1 pb-6">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium text-foreground hover:bg-gray-50 transition-colors text-left min-h-[52px]"
              >
                <LogOut size={18} className="text-muted-foreground" aria-hidden="true" />
                Deconectare
              </button>
              <button
                onClick={() => { setProfileOpen(false); setConfirmDelete(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left min-h-[52px]"
              >
                <Trash2 size={18} aria-hidden="true" />
                Șterge contul
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm sheet */}
      {confirmDelete && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" aria-hidden="true" />
          <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl safe-bottom">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
            <div className="px-5 pb-2">
              <p className="font-bold text-base">Ștergi contul?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Toate documentele, delegările și tokenurile QR vor fi șterse permanent.
              </p>
            </div>
            <div className="p-3 space-y-2 pb-6">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 transition-colors min-h-[52px]"
              >
                {deleting ? "Se șterge..." : "Da, șterge contul"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-gray-100 text-foreground hover:bg-gray-200 transition-colors min-h-[52px]"
              >
                Înapoi
              </button>
            </div>
          </div>
        </>
      )}

      <nav
        className="bg-white/95 backdrop-blur-md border-t border-border/60 safe-bottom shadow-[0_-4px_16px_rgba(0,0,0,0.07)]"
        role="navigation"
        aria-label="Navigare mobilă"
      >
        <div className={cn("flex items-center justify-around", elderly ? "h-24" : "h-[72px]")}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center flex-1 h-full font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-inset",
                    elderly ? "gap-1.5" : "gap-1",
                    isActive ? "text-actid-blue" : "text-muted-foreground"
                  )
                }
                aria-label={item.label}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={elderly ? 28 : 22} aria-hidden="true" />
                    <span className={cn(
                      "leading-none",
                      elderly ? "text-[10px] font-semibold" : "text-[8px]",
                      isActive && "font-bold"
                    )}>
                      {item.label}
                    </span>
                    {item.to === "/notifications" && unreadCount > 0 && (
                      <span
                        className="absolute top-2 right-1/4 bg-actid-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                        aria-label={`${unreadCount} necitite`}
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                    {isActive && (
                      <span
                        className={cn("absolute top-0 left-1/2 -translate-x-1/2 h-0.5 bg-actid-blue rounded-b", elderly ? "w-8" : "w-5")}
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Profile button — funcționar only */}
          {isFunctionar && (
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Profil"
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-inset text-muted-foreground hover:text-foreground",
                elderly ? "gap-1.5" : "gap-1"
              )}
            >
              <UserCircle size={elderly ? 28 : 22} aria-hidden="true" />
              <span className={cn("leading-none", elderly ? "text-[10px] font-semibold" : "text-[8px]")}>
                Profil
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
