import { useEffect, useMemo, useState } from "react";
import {
  LogIn, LogOut, Eye, Upload, Trash2, QrCode,
  UserPlus, UserMinus, Zap, FileText, Link2, CheckCircle2, XCircle, Users,
  type LucideIcon,
} from "lucide-react";
import { auditApi } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import {
  formatDateTime,
  truncateHash,
  ACTION_LABELS,
  ACTION_STYLE,
  DEFAULT_ACTION_STYLE,
  cn,
} from "@/lib/utils";
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

interface ChainStatus {
  valid: boolean;
  entries_checked: number;
  message: string;
}

interface AuditStats {
  total_entries: number;
  user_entries: number;
  documents_created: number;
  qr_shares: number;
  delegations: number;
  chain_valid: boolean;
}

export default function AuditLogPage() {
  const { addToast } = useNotificationStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [entriesRes, statsRes] = await Promise.all([
        auditApi.listEntries(100),
        auditApi.stats(),
      ]);
      setEntries(entriesRes.data);
      setStats(statsRes.data);
    } catch {
      addToast("Eroare la încărcarea jurnalului", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await auditApi.verifyChain();
      setChainStatus(res.data);
      addToast(
        res.data.valid
          ? `✓ Lanț valid — ${res.data.entries_checked} înregistrări`
          : "✗ Integritate compromisă",
        res.data.valid ? "success" : "error"
      );
    } catch {
      addToast("Eroare la verificare", "error");
    } finally {
      setVerifying(false);
    }
  };

  const actions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action))).sort(),
    [entries]
  );
  const actors = useMemo(
    () =>
      Array.from(new Set(entries.map((e) => e.actor_name).filter(Boolean))).sort() as string[],
    [entries]
  );

  const filtered = useMemo(
    () =>
      entries.filter(
        (e) =>
          (!actionFilter || e.action === actionFilter) &&
          (!actorFilter || e.actor_name === actorFilter)
      ),
    [entries, actionFilter, actorFilter]
  );

  const hasFilter = Boolean(actionFilter || actorFilter);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Jurnal de Audit</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Registru imutabil SHA-256 · Append-only · Verificabil de oricine
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          value={stats?.total_entries}
          label="Înregistrări totale"
          Icon={Link2}
          iconColor="text-actid-blue"
          iconBg="bg-blue-50"
          loading={loading}
        />
        <StatCard
          value={stats?.documents_created}
          label="Documente create"
          Icon={Upload}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={loading}
        />
        <StatCard
          value={stats?.qr_shares}
          label="Partajări QR"
          Icon={QrCode}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          loading={loading}
        />
        <StatCard
          value={stats?.delegations}
          label="Delegări familie"
          Icon={Users}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
          loading={loading}
        />
      </div>

      {/* Verify chain */}
      <Card
        className={
          chainStatus
            ? chainStatus.valid
              ? "border-green-300"
              : "border-red-300"
            : ""
        }
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm">Verificare integritate lanț</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Recalculează fiecare hash și confirmă că niciun bloc nu a fost
                modificat
              </p>
            </div>
            <Button
              size="sm"
              variant={chainStatus?.valid ? "outline" : "primary"}
              onClick={handleVerify}
              loading={verifying}
              className="gap-1.5"
            >
              <Link2 size={14} aria-hidden="true" /> Verifică
            </Button>
          </div>
          {chainStatus && (
            <div
              className={`mt-3 p-3 rounded-xl text-sm font-semibold ${
                chainStatus.valid
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {chainStatus.valid
                ? `✓ Lanț valid — ${chainStatus.entries_checked} înregistrări`
                : `✗ Integritate compromisă — ${chainStatus.message}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chain visualization */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Lanț blockchain de audit
          </p>
          {hasFilter && (
            <button
              onClick={() => {
                setActionFilter("");
                setActorFilter("");
              }}
              className="text-xs text-actid-blue font-medium hover:underline"
            >
              Resetează filtre
            </button>
          )}
        </div>

        {/* Filters */}
        {!loading && entries.length > 0 && (
          <div className="flex gap-2 mb-3">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="Filtrează după acțiune"
              className="flex-1 h-9 rounded-xl border border-input bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-actid-blue/30"
            >
              <option value="">Toate acțiunile</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a]?.label ?? a}
                </option>
              ))}
            </select>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              aria-label="Filtrează după actor"
              className="flex-1 h-9 rounded-xl border border-input bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-actid-blue/30"
            >
              <option value="">Toți actorii</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}

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
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Link2 size={22} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-semibold">
                {hasFilter ? "Niciun rezultat" : "Jurnal gol"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasFilter
                  ? "Niciun bloc nu corespunde filtrelor selectate"
                  : "Nu există intrări înregistrate"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-0">
            {filtered.map((entry, idx) => (
              <AuditBlock
                key={entry.id}
                entry={entry}
                isLast={idx === filtered.length - 1}
                isExpanded={expanded === entry.id}
                onToggle={() =>
                  setExpanded(expanded === entry.id ? null : entry.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  Icon,
  iconColor = "text-actid-blue",
  iconBg = "bg-blue-50",
  loading,
}: {
  value: number | undefined;
  label: string;
  Icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-3 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
        <Icon size={20} className={iconColor} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="skeleton h-6 w-10 rounded mb-1" />
        ) : (
          <p className="text-xl font-bold text-actid-blue leading-tight">
            {value ?? "—"}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
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
    color: "text-gray-600",
  };
  const ActionIcon = ACTION_ICON_MAP[entry.action] || FileText;
  const style = ACTION_STYLE[entry.action] || DEFAULT_ACTION_STYLE;
  const isGenesis = entry.block_number === 0;

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
          className={`w-9 h-9 ${style.block} rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ${style.ring} hover:opacity-90 transition-opacity`}
          aria-label={`Bloc #${entry.block_number} — ${actionInfo.label}`}
          title={`Bloc #${entry.block_number}`}
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
            <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <ActionIcon size={15} className="text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-semibold ${actionInfo.color}`}>
                  {actionInfo.label}
                </p>
                {isGenesis && (
                  <Badge className="text-[10px] bg-violet-50 text-violet-700 ring-1 ring-violet-200 inline-flex items-center gap-1">
                    <Link2 size={9} aria-hidden="true" /> Bloc geneză
                  </Badge>
                )}
                <Badge
                  className={`text-[10px] ${
                    roleColors[entry.actor_role] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  {entry.actor_role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.actor_name || "Sistem"} · {formatDateTime(entry.timestamp)}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                {truncateHash(entry.hash, 10)}
              </p>
            </div>
            <span className="text-muted-foreground text-xs flex-shrink-0">
              {isExpanded ? "▲" : "▼"}
            </span>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-border space-y-2 animate-fade-in">
              <HashRow label="Hash bloc" value={entry.hash} />
              <HashRow
                label={isGenesis ? "Hash anterior (geneză)" : "Hash bloc anterior"}
                value={entry.prev_hash}
                dimmed
              />

              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Metadate
                  </p>
                  <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {entry.target_document_id && (
                  <div>
                    <span className="text-muted-foreground">Document:</span>{" "}
                    <span className="font-mono">
                      {entry.target_document_id.slice(0, 12)}…
                    </span>
                  </div>
                )}
                {entry.target_user_id && (
                  <div>
                    <span className="text-muted-foreground">Utilizator:</span>{" "}
                    <span className="font-mono">
                      {entry.target_user_id.slice(0, 12)}…
                    </span>
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
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
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