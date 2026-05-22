import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import type { DocStatus, DocType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd.MM.yyyy", { locale: ro });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd.MM.yyyy HH:mm", { locale: ro });
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: ro });
  } catch {
    return dateStr;
  }
}

export function truncateHash(hash: string, chars = 8): string {
  if (!hash || hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export const DOC_LABELS: Record<DocType, string> = {
  CI: "Carte de Identitate",
  PASAPORT: "Pașaport",
  PERMIS: "Permis de Conducere",
  CAZIER: "Cazier Judiciar",
  CERT_NASTERE: "Certificat de Naștere",
  ADEVERINTA: "Adeverință",
  ANAF: "Certificat ANAF",
  ONRC: "Document ONRC",
  ROVINIETA: "Rovinietă",
};

export const DOC_ICONS: Record<DocType, string> = {
  CI: "🪪",
  PASAPORT: "📔",
  PERMIS: "🚗",
  CAZIER: "⚖️",
  CERT_NASTERE: "📜",
  ADEVERINTA: "📋",
  ANAF: "💰",
  ONRC: "🏢",
  ROVINIETA: "🛣️",
};

export const STATUS_CONFIG: Record<
  DocStatus,
  { label: string; color: string; bg: string; ring: string }
> = {
  valid: {
    label: "Valid",
    color: "text-green-700",
    bg: "bg-green-50",
    ring: "ring-green-200",
  },
  expiră_curând: {
    label: "Expiră curând",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  expirat: {
    label: "Expirat",
    color: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
  },
};

export const ACTION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  LOGIN_SUCCESS: { label: "Autentificare reușită", icon: "🔐", color: "text-green-600" },
  LOGIN_ATTEMPT: { label: "Tentativă autentificare", icon: "🔑", color: "text-blue-600" },
  LOGOUT: { label: "Deconectare", icon: "👋", color: "text-gray-600" },
  DOCUMENT_VIEW: { label: "Vizualizare document", icon: "👁️", color: "text-blue-600" },
  DOCUMENT_UPLOAD: { label: "Încărcare document", icon: "📤", color: "text-green-600" },
  DOCUMENT_DELETE: { label: "Ștergere document", icon: "🗑️", color: "text-red-600" },
  QR_TOKEN_CREATE: { label: "Creare token QR", icon: "📱", color: "text-purple-600" },
  QR_TOKEN_SCAN: { label: "Scanare token QR", icon: "📷", color: "text-orange-600" },
  QR_TOKEN_REVOKE: { label: "Revocare token QR", icon: "🚫", color: "text-red-600" },
  DELEGATION_CREATE: { label: "Acordare delegare", icon: "🤝", color: "text-teal-600" },
  DELEGATION_REVOKE: { label: "Revocare delegare", icon: "❌", color: "text-red-600" },
  SYSTEM_INIT: { label: "Inițializare sistem", icon: "🚀", color: "text-gray-600" },
};
