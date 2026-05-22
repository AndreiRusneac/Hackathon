import { Alert } from "@/components/ui";
import { useNotificationStore } from "@/store/notificationStore";

export function NotificationBanner() {
  const { notifications, dismiss } = useNotificationStore();
  const active = notifications.filter((n) => !n.dismissed);

  if (!active.length) return null;

  return (
    <div className="space-y-2" role="region" aria-label="Notificări">
      {active.map((n) => (
        <Alert
          key={n.id}
          variant={n.type === "error" ? "error" : n.type === "warning" ? "warning" : "info"}
          title={n.title}
          onDismiss={() => dismiss(n.id)}
        >
          {n.message}
        </Alert>
      ))}
    </div>
  );
}
