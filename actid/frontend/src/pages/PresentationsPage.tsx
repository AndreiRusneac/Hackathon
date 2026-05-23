import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  Shield, ShieldCheck, Check, Clock, RotateCcw, AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { presentationsApi, documentsApi, credentialsApi } from "@/lib/api";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, Badge, Button, StatusBadge } from "@/components/ui";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { DOC_LABELS, formatDateTime, cn } from "@/lib/utils";
import type { Document, Presentation } from "@/types";

// ─── Attribute catalog per doc type ──────────────────────────────────────────

interface Attr { key: string; label: string; sensitive?: boolean }

const ATTR_CATALOG: Record<string, Attr[]> = {
  CI: [
    { key: "given_name",  label: "Prenume" },
    { key: "family_name", label: "Nume de familie" },
    { key: "birth_date",  label: "Data nașterii" },
    { key: "age_over_18", label: "Vârstă peste 18 ani" },
    { key: "cnp",         label: "CNP", sensitive: true },
    { key: "address",     label: "Adresă domiciliu", sensitive: true },
    { key: "expiry_date", label: "Data expirării" },
  ],
  PASAPORT: [
    { key: "given_name",      label: "Prenume" },
    { key: "family_name",     label: "Nume de familie" },
    { key: "birth_date",      label: "Data nașterii" },
    { key: "nationality",     label: "Naționalitate" },
    { key: "document_number", label: "Număr pașaport", sensitive: true },
    { key: "expiry_date",     label: "Data expirării" },
  ],
  PERMIS: [
    { key: "given_name",         label: "Prenume" },
    { key: "family_name",        label: "Nume de familie" },
    { key: "birth_date",         label: "Data nașterii" },
    { key: "license_categories", label: "Categorii permis" },
    { key: "expiry_date",        label: "Data expirării" },
  ],
  CAZIER: [
    { key: "given_name",          label: "Prenume" },
    { key: "family_name",         label: "Nume de familie" },
    { key: "has_criminal_record", label: "Cazier curat (DA/NU)" },
  ],
};

const DEFAULT_ATTRS: Attr[] = [
  { key: "given_name",      label: "Prenume" },
  { key: "family_name",     label: "Nume de familie" },
  { key: "birth_date",      label: "Data nașterii" },
  { key: "document_number", label: "Număr document", sensitive: true },
  { key: "expiry_date",     label: "Data expirării" },
];

const VERIFIER_ROLES: { value: "funcționar" | "any"; label: string }[] = [
  { value: "funcționar", label: "Funcționar public (SPCLEP, primărie)" },
  { value: "any",        label: "Alt verificator (medic, angajator, operator)" },
];

