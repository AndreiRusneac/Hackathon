import { NavLink } from "react-router-dom";
import { Home, FileText, QrCode, Users, Bell, Link2, Search, ZoomIn, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useElderlyStore } from "@/store/elderlyStore";
import { useAuthStore } from "@/store/authStore";

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

const CITIZEN_ITEMS: NavItem[] = [
  { to: "/dashboard",     icon: Home,     label: "Acasă" },
  { to: "/documents",     icon: FileText, label: "Acte" },
  { to: "/sharing",       icon: QrCode,   label: "QR" },
  { to: "/family",        icon: Users,    label: "Familie" },
  { to: "/notifications", icon: Bell,     label: "Notificări" },
];

const FUNCTIONAR_ITEMS: NavItem[] = [
  { to: "/dashboard",  icon: Home,    label: "Acasă" },
  { to: "/functionar", icon: Search,  label: "Portal" },
  { to: "/sharing",    icon: QrCode,  label: "QR" },
  { to: "/family",     icon: Users,   label: "Familie" },
  { to: "/audit",      icon: Link2,   label: "Jurnal" },
];

export function BottomNav() {
  const { notifications } = useNotificationStore();
  const { enabled: elderlyEnabled, toggle: elderlyToggle } = useElderlyStore();
  const { user } = useAuthStore();

  const unreadCount = notifications.filter((n) => !n.dismissed).length;
  const items = user?.role === "funcționar" ? FUNCTIONAR_ITEMS : CITIZEN_ITEMS;

  return (
    <nav
      className="bg-white border-t border-border safe-bottom"
      role="navigation"
      aria-label="Navigare mobilă"
    >
      <div className="relative flex items-center justify-around h-16">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-medium transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-inset",
                  isActive ? "text-actid-blue" : "text-muted-foreground"
                )
              }
              aria-label={item.label}
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} aria-hidden="true" />
                  <span className={cn("text-[10px]", isActive && "font-bold")}>
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
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-actid-blue rounded-b" aria-hidden="true" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        <button
          onClick={elderlyToggle}
          aria-pressed={elderlyEnabled}
          aria-label={elderlyEnabled ? "Dezactivare mod vârstnici" : "Activare mod vârstnici"}
          className={cn(
            "absolute right-1.5 top-1.5 w-7 h-7 rounded-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue",
            elderlyEnabled
              ? "bg-actid-blue text-white shadow-sm"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          )}
        >
          <ZoomIn size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
