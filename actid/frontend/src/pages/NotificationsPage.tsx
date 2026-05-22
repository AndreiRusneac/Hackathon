import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Alert, Button } from "@/components/ui";
import type { Notification } from "@/types";

type Filter = "toate" | "necitite" | "urgente";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "toate", label: "Toate" },
  { key: "necitite", label: "Necitite" },
  { key: "urgente", label: "Urgente" },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, dismiss, dismissAll } = useNotificationStore();
  const [filter, setFilter] = useState<Filter>("toate");

  const filtered = notifications.filter((n: Notification) => {
    if (filter === "necitite") return !n.dismissed;
    if (filter === "urgente") return n.type === "error";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.dismissed).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificări</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} necitite` : "Toate citite"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={dismissAll}>
            Marchează toate citite
          </Button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl" role="tablist">
        {FILTERS.map((f) => {
          const count =
            f.key === "toate"
              ? notifications.length
              : f.key === "necitite"
              ? notifications.filter((n) => !n.dismissed).length
              : notifications.filter((n) => n.type === "error").length;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                filter === f.key
                  ? "bg-white shadow-sm text-actid-blue"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    filter === f.key ? "bg-actid-blue text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3" role="list" aria-label="Notificări">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-14">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-green-600" aria-hidden="true" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                {filter === "necitite"
                  ? "Nicio notificare necitită"
                  : filter === "urgente"
                  ? "Nicio notificare urgentă"
                  : "Toate documentele sunt în regulă"}
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                {filter === "toate"
                  ? "Vei primi notificări când documentele tale sunt aproape de expirare."
                  : ""}
              </p>
              {filter !== "toate" && (
                <button
                  onClick={() => setFilter("toate")}
                  className="mt-4 text-sm text-actid-blue font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
                >
                  ← Arată toate
                </button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((n) => (
            <div key={n.id} role="listitem" className={n.dismissed ? "opacity-60" : ""}>
              <Alert
                variant={n.type === "error" ? "error" : n.type === "warning" ? "warning" : "info"}
                title={n.title}
                onDismiss={!n.dismissed ? () => dismiss(n.id) : undefined}
              >
                <span>{n.message}</span>
                {n.dismissed && (
                  <span className="ml-2 text-xs opacity-70">(citită)</span>
                )}
              </Alert>
            </div>
          ))
        )}
      </div>

      {notifications.length === 0 && (
        <div className="text-center">
          <button
            onClick={() => navigate("/documents")}
            className="text-sm text-actid-blue font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
          >
            → Verifică documentele tale
          </button>
        </div>
      )}
    </div>
  );
}
