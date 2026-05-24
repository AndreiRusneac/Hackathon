import { NavLink } from "react-router-dom";
import {
  Home, FileText, Bell, QrCode, Shield, ShieldCheck,
  Users, Search, Link2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { useElderlyStore } from "@/store/elderlyStore";

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
  { to: "/dashboard",  icon: Home,   label: "Acasă" },
  { to: "/functionar", icon: Search, label: "Portal" },
  { to: "/family",     icon: Users,  label: "Familie" },
  { to: "/audit",      icon: Link2,  label: "Jurnal" },
];

export function BottomNav() {
  const { notifications } = useNotificationStore();
  const { user } = useAuthStore();
  const { enabled: elderly } = useElderlyStore();

  const unreadCount = notifications.filter((n) => !n.dismissed).length;
  const items = user?.role === "funcționar" ? FUNCTIONAR_ITEMS : CITIZEN_ITEMS;

  return (
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
      </div>
    </nav>
  );
}
