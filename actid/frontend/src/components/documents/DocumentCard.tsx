import { useState } from "react";
import {
  CreditCard, BookOpen, Car, Scale, Scroll, ClipboardList,
  Receipt, Building2, Route, FileText, Eye, Share2, Trash2, User,
  Flag, HeartHandshake, Cross, BookUser, Home, FileSignature, Banknote,
  Briefcase, GraduationCap, Award, BadgeCheck, HeartPulse, Accessibility,
  ParkingSquare, ScrollText, CalendarClock, Wrench, ShieldCheck,
  Fingerprint, Users, FolderOpen,
  type LucideIcon,
} from "lucide-react";
import { cn, DOC_LABELS, STATUS_CONFIG, formatDate } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import type { Document, DocStatus } from "@/types";

const DOC_ICON_MAP: Record<string, LucideIcon> = {
  // Identitate
  CI:                   CreditCard,
  PASAPORT:             BookOpen,
  CERT_CETATENIE:       Flag,
  CAZIER:               Scale,
  // Familie & Stare Civilă
  CERT_NASTERE:         Scroll,
  CERT_CASATORIE:       HeartHandshake,
  CERT_DECES:           Cross,
  LIVRET_FAMILIE:       BookUser,
  // Domiciliu & Acte Juridice
  ADEVERINTA_DOMICILIU: Home,
  PROCURA:              FileSignature,
  // Muncă & Venituri
  ADEVERINTA_VENIT:     Banknote,
  CONTRACT_MUNCA:       Briefcase,
  // Educație
  DIPLOMA_BAC:          GraduationCap,
  DIPLOMA_LICENTA:      Award,
  CERT_COMPETENTE:      BadgeCheck,
  // Sănătate
  CARD_SANATATE:        HeartPulse,
  CERT_HANDICAP:        Accessibility,
  ECUSON_PARCARE:       ParkingSquare,
  // Vehicul & Transport
  PERMIS:               Car,
  TALON:                ScrollText,
  INMATRICULARE_TEMP:   CalendarClock,
  ITP:                  Wrench,
  ASIGURARE:            ShieldCheck,
  ROVINIETA:            Route,
  // Legacy
  ADEVERINTA:           ClipboardList,
  ANAF:                 Receipt,
  ONRC:                 Building2,
};

export function DocTypeIcon({ type, size = 20, className }: { type: string; size?: number; className?: string }) {
  const Icon = DOC_ICON_MAP[type] || FileText;
  return <Icon size={size} className={className} aria-hidden="true" />;
}

// Per-folder identity: a signature icon + a tinted tile, keyed by category key
// (see DOC_CATEGORIES in utils). The tint lives only in the small icon square so
// the eye learns each folder by color. Shared by the documents page and the QR
// document picker.
export const CATEGORY_META: Record<string, { Icon: LucideIcon; tile: string }> = {
  identitate: { Icon: Fingerprint,   tile: "bg-blue-50 text-blue-600" },
  familie:    { Icon: Users,         tile: "bg-rose-50 text-rose-600" },
  domiciliu:  { Icon: Home,          tile: "bg-amber-50 text-amber-600" },
  munca:      { Icon: Briefcase,     tile: "bg-teal-50 text-teal-600" },
  educatie:   { Icon: GraduationCap, tile: "bg-violet-50 text-violet-600" },
  sanatate:   { Icon: HeartPulse,    tile: "bg-emerald-50 text-emerald-600" },
  vehicul:    { Icon: Car,           tile: "bg-sky-50 text-sky-600" },
  altele:     { Icon: FolderOpen,    tile: "bg-gray-100 text-gray-500" },
};

interface DocumentCardProps {
  doc: Document;
  onShare?: (doc: Document) => void;
  onView?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  delegatedFrom?: string;
  compact?: boolean;
}

export function DocumentCard({
  doc,
  onShare,
  onView,
  onDelete,
  delegatedFrom,
  compact = false,
}: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = (doc.status || "valid") as DocStatus;
  const cfg = STATUS_CONFIG[status];
  const label = DOC_LABELS[doc.doc_type] || doc.doc_type;

  const iconBg = {
    valid:        "bg-blue-50 text-blue-600",
    expiră_curând: "bg-amber-50 text-amber-600",
    expirat:       "bg-red-50 text-red-500",
  }[status] ?? "bg-blue-50 text-blue-600";

  const badgeText = status === "valid"
    ? "Valabil"
    : status === "expirat"
    ? "Expirat"
    : "Expiră curând";

  const badgeVariant = status === "valid" ? "success" : status === "expirat" ? "danger" : "warning";

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border card-hover cursor-pointer",
        status === "expirat"       ? "border-red-200"   : "",
        status === "expiră_curând" ? "border-amber-200" : "border-border"
      )}
      onClick={() => (compact ? onView?.(doc) : setExpanded(!expanded))}
      role="button"
      tabIndex={0}
      aria-expanded={!compact ? expanded : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          compact ? onView?.(doc) : setExpanded(!expanded);
        }
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
            <DocTypeIcon type={doc.doc_type} size={22} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{label}</p>
                {doc.doc_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc.doc_number}</p>
                )}
                {delegatedFrom && (
                  <p className="text-xs text-purple-600 mt-0.5 flex items-center gap-1">
                    <User size={11} aria-hidden="true" /> {delegatedFrom}
                  </p>
                )}
              </div>
              <Badge variant={badgeVariant} className="flex-shrink-0">{badgeText}</Badge>
            </div>

            {doc.expires_date && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Expiră:</span>
                <span className={cn(
                  "text-xs font-medium",
                  status === "valid"        && "text-foreground",
                  status === "expiră_curând" && "text-amber-700",
                  status === "expirat"       && "text-red-700"
                )}>
                  {formatDate(doc.expires_date)}
                </span>
                {doc.days_remaining !== undefined && doc.days_remaining !== null && (
                  <span className={cn("text-xs", cfg.color)}>
                    ({doc.days_remaining > 0 ? `${doc.days_remaining} zile` : "expirat"})
                  </span>
                )}
              </div>
            )}
            {!doc.expires_date && (
              <p className="text-xs text-muted-foreground mt-1.5">Fără dată de expirare</p>
            )}
          </div>
        </div>

        {expanded && !compact && (
          <div className="mt-4 pt-4 border-t border-border space-y-2 animate-fade-in">
            {doc.issued_by && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Emis de:</span>
                <span className="font-medium">{doc.issued_by}</span>
              </div>
            )}
            {doc.issued_date && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Data emiterii:</span>
                <span className="font-medium">{formatDate(doc.issued_date)}</span>
              </div>
            )}
            {doc.is_verified && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Stare:</span>
                <span className="text-green-600 font-medium">Verificat digital</span>
              </div>
            )}

            <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
              {onView && (
                <Button size="sm" variant="secondary" onClick={() => onView(doc)} className="flex-1 gap-1.5">
                  <Eye size={14} aria-hidden="true" /> Vizualizează
                </Button>
              )}
              {onShare && (
                <Button size="sm" variant="outline" onClick={() => onShare(doc)} className="flex-1 gap-1.5">
                  <Share2 size={14} aria-hidden="true" /> Distribuie
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" onClick={() => onDelete(doc)} aria-label="Șterge document">
                  <Trash2 size={14} aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 skeleton rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-3 w-40 rounded" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}
