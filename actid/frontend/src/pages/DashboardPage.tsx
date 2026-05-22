import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, Clock, ShieldAlert, QrCode, Users, Link2,
  LogIn, LogOut, Eye, Upload, Trash2, UserPlus, UserMinus, Zap,
  Globe, FileText, type LucideIcon,
} from "lucide-react";
import { documentsApi, auditApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui";
import { NotificationBanner } from "@/components/notifications/NotificationBanner";
import { DocumentCard, DocumentCardSkeleton } from "@/components/documents/DocumentCard";
import { formatDateTime, cn } from "@/lib/utils";
import type { AuditEntry } from "@/types";

const ACTION_ICON_MAP: Record<string, LucideIcon> = {
  LOGIN_SUCCESS:     LogIn,
  LOGIN_ATTEMPT:     LogIn,
  LOGOUT:            LogOut,
  DOCUMENT_VIEW:     Eye,
  DOCUMENT_UPLOAD:   Upload,
  DOCUMENT_DELETE:   Trash2,
  QR_TOKEN_CREATE:   QrCode,
  QR_TOKEN_SCAN:     QrCode,
  QR_TOKEN_REVOKE:   QrCode,
  DELEGATION_CREATE: UserPlus,
  DELEGATION_REVOKE: UserMinus,
  SYSTEM_INIT:       Zap,
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS:     "Autentificare reușită",
  LOGOUT:            "Deconectare",
  DOCUMENT_VIEW:     "Document vizualizat",
  DOCUMENT_UPLOAD:   "Document adăugat",
  DOCUMENT_DELETE:   "Document șters",
  QR_TOKEN_CREATE:   "Token QR creat",
  QR_TOKEN_SCAN:     "Token QR scanat",
  QR_TOKEN_REVOKE:   "Token QR revocat",
  DELEGATION_CREATE: "Delegare acordată",
  DELEGATION_REVOKE: "Delegare revocată",
  SYSTEM_INIT:       "Sistem inițializat",
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { documents, setDocuments, loading, setLoading } = useDocumentStore();
  const { generateFromDocuments, notifications } = useNotificationStore();
  const navigate = useNavigate();
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [docsRes, activityRes, statsRes] = await Promise.all([
          documentsApi.list(),
          auditApi.listEntries(5),
          auditApi.stats(),
        ]);
        setDocuments(docsRes.data);
        generateFromDocuments(docsRes.data);
        setRecentActivity(activityRes.data);
        setAuditStats(statsRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const validDocs    = documents.filter((d) => d.status === "valid");
  const expiringSoon = documents.filter((d) => d.status === "expiră_curând");
  const expired      = documents.filter((d) => d.status === "expirat");
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
          <h1 className="text-2xl font-bold text-foreground mt-0.5 tracking-tight">
            {user?.full_name.split(" ")[0]}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {user?.city}, {user?.country} · <span className="capitalize">{user?.role}</span>
          </p>
        </div>
        <div className="relative">
          <button
            className="w-12 h-12 bg-actid-blue rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
            aria-label={`${activeNotifs.length} notificări active`}
            onClick={() => navigate("/notifications")}
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
          Icon={ShieldCheck}
          count={loading ? null : validDocs.length}
          label="Valide"
          iconColor="text-green-600"
          bg="bg-green-50"
          onClick={() => navigate("/documents")}
        />
        <StatCard
          Icon={Clock}
          count={loading ? null : expiringSoon.length}
          label="Expiră curând"
          iconColor="text-amber-600"
          bg="bg-amber-50"
          onClick={() => navigate("/documents")}
        />
        <StatCard
          Icon={ShieldAlert}
          count={loading ? null : expired.length}
          label="Expirate"
          iconColor="text-red-600"
          bg="bg-red-50"
          onClick={() => navigate("/documents")}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Acțiuni rapide
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction
            Icon={QrCode}
            label="Partajează QR"
            onClick={() => navigate("/sharing")}
            color="bg-purple-50 text-purple-700"
          />
          <QuickAction
            Icon={Users}
            label="Familie"
            onClick={() => navigate("/family")}
            color="bg-teal-50 text-teal-700"
          />
          <QuickAction
            Icon={Link2}
            label="Jurnal Audit"
            onClick={() => navigate("/audit")}
            color="bg-blue-50 text-blue-700"
          />
        </div>
      </div>

      {/* Documents preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Documentele mele
          </h2>
          <button
            onClick={() => navigate("/documents")}
            className="text-xs text-actid-blue font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
          >
            Vezi toate
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
              <CardContent className="text-center py-10">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <FileText size={22} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="font-semibold">Nu ai documente înregistrate</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adaugă primul tău document digital
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate("/documents")}
                >
                  Adaugă document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
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
                  className="w-full py-3 text-sm text-actid-blue font-medium hover:bg-blue-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
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
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Activitate recentă
          </h2>
          <button
            onClick={() => navigate("/audit")}
            className="text-xs text-actid-blue font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
          >
            Jurnal complet
          </button>
        </div>
        <Card>
          <CardContent className="py-2 divide-y divide-border">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nicio activitate înregistrată
              </p>
            ) : (
              recentActivity.map((entry) => {
                const IconComp = ACTION_ICON_MAP[entry.action] || FileText;
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <IconComp size={16} className="text-muted-foreground" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {ACTION_LABELS[entry.action] || entry.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.timestamp)}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">
                      #{entry.block_number}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diaspora banner */}
      {user?.country !== "România" && (
        <Card className="bg-gradient-to-r from-blue-50/60 to-teal-50/60 border-blue-100">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe size={18} className="text-blue-600" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  Gestionezi documente din {user?.country}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prin delegare familială, poți reînnoi și gestiona documente românești de oriunde.
                </p>
                <button
                  onClick={() => navigate("/family")}
                  className="text-xs text-actid-blue font-medium mt-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
                >
                  Vezi delegările
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
  Icon,
  count,
  label,
  iconColor,
  bg,
  onClick,
}: {
  Icon: LucideIcon;
  count: number | null;
  label: string;
  iconColor: string;
  bg: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-border p-3 text-center hover:shadow-sm transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
      aria-label={`${count ?? ""} ${label}`}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2", bg)}>
        <Icon size={20} className={iconColor} aria-hidden="true" />
      </div>
      {count === null ? (
        <div className="skeleton h-6 w-8 mx-auto rounded mb-1" />
      ) : (
        <p className={cn("text-2xl font-bold", iconColor)}>{count}</p>
      )}
      <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
    </button>
  );
}

function QuickAction({
  Icon,
  label,
  onClick,
  color,
}: {
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(color, "rounded-2xl p-4 text-center hover:opacity-90 active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue")}
    >
      <Icon size={22} className="mx-auto mb-1.5" aria-hidden="true" />
      <span className="text-xs font-semibold leading-tight block">{label}</span>
    </button>
  );
}
