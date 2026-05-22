import { useState } from "react";
import { cn, DOC_LABELS, DOC_ICONS, STATUS_CONFIG, formatDate } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import type { Document, DocStatus } from "@/types";

interface DocumentCardProps {
  doc: Document;
  onShare?: (doc: Document) => void;
  onView?: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  onRenewalRequest?: () => Promise<void>;
  delegatedFrom?: string;
  canRenewal?: boolean;
  compact?: boolean;
}

export function DocumentCard({
  doc,
  onShare,
  onView,
  onDelete,
  onRenewalRequest,
  delegatedFrom,
  canRenewal = false,
  compact = false,
}: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [renewalSent, setRenewalSent] = useState(false);
  const [renewalPending, setRenewalPending] = useState(false);
  const status = (doc.status || "valid") as DocStatus;
  const cfg = STATUS_CONFIG[status];
  const icon = DOC_ICONS[doc.doc_type] || "📄";
  const label = DOC_LABELS[doc.doc_type] || doc.doc_type;

  const handleRenewal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenewalPending(true);
    try {
      await onRenewalRequest?.();
      setRenewalSent(true);
    } finally {
      setRenewalPending(false);
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-border card-hover cursor-pointer",
        status === "expirat" && "border-red-200",
        status === "expiră_curând" && "border-amber-200"
      )}
      onClick={() => (compact ? onView?.(doc) : setExpanded(!expanded))}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl",
              status === "valid" && "bg-blue-50",
              status === "expiră_curând" && "bg-amber-50",
              status === "expirat" && "bg-red-50"
            )}
            aria-hidden="true"
          >
            {icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{label}</p>
                {doc.doc_number && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc.doc_number}</p>
                )}
                {delegatedFrom && (
                  <p className="text-xs text-purple-600 mt-0.5">👤 {delegatedFrom}</p>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <Badge
                  variant={
                    status === "valid"
                      ? "success"
                      : status === "expiră_curând"
                      ? "warning"
                      : "danger"
                  }
                >
                  {status === "valid"
                    ? "✓ Valid"
                    : status === "expirat"
                    ? "✕ Expirat"
                    : `⚡ ${doc.days_remaining}z`}
                </Badge>
                {renewalSent && (
                  <Badge variant="info" className="text-[10px]">🔄 Reînnoire solicitată</Badge>
                )}
              </div>
            </div>

            {/* Expiry info */}
            {doc.expires_date && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Expiră:</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    status === "valid" && "text-foreground",
                    status === "expiră_curând" && "text-amber-700",
                    status === "expirat" && "text-red-700"
                  )}
                >
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

        {/* Expanded details */}
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
                <span className="text-green-600 font-medium">✓ Verificat digital</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
              {onView && (
                <Button size="sm" variant="secondary" onClick={() => onView(doc)} className="flex-1">
                  👁 Vizualizează
                </Button>
              )}
              {onShare && (
                <Button size="sm" variant="outline" onClick={() => onShare(doc)} className="flex-1">
                  📱 Distribuie
                </Button>
              )}
              {canRenewal && !renewalSent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRenewal}
                  loading={renewalPending}
                  className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  🔄 Solicită reînnoire
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" onClick={() => onDelete(doc)}>
                  🗑
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

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
