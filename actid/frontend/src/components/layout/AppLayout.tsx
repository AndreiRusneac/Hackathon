import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { ToastContainer } from "@/components/ui";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

export default function AppLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { toasts, removeToast } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleForceLogout = () => {
      logout();
      navigate("/login", { replace: true });
    };
    window.addEventListener("actid:logout", handleForceLogout);
    return () => window.removeEventListener("actid:logout", handleForceLogout);
  }, [logout, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex overflow-x-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40">
        <SideNav user={user!} />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden lg:ml-64 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40">
        <BottomNav />
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
