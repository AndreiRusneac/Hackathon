import { create } from "zustand";
import type { Document, Notification } from "@/types";

interface NotificationState {
  notifications: Notification[];
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "info" }>;
  generateFromDocuments: (docs: Document[]) => void;
  dismiss: (id: string) => void;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],

  generateFromDocuments: (docs) => {
    const notifications: Notification[] = [];

    for (const doc of docs) {
      if (!doc.expires_date || doc.status === "valid") continue;

      const days = doc.days_remaining ?? 0;
      const label =
        doc.doc_type === "CI"
          ? "Carte de Identitate"
          : doc.doc_type === "PASAPORT"
          ? "Pașaport"
          : doc.doc_type === "PERMIS"
          ? "Permis de Conducere"
          : doc.doc_type === "CAZIER"
          ? "Cazier Judiciar"
          : doc.doc_type === "ROVINIETA"
          ? "Rovinietă"
          : doc.description || doc.doc_type;

      if (doc.status === "expirat") {
        notifications.push({
          id: `exp-${doc.id}`,
          type: "error",
          title: `${label} expirat!`,
          message: `Documentul tău a expirat. Reînnoiește-l cât mai curând.`,
          doc_id: doc.id,
          dismissed: false,
        });
      } else if (days <= 7) {
        notifications.push({
          id: `exp-${doc.id}`,
          type: "error",
          title: `${label} expiră în ${days} zile!`,
          message: `Urgent: reînnoiește documentul înainte să expire.`,
          doc_id: doc.id,
          dismissed: false,
        });
      } else if (days <= 30) {
        notifications.push({
          id: `exp-${doc.id}`,
          type: "warning",
          title: `${label} expiră în ${days} zile`,
          message: `Programează reînnoirea documentului pentru a evita probleme.`,
          doc_id: doc.id,
          dismissed: false,
        });
      }
    }

    set({ notifications });
  },

  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n
      ),
    })),

  addToast: (message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