const PURPOSE_SUGGESTIONS = [
  "Verificare vârstă",
  "Verificare identitate angajare",
  "Verificare permis conducere",
  "Verificare identitate medical",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PresentationsPage() {
  const { user } = useAuthStore();
  const { documents, setDocuments, loading, setLoading } = useDocumentStore();
  const { addToast } = useNotificationStore();

  const [selectedDoc, setSelectedDoc]     = useState<Document | null>(null);
  const [disclosedAttrs, setDisclosedAttrs] = useState<string[]>([]);
  const [fetchedAttrs, setFetchedAttrs]   = useState<Attr[] | null>(null);
  const [attrsLoading, setAttrsLoading]   = useState(false);
  const [purpose, setPurpose]             = useState("");
  const [verifierRole, setVerifierRole]   = useState<"funcționar" | "any">("funcționar");
  const [submitting, setSubmitting]       = useState(false);
  const [result, setResult]               = useState<Presentation | null>(null);

  if (!user) return null;
  if (user.role === "funcționar") return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    if (documents.length) return;
    setLoading(true);
    documentsApi.list()
      .then((res) => setDocuments(res.data))
      .catch(() => addToast("Eroare la încărcare documente", "error"))
      .finally(() => setLoading(false));
  }, []);

  const selectDoc = async (doc: Document) => {
    setSelectedDoc(doc);
    setDisclosedAttrs([]);
    setResult(null);
    setFetchedAttrs(null);
    setAttrsLoading(true);
    try {
      const res = await credentialsApi.get(doc.id);
      const available = res.data.attributes_available;
      const catalogAttrs = ATTR_CATALOG[doc.doc_type] ?? DEFAULT_ATTRS;
      const catalogMap = new Map(catalogAttrs.map((a) => [a.key, a]));
      const dynamicAttrs: Attr[] = available.map(
        (key) => catalogMap.get(key) ?? { key, label: key }
      );
      setFetchedAttrs(dynamicAttrs.length > 0 ? dynamicAttrs : null);
    } catch {
      // endpoint not ready — silently fall back to catalog
      setFetchedAttrs(null);
    } finally {
      setAttrsLoading(false);
    }
  };

  const toggleAttr = (key: string) =>
    setDisclosedAttrs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || disclosedAttrs.length === 0) return;
    setSubmitting(true);
    try {
      const res = await presentationsApi.create({
        document_id: selectedDoc.id,
        disclosed_attributes: disclosedAttrs,
        purpose: purpose || "General",
        verifier_role: verifierRole,
      });
      setResult(res.data);
      addToast("Prezentare creată!", "success");
    } catch {
      addToast("Eroare la crearea prezentării", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelectedDoc(null);
    setDisclosedAttrs([]);
    setFetchedAttrs(null);
    setAttrsLoading(false);
    setPurpose("");
    setVerifierRole("funcționar");
    setResult(null);
  };

  const attrs = fetchedAttrs ?? (ATTR_CATALOG[selectedDoc?.doc_type ?? ""] ?? DEFAULT_ATTRS);

  if (result) return <PresentationResult result={result} onReset={reset} />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-slide-up">
      {/* Header banner */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
        <div className="bg-gradient-to-r from-actid-blue to-actid-blue-light p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield size={24} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Prezentare EUDI</h1>
              <p className="text-white/80 text-sm mt-0.5">
                Divulgă selectiv atributele documentului tău
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1 — Document */}
        <section aria-labelledby="step-doc">
          <h2
            id="step-doc"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3"
          >
            1. Alege documentul
          </h2>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}
            </div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nu ai documente înregistrate.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2" role="listbox" aria-label="Documente disponibile">
              {documents.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectDoc(doc)}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue",
                      isSelected
                        ? "border-actid-blue bg-blue-50/60"
                        : "border-border bg-white hover:border-gray-300"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-actid-blue text-white" : "bg-blue-50 text-blue-600"
                    )}>
                      <DocTypeIcon type={doc.doc_type} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {DOC_LABELS[doc.doc_type] || doc.doc_type}
                      </p>
                      {doc.doc_number && (
                        <p className="text-xs text-muted-foreground font-mono">{doc.doc_number}</p>
                      )}
                    </div>
                    <StatusBadge status={doc.status} />
                    {isSelected && (
                      <Check size={16} className="text-actid-blue flex-shrink-0" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2 — Attributes */}
        {selectedDoc && (
          <section aria-labelledby="step-attrs">
            <h2
              id="step-attrs"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3"
            >
              2. Atribute divulgate
            </h2>
            <Card className={!attrsLoading && disclosedAttrs.length === 0 ? "border-amber-200" : ""}>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Selectează doar ce este strict necesar verificatorului.
                </p>
                {attrsLoading ? (
                  <div className="flex flex-wrap gap-2">
                    {[90, 70, 120, 60, 80].map((w) => (
                      <div key={w} className="skeleton h-7 rounded-full" style={{ width: w }} />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Atribute disponibile">
                      {attrs.map((attr) => {
                        const sel = disclosedAttrs.includes(attr.key);
                        return (
                          <button
                            key={attr.key}
                            type="button"
                            aria-pressed={sel}
                            onClick={() => toggleAttr(attr.key)}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue",
                              sel
                                ? attr.sensitive
                                  ? "border-amber-500 bg-amber-50 text-amber-800"
                                  : "border-actid-blue bg-blue-50 text-actid-blue"
                                : attr.sensitive
                                ? "border-amber-200 text-amber-700 hover:border-amber-400"
                                : "border-border text-muted-foreground hover:border-gray-300"
                            )}
                          >
                            {sel
                              ? <Check size={11} aria-hidden="true" />
                              : attr.sensitive
                              ? <AlertTriangle size={11} aria-hidden="true" />
                              : null
                            }
                            {attr.label}
                          </button>
                        );
                      })}
                    </div>
                    {disclosedAttrs.length === 0 && (
                      <p className="text-xs text-amber-700 mt-3">
                        Selectează cel puțin un atribut pentru a continua.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Step 3 — Context */}
        {selectedDoc && (
          <section aria-labelledby="step-context">
            <h2
              id="step-context"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3"
            >
              3. Context
            </h2>
            <Card>
              <CardContent className="py-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="purpose" className="text-sm font-medium">
                    Scop verificare
                  </label>
                  <input
                    id="purpose"
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="ex: Verificare vârstă bar"
                    className="w-full h-11 rounded-xl border border-input bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue transition-all"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PURPOSE_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPurpose(s)}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground hover:bg-gray-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="verifier-role" className="text-sm font-medium">
                    Rol verificator
                  </label>
                  <select
                    id="verifier-role"
                    value={verifierRole}
                    onChange={(e) => setVerifierRole(e.target.value as "funcționar" | "any")}
                    className="w-full h-11 rounded-xl border border-input bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue"
                  >
                    {VERIFIER_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {selectedDoc && (
          <Button
            type="submit"
            loading={submitting}
            disabled={disclosedAttrs.length === 0}
            className="w-full gap-2"
            size="lg"
          >
            <Shield size={18} aria-hidden="true" />
            Generează prezentare EUDI
          </Button>
        )}
      </form>
    </div>
  );
}

// ─── Result screen ────────────────────────────────────────────────────────────

function PresentationResult({
  result,
  onReset,
}: {
  result: Presentation;
  onReset: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-slide-up">
      <Card className="border-green-200 overflow-hidden">
        <div className="bg-green-50 px-5 py-4 border-b border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-green-700" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-green-800">Prezentare generată</p>
              <p className="text-xs text-green-600 font-mono truncate">{result.presentation_id}</p>
            </div>
          </div>
        </div>

        <CardContent className="py-5 space-y-5">
          {/* QR */}
          <div className="flex justify-center">
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
              <QRCodeSVG value={`${window.location.origin}${result.qr_url}`} size={200} level="H" includeMargin={false} />
            </div>
          </div>

          {/* Expiry */}
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Clock size={14} aria-hidden="true" />
            <span>Expiră la {formatDateTime(result.expires_at)}</span>
          </div>

          {/* Disclosed attributes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Atribute divulgate
            </p>
            <div className="flex flex-wrap gap-2">
              {result.disclosed_attributes.map((attr) => (
                <Badge key={attr} variant="info">
                  <Check size={11} aria-hidden="true" /> {attr}
                </Badge>
              ))}
            </div>
          </div>

          <Button variant="secondary" onClick={onReset} className="w-full gap-1.5">
            <RotateCcw size={14} aria-hidden="true" /> Prezentare nouă
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
