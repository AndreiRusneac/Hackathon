import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AppLayout from "@/components/layout/AppLayout";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import DocumentsPage from "@/pages/DocumentsPage";
import SharingPage from "@/pages/SharingPage";
import FamilyPage from "@/pages/FamilyPage";
import AuditLogPage from "@/pages/AuditLogPage";
import NotificationsPage from "@/pages/NotificationsPage";
import FunctionarPage from "@/pages/FunctionarPage";
import ScanPage from "@/pages/ScanPage";
import PresentationsPage from "@/pages/PresentationsPage";
import SecurityPage from "@/pages/SecurityPage";

function VerifyRedirect() {
  const { presentationId } = useParams<{ presentationId: string }>();
  const { isAuthenticated } = useAuthStore();
  const target = `/functionar?pid=${presentationId}`;
  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(target)}`} replace />;
  }
  return <Navigate to={target} replace />;
}

export default function App() {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/scan/:token" element={<ScanPage />} />
      <Route path="/verify/:presentationId" element={<VerifyRedirect />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/sharing" element={<SharingPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/functionar" element={<FunctionarPage />} />
        <Route path="/presentations" element={<PresentationsPage />} />
        <Route path="/securitate" element={<SecurityPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
