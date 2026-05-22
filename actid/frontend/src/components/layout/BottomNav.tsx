import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/notificationStore";

const ITEMS = [
  { to: "/dashboard", icon: "🏠", label: "Acasă" },
  { to: "/documents", icon: "📁", label: "Documente" },
  { to: "/sharing", icon: "📱", label: "QR" },
  { to: "/family", icon: "👨‍👩‍👦", label: "Familie" },
  { to: "/audit", icon: "🔗", label: "Jurnal" },
];

export function BottomNav() {
  const { notifications } = useNotificationStore();
  const activeNotifs = notifications.filter((n) => !n.dismissed).length;

  return (
    <nav
      className="bg-white border-t border-border safe-bottom"
      role="navigation"
      aria-label="Navigare mobilă"
    >
      <div className="flex items-center justify-around h-16">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-xs font-medium transition-colors relative",
                isActive ? "text-actid-blue" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="text-xl">{item.icon}</span>
                <span className={cn("text-[10px]", isActive && "font-bold")}>
                  {item.label}
                </span>
                {item.to === "/dashboard" && activeNotifs > 0 && (
                  <span className="absolute top-2 right-1/4 bg-actid-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {activeNotifs}
                  </span>
                )}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-actid-blue rounded-b" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
