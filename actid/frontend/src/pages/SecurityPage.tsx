import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import {
  ShieldCheck, Lock, BadgeCheck, History, ChevronDown, ChevronUp,
  Globe, Calendar, Key, Eye, EyeOff, AlertCircle, CheckCircle2, RefreshCw,
} from "lucide-react";
import { walletApi, type WalletSecurity, type PresentationHistoryEntry } from "@/lib/api";
import { Badge, Card, CardContent, Button } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

const ATTR_LABELS: Record<string, string> = {
  given_name: "Prenume",
  family_name: "Nume de familie",
  birth_date: "Data nașterii",
  cnp: "CNP",
  document_number: "Nr. document",
  issue_date: "Data emiterii",
  expiry_date: "Data expirării",
  over_18: "Peste 18 ani",
  over_65: "Peste 65 ani",
  nationality: "Naționalitate",
  categories: "Categorii permis",
};

function attrLabel(key: string) {
  return ATTR_LABELS[key] ?? key;
}

function SectionHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-actid-blue flex-shrink-0" aria-hidden="true" />
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
      <div className="flex-1 h-px bg-border" aria-hidden="true" />
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function IssuerCard({ issuer, fingerprint }: { issuer: WalletSecurity["trusted_issuers"][number]; fingerprint: string }) {
  const [showFingerprint, setShowFingerprint] = useState(false);
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug">{issuer.name}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe size={11} aria-hidden="true" /> {issuer.country}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={11} aria-hidden="true" /> din {issuer.valid_from}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono mt-1">{issuer.id}</p>
          </div>
          <Badge variant="success" className="flex-shrink-0">Verificat</Badge>
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Key size={11} aria-hidden="true" /> Cheie publică (fingerprint):
            </span>
            <button
              onClick={() => setShowFingerprint(!showFingerprint)}
              className="text-xs text-actid-blue hover:underline flex items-center gap-1"
            >
              {showFingerprint ? <EyeOff size={11} /> : <Eye size={11} />}
              {showFingerprint ? "Ascunde" : "Arată"}
            </button>
          </div>
          {showFingerprint && (
            <p className="font-mono text-[11px] text-foreground mt-1.5 break-all animate-fade-in">
              {fingerprint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PresentationCard({ entry }: { entry: PresentationHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const scanned = !!entry.scanned_at;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-4 cursor-pointer transition-all",
        scanned ? "border-border" : "border-amber-200"
      )}
      onClick={() => setOpen(!open)}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{entry.purpose}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.document_type} · {formatDate(entry.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={scanned ? "success" : "warning"}>
            {scanned ? "Scanat" : "Nefolosit"}
          </Badge>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-2 animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Atribute dezvăluite:</p>
            <div className="flex flex-wrap gap-1.5">
              {entry.disclosed_attributes.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  <Eye size={10} aria-hidden="true" /> {attrLabel(a)}
                </span>
              ))}
            </div>
          </div>
          {scanned && <FieldRow label="Verificat de" value={entry.scanned_by_name ?? "—"} />}
          {scanned && entry.scanned_at && <FieldRow label="Data verificării" value={formatDate(entry.scanned_at)} />}
          {!scanned && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle size={11} aria-hidden="true" /> Prezentarea nu a fost încă scanată
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const [security, setSecurity] = useState<WalletSecurity | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [history, setHistory] = useState<PresentationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setSecurityError(null);
    const [secRes, histRes] = await Promise.allSettled([
      walletApi.security(),
      walletApi.history(),
    ]);
    if (secRes.status === "fulfilled") {
      setSecurity(secRes.value.data);
    } else {
      setSecurity(null);
      setSecurityError("Nu s-au putut încărca datele de securitate. Verifică conexiunea sau repornește serverul.");
    }
    setHistory(histRes.status === "fulfilled" ? histRes.value.data.presentations : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-border p-4">
            <div className="skeleton h-4 w-40 rounded mb-3" />
            <div className="space-y-2">
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (securityError) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Card className="border-red-200">
          <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
              <AlertCircle size={28} className="text-red-500" aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-base">Eroare la încărcare</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">{securityError}</p>
            </div>
            <Button variant="secondary" onClick={load} className="gap-2">
              <RefreshCw size={14} aria-hidden="true" /> Reîncearcă
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!security) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Securitate Wallet</h1>
        <p className="text-sm text-muted-foreground mt-0.5 break-all">
          ID instanță: <span className="font-mono">{security.wallet_instance_id}</span>
        </p>
      </div>

      <section>
        <SectionHeader icon={Lock} title="Criptare date" />
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                security.encryption.at_rest_enabled ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              )}>
                {security.encryption.at_rest_enabled
                  ? <CheckCircle2 size={20} aria-hidden="true" />
                  : <AlertCircle size={20} aria-hidden="true" />}
              </div>
              <div>
                <p className="font-semibold text-sm">
                  {security.encryption.at_rest_enabled ? "Criptare activă" : "Criptare inactivă"}
                </p>
                <p className="text-xs text-muted-foreground">{security.encryption.algorithm}</p>
              </div>
              <Badge variant={security.encryption.at_rest_enabled ? "success" : "danger"} className="ml-auto">
                {security.encryption.at_rest_enabled ? "Activ" : "Inactiv"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Câmpuri criptate în baza de date:</p>
            {security.encryption.encrypted_fields.map((field) => (
              <div key={field} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                <Lock size={11} className="text-green-600 flex-shrink-0" aria-hidden="true" />
                <span className="font-mono text-foreground">{field}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader icon={BadgeCheck} title="Emitenți de încredere" />
        <div className="space-y-3">
          {security.trusted_issuers.map((issuer) => (
            <IssuerCard
              key={issuer.id}
              issuer={issuer}
              fingerprint={security.issuer_public_key_fingerprint}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader icon={History} title={`Istoric prezentări (${history.length})`} />
        {history.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <History size={22} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-semibold">Nicio prezentare încă</p>
              <p className="text-sm text-muted-foreground mt-1">Prezentările selective vor apărea aici</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3" role="list">
            {history.map((entry) => (
              <div key={entry.id} role="listitem">
                <PresentationCard entry={entry} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
