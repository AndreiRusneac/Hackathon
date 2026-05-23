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

export const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  LOGIN_SUCCESS: { label: "Autentificare reușită", color: "text-green-600" },
  LOGIN_ATTEMPT: { label: "Tentativă autentificare", color: "text-blue-600" },
  LOGOUT: { label: "Deconectare", color: "text-gray-600" },
  DOCUMENT_VIEW: { label: "Vizualizare document", color: "text-green-600" },
  DOCUMENT_UPLOAD: { label: "Adăugare document", color: "text-blue-600" },
  DOCUMENT_DELETE: { label: "Ștergere document", color: "text-red-600" },
  QR_TOKEN_CREATE: { label: "Creare partajare QR", color: "text-amber-600" },
  QR_TOKEN_SCAN: { label: "Scanare QR (funcționar)", color: "text-orange-600" },
  QR_TOKEN_REVOKE: { label: "Revocare partajare QR", color: "text-red-600" },
  DELEGATION_CREATE: { label: "Acordare delegare familie", color: "text-teal-600" },
  DELEGATION_REVOKE: { label: "Revocare delegare", color: "text-red-600" },
  SYSTEM_INIT: { label: "Inițializare sistem", color: "text-gray-600" },
  RENEWAL_REQUEST: { label: "Cerere reînnoire", color: "text-blue-600" },
};

export const ACTION_STYLE: Record<string, { block: string; ring: string; line: string }> = {
  LOGIN_SUCCESS: { block: "bg-slate-500", ring: "ring-slate-200", line: "from-slate-200 to-slate-400" },
  LOGIN_ATTEMPT: { block: "bg-slate-400", ring: "ring-slate-200", line: "from-slate-200 to-slate-300" },
  LOGOUT: { block: "bg-slate-400", ring: "ring-slate-200", line: "from-slate-200 to-slate-300" },
  DOCUMENT_VIEW: { block: "bg-green-600", ring: "ring-green-200", line: "from-green-200 to-green-400" },
  DOCUMENT_UPLOAD: { block: "bg-blue-600", ring: "ring-blue-200", line: "from-blue-200 to-blue-400" },
  DOCUMENT_DELETE: { block: "bg-red-600", ring: "ring-red-200", line: "from-red-200 to-red-400" },
  QR_TOKEN_CREATE: { block: "bg-amber-500", ring: "ring-amber-200", line: "from-amber-200 to-amber-400" },
  QR_TOKEN_SCAN: { block: "bg-orange-600", ring: "ring-orange-200", line: "from-orange-200 to-orange-400" },
  QR_TOKEN_REVOKE: { block: "bg-red-500", ring: "ring-red-200", line: "from-red-200 to-red-400" },
  DELEGATION_CREATE: { block: "bg-teal-600", ring: "ring-teal-200", line: "from-teal-200 to-teal-400" },
  DELEGATION_REVOKE: { block: "bg-red-500", ring: "ring-red-200", line: "from-red-200 to-red-400" },
  SYSTEM_INIT: { block: "bg-violet-600", ring: "ring-violet-200", line: "from-violet-200 to-violet-400" },
  RENEWAL_REQUEST: { block: "bg-blue-500", ring: "ring-blue-200", line: "from-blue-200 to-blue-400" },
};

export const DEFAULT_ACTION_STYLE = {
  block: "bg-gray-500",
  ring: "ring-gray-200",
  line: "from-gray-200 to-gray-400",
};
