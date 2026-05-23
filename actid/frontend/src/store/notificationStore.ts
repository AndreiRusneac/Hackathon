import { create } from "zustand";
import type { Document, Notification } from "@/types";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "info"; action?: ToastAction }>;
  unreadCount: number;
  generateFromDocuments: (docs: Document[]) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  // ACCESSIBILITY: optional action enables reversible toasts (e.g. "Anulează" after delete)
  addToast: (message: string, type?: "success" | "error" | "info", action?: ToastAction) => void;
  removeToast: (id: string) => void;
}

function buildNotifications(docs: Document[]): Notification[] {
  const result: Notification[] = [];

  for (const doc of docs) {
    if (!doc.expires_date) continue;

    const days = doc.days_remaining ?? 0;
    const label =
      doc.doc_type === "CI" ? "Carte de Identitate"
      : doc.doc_type === "PASAPORT" ? "Pașaport"
      : doc.doc_type === "PERMIS" ? "Permis de Conducere"
      : doc.doc_type === "CAZIER" ? "Cazier Judiciar"
      : doc.doc_type === "ROVINIETA" ? "Rovinietă"
      : doc.description || doc.doc_type;

    if (doc.status === "expirat") {
      result.push({
        id: `exp-${doc.id}`,
        type: "error",
        title: `${label} expirat!`,
        message: "Documentul tău a expirat. Reînnoiește-l cât mai curând.",
        doc_id: doc.id,
        dismissed: false,
      });
    } else if (days <= 7) {
      result.push({
        id: `exp-${doc.id}`,
        type: "error",
        title: `${label} expiră în ${days} zile!`,
        message: "Urgent: reînnoiește documentul înainte să expire.",
        doc_id: doc.id,
        dismissed: false,
      });
    } else if (days <= 30) {
      result.push({
        id: `exp-${doc.id}`,
        type: "warning",
        title: `${label} expiră în ${days} zile`,
        message: "Programează reînnoirea documentului pentru a evita probleme.",
        doc_id: doc.id,
        dismissed: false,
      });
    }
  }

  return result;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],
  unreadCount: 0,

  generateFromDocuments: (docs) => {
    const previousDismissed = new Set(
      get().notifications.filter((n) => n.dismissed).map((n) => n.id)
    );

    const fresh = buildNotifications(docs).map((n) => ({
      ...n,
      dismissed: previousDismissed.has(n.id),
    }));

    set({
      notifications: fresh,
      unreadCount: fresh.filter((n) => !n.dismissed).length,
    });
  },

  dismiss: (id) =>
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.dismissed).length };
    }),

  dismissAll: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, dismissed: true })),
      unreadCount: 0,
    })),

  addToast: (message, type = "info", action) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action }] }));
    // ACCESSIBILITY: give more time to act when an undo/action button is present
    setTimeout(() => get().removeToast(id), action ? 7000 : 4000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
