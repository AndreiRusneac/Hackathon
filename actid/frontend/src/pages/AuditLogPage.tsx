import { useCallback, useEffect, useState } from "react";
import { auditApi, getErrMsg } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { formatDateTime, truncateHash, ACTION_LABELS } from "@/lib/utils";
import type { AuditEntry, AuditStats } from "@/types";

export default function AuditLogPage() {
  const { addToast } = useNotificationStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [chainStatus, setChainStatus] = useState<{
    valid: boolean;
    entries_checked: number;
    message: string;
  } | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        auditApi.listEntries(30),
        auditApi.stats(),
      ]);
      setEntries(entriesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      addToast(getErrMsg(err, "Eroare la încărcarea jurnalului"), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await auditApi.verifyChain();
      setChainStatus(res.data);
      addToast(
        res.data.valid ? "✓ Lanț valid — nicio modificare detectată" : "⚠ Erori detectate în lanț",
        res.data.valid ? "success" : "error"
      );
    } catch (err) {
      addToast(getErrMsg(err, "Eroare la verificare"), "error");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Jurnal de Audit</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Registru imutabil cu SHA-256 · Append-only · Verificabil
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-border p-3 text-center">
          <p className="text-xl font-bold text-actid-blue">{stats?.total_entries ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Intrări totale</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-3 text-center">
          <p className="text-xl font-bold text-actid-blue">{stats?.user_entries ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Ale mele</p>
        </div>
        <div className="bg-white rounded-2xl border border-border p-3 text-center">
          <p className="text-xl font-bold text-green-600">
            {chainStatus === null ? "—" : chainStatus.valid ? "✓" : "✕"}
          </p>
          <p className="text-xs text-muted-foreground">Lanț valid</p>
        </div>
      </div>

      {/* Verify button */}
      <Card className={chainStatus ? (chainStatus.valid ? "border-green-200" : "border-red-200") : ""}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Verificare integritate lanț</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verifică că niciun bloc nu a fost modificat
              </p>
            </div>
            <Button
              size="sm"
              variant={chainStatus?.valid ? "outline" : "primary"}
              onClick={handleVerify}
              loading={verifying}
            >
              🔍 Verifică
            </Button>
          </div>
          {chainStatus && (
            <div
              className={`mt-3 p-3 rounded-xl text-sm font-medium ${
                chainStatus.valid
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {chainStatus.valid ? "✅" : "❌"} {chainStatus.message} ·{" "}
              {chainStatus.entries_checked} blocuri verificate
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chain visualization */}
      <div>
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Blockchain Audit Log
        </p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-8 h-8 skeleton rounded-xl" />
                  {i < 3 && <div className="chain-connector mt-1" />}
                </div>
                <div className="flex-1 bg-white rounded-2xl border border-border p-4">
                  <div className="skeleton h-4 w-40 rounded mb-2" />
                  <div className="skeleton h-3 w-60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-4xl mb-3">🔗</p>
              <p className="font-semibold">Jurnal gol</p>
              <p className="text-sm text-muted-foreground mt-1">
                Nu există intrări înregistrate
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-0">
            {entries.map((entry, idx) => (
              <AuditBlock
                key={entry.id}
                entry={entry}
                isLast={idx === entries.length - 1}
                isExpanded={expanded === entry.id}
                onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditBlock({
  entry,
  isLast,
  isExpanded,
  onToggle,
}: {
  entry: AuditEntry;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const actionInfo = ACTION_LABELS[entry.action] || {
    label: entry.action,
    icon: "📋",
    color: "text-gray-600",
  };

  const roleColors: Record<string, string> = {
    "cetățean": "bg-blue-50 text-blue-700",
    "funcționar": "bg-purple-50 text-purple-700",
    "sistem": "bg-gray-100 text-gray-600",
  };

  return (
    <div className="flex gap-3 items-start">
      {/* Chain connector */}
      <div className="flex flex-col items-center flex-shrink-0 pt-3">
        <button
          onClick={onToggle}
          className="w-8 h-8 bg-actid-blue rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm hover:bg-actid-blue-light transition-colors"
          aria-label={`Block #${entry.block_number}`}
          title={`Block #${entry.block_number}`}
        >
          {entry.block_number}
        </button>
        {!isLast && <div className="chain-connector mt-1" />}
      </div>

      {/* Block content */}
      <div
        className="flex-1 bg-white rounded-2xl border border-border mb-2 overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        aria-expanded={isExpanded}
      >
        <div className="p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">{actionInfo.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-semibold ${actionInfo.color}`}>
                  {actionInfo.label}
                </p>
                <Badge
                  className={`text-[10px] ${roleColors[entry.actor_role] || "bg-gray-100 text-gray-600"}`}
                >
                  {entry.actor_role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.actor_name || "Sistem"} · {formatDateTime(entry.timestamp)}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                🔐 {truncateHash(entry.hash, 10)}
              </p>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border space-y-2 animate-fade-in">
              <HashRow label="Hash" value={entry.hash} />
              <HashRow label="Hash anterior" value={entry.prev_hash} dimmed />

              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Metadate</p>
                  <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {entry.target_document_id && (
                  <div>
                    <span className="text-muted-foreground">Document:</span>{" "}
                    <span className="font-mono">{entry.target_document_id.slice(0, 12)}…</span>
                  </div>
                )}
                {entry.target_user_id && (
                  <div>
                    <span className="text-muted-foreground">User:</span>{" "}
                    <span className="font-mono">{entry.target_user_id.slice(0, 12)}…</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HashRow({
  label,
  value,
  dimmed = false,
}: {
  label: string;
  value: string;
  dimmed?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p
        className={`font-mono text-[10px] break-all ${
          dimmed ? "text-muted-foreground" : "text-actid-blue"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
