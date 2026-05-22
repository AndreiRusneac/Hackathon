import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { documentsApi, auditApi, getErrMsg } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { DocumentCard, DocumentCardSkeleton } from "@/components/documents/DocumentCard";
import { formatDateTime } from "@/lib/utils";
import type { AuditEntry } from "@/types";

const ACTION_ICONS: Record<string, string> = {
  LOGIN_SUCCESS: "🔐",
  DOCUMENT_VIEW: "👁️",
  DOCUMENT_UPLOAD: "📤",
  QR_TOKEN_CREATE: "📱",
  QR_TOKEN_SCAN: "📷",
  DELEGATION_CREATE: "🤝",
  DELEGATION_REVOKE: "❌",
  LOGOUT: "👋",
  SYSTEM_INIT: "🚀",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { documents, setDocuments, loading, setLoading } = useDocumentStore();
  const { generateFromDocuments, notifications, addToast } = useNotificationStore();
  const navigate = useNavigate();
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [docsRes, activityRes] = await Promise.all([
          documentsApi.list(),
          auditApi.listEntries(5),
        ]);
        setDocuments(docsRes.data);
        generateFromDocuments(docsRes.data);
        setRecentActivity(activityRes.data);
      } catch (err) {
        addToast(getErrMsg(err, "Eroare la încărcarea datelor"), "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setLoading, setDocuments, generateFromDocuments, addToast]);

  const validDocs = documents.filter((d) => d.status === "valid");
  const expiringSoon = documents.filter((d) => d.status === "expiră_curând");
  const expired = documents.filter((d) => d.status === "expirat");
  const activeNotifs = notifications.filter((n) => !n.dismissed);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bună dimineața";
    if (h < 18) return "Bună ziua";
    return "Bună seara";
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{greeting()},</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">
            {user?.full_name.split(" ")[0]} 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.city}, {user?.country} ·{" "}
            <span className="capitalize">{user?.role}</span>
          </p>
        </div>
        <div className="relative">
          <button
            className="w-12 h-12 bg-actid-blue rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
            aria-label={`${activeNotifs.length} notificări active`}
          >
            {user?.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </button>
          {activeNotifs.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-actid-red text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeNotifs.length}
            </span>
          )}
        </div>
      </div>

      {/* Notification banners */}
      {activeNotifs.length > 0 && (
        <div>
          <NotificationBanner />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon="✅"
          count={loading ? null : validDocs.length}
          label="Valide"
          color="text-green-600"
          bg="bg-green-50"
          onClick={() => navigate("/documents")}
        />
        <StatCard
          icon="⚡"
          count={loading ? null : expiringSoon.length}
          label="Expiră curând"
          color="text-amber-600"
          bg="bg-amber-50"
          onClick={() => navigate("/documents")}
        />
        <StatCard
          icon="🚨"
          count={loading ? null : expired.length}
          label="Expirate"
          color="text-red-600"
          bg="bg-red-50"
          onClick={() => navigate("/documents")}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Acțiuni rapide
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            icon="📱"
            label="Partajează QR"
            onClick={() => navigate("/sharing")}
            color="bg-purple-50 text-purple-700"
          />
          <QuickAction
            icon="👨‍👩‍👦"
            label="Familie"
            onClick={() => navigate("/family")}
            color="bg-teal-50 text-teal-700"
          />
          <QuickAction
            icon="🔗"
            label="Jurnal Audit"
            onClick={() => navigate("/audit")}
            color="bg-blue-50 text-blue-700"
          />
        </div>
      </div>

      {/* Documents preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Documentele mele
          </h2>
          <button
            onClick={() => navigate("/documents")}
            className="text-xs text-actid-blue font-medium hover:underline"
          >
            Vezi toate →
          </button>
        </div>
        <div className="space-y-3">
          {loading ? (
            <>
              <DocumentCardSkeleton />
              <DocumentCardSkeleton />
            </>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-3xl mb-2">📂</p>
                <p className="font-medium">Nu ai documente înregistrate</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adaugă primul tău document digital
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/documents")}
                >
                  + Adaugă document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Show expiring/expired first, then valid */}
              {[...expiringSoon, ...expired, ...validDocs].slice(0, 3).map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  compact
                  onView={() => navigate("/documents")}
                  onShare={() => navigate("/sharing")}
                />
              ))}
              {documents.length > 3 && (
                <button
                  onClick={() => navigate("/documents")}
                  className="w-full py-3 text-sm text-actid-blue font-medium hover:bg-blue-50 rounded-xl transition-colors"
                >
                  + {documents.length - 3} alte documente
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Activitate recentă
          </h2>
          <button
            onClick={() => navigate("/audit")}
            className="text-xs text-actid-blue font-medium hover:underline"
          >
            Jurnal complet →
          </button>
        </div>
        <Card>
          <CardContent className="py-2 divide-y divide-border">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nicio activitate înregistrată
              </p>
            ) : (
              recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-3">
                  <span className="text-lg w-8 text-center flex-shrink-0">
                    {ACTION_ICONS[entry.action] || "📋"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {formatAction(entry.action)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                    #{entry.block_number}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diaspora banner for Alex */}
      {user?.country !== "România" && (
        <Card className="bg-gradient-to-r from-blue-50 to-teal-50 border-blue-100">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🌍</span>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Gestionezi documente din {user?.country}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prin delegare familială, poți reînnoi și gestiona documente românești de oriunde.
                </p>
                <button
                  onClick={() => navigate("/family")}
                  className="text-xs text-actid-blue font-medium mt-2 hover:underline"
                >
                  → Vezi delegările →
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  count,
  label,
  color,
  bg,
  onClick,
}: {
  icon: string;
  count: number | null;
  label: string;
  color: string;
  bg: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-border p-3 text-center hover:shadow-sm transition-all active:scale-[0.97]"
      aria-label={`${count ?? ""} ${label}`}
    >
      <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
        <span className="text-xl">{icon}</span>
      </div>
      {count === null ? (
        <div className="skeleton h-6 w-8 mx-auto rounded mb-1" />
      ) : (
        <p className={`text-2xl font-bold ${color}`}>{count}</p>
      )}
      <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
    </button>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  color,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`${color} rounded-2xl p-4 text-center hover:opacity-90 active:scale-[0.97] transition-all`}
    >
      <span className="block text-2xl mb-1">{icon}</span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}

function formatAction(action: string): string {
  const labels: Record<string, string> = {
    LOGIN_SUCCESS: "Autentificare reușită",
    LOGOUT: "Deconectare",
    DOCUMENT_VIEW: "Document vizualizat",
    DOCUMENT_UPLOAD: "Document adăugat",
    DOCUMENT_DELETE: "Document șters",
    QR_TOKEN_CREATE: "Token QR creat",
    QR_TOKEN_SCAN: "Token QR scanat",
    QR_TOKEN_REVOKE: "Token QR revocat",
    DELEGATION_CREATE: "Delegare acordată",
    DELEGATION_REVOKE: "Delegare revocată",
    SYSTEM_INIT: "Sistem inițializat",
  };
  return labels[action] || action;
}
