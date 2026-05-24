import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Camera, ClipboardCheck, CheckCircle2, ScanLine, ArrowLeft,
  Shield, ShieldCheck, ShieldX, QrCode, Building2,
  type LucideIcon,
} from "lucide-react";
import { sharingApi, presentationsApi } from "@/lib/api";
import type { PresentationVerifyResult } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { DOC_LABELS, formatDateTime, cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ATTR_LABELS: Record<string, string> = {
  given_name:        "Prenume",
  family_name:       "Nume de familie",
  birth_date:        "Data nașterii",
  cnp:               "CNP",
  document_number:   "Număr document",
  issue_date:        "Data emiterii",
  expiry_date:       "Data expirării",
  over_18:           "Peste 18 ani",
  over_65:           "Peste 65 ani",
  age_over_18:       "Vârstă peste 18 ani",
  nationality:       "Naționalitate",
  categories:        "Categorii permis",
  license_categories:"Categorii permis",
  address:           "Adresă domiciliu",
  has_criminal_record:"Cazier curat",
};

const CREDENTIAL_TYPE_LABEL: Record<string, string> = {
  RomanianID:         "Carte de Identitate Română",
  Passport:           "Pașaport",
  DriverLicense:      "Permis de Conducere",
  GenericAttestation: "Atestat Generic",
};

function extractPresentationId(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/verify\/([^/?#\s]+)/);
  return match ? match[1] : trimmed;
}

// ─── Old-token scan result ────────────────────────────────────────────────────

interface OldScanResult {
  owner: { full_name: string; cnp: string };
  context: string;
  permissions: string[];
  documents: Array<{
    id: string;
    doc_type: string;
    doc_number?: string;
    issued_by?: string;
    expires_date?: string;
    is_verified: boolean;
    status: string;
  }>;
  scanned_at: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FunctionarPage() {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"eudi" | "token">("eudi");

  // EUDI presentation state
  const [eudiInput, setEudiInput]         = useState("");
  const [eudiScanning, setEudiScanning]   = useState(false);
  const [eudiResult, setEudiResult]       = useState<PresentationVerifyResult | null>(null);

  // Old token state
  const [scanToken, setScanToken]         = useState("");
  const [scanning, setScanning]           = useState(false);
  const [scanResult, setScanResult]       = useState<OldScanResult | null>(null);
  const [history, setHistory]             = useState<OldScanResult[]>([]);
  // Ensures auto-scan fires only once per pid even under StrictMode double-mount.
  // Radu's /scan endpoint marks presentations as used on first call; a second
  // call returns 410 and would surface as a fake "already used" toast.
  const autoScannedRef = useRef<string | null>(null);

  // Auto-scan when arriving from a /verify/:id QR link — must be before early returns
  useEffect(() => {
    const pid = searchParams.get("pid");
    if (!pid || !user || user.role !== "funcționar") return;
    if (autoScannedRef.current === pid) return;
    autoScannedRef.current = pid;
    setEudiScanning(true);
    presentationsApi.scan(pid)
      .then((res) => { setEudiResult(res.data); addToast("Prezentare verificată!", "success"); })
      .catch((err: { response?: { status?: number; data?: { detail?: string } } }) => {
        const status = err.response?.status;
        addToast(
          status === 410 ? "Prezentare expirată sau deja utilizată."
            : status === 422 ? "Semnătură SD-JWT invalidă."
            : err.response?.data?.detail || "Prezentare invalidă.",
          "error"
        );
      })
      .finally(() => setEudiScanning(false));
  }, [user, searchParams]);

  if (!user) return null;
  if (user.role !== "funcționar") return <Navigate to="/dashboard" replace />;

  // ── EUDI scan ──────────────────────────────────────────────────────────────

  const handleEudiScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractPresentationId(eudiInput);
    if (!id) return;
    setEudiScanning(true);
    setEudiResult(null);
    try {
      const res = await presentationsApi.scan(id);
      setEudiResult(res.data);
      setEudiInput("");
      addToast("Prezentare verificată cu succes!", "success");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string }; status?: number } };
      const status = err.response?.status;
      if (status === 410) {
        addToast("Prezentare expirată sau deja utilizată.", "error");
      } else if (status === 422) {
        addToast("Semnătură SD-JWT invalidă. Prezentarea nu poate fi verificată.", "error");
      } else {
        addToast(err.response?.data?.detail || "Prezentare invalidă sau necunoscută.", "error");
      }
    } finally {
      setEudiScanning(false);
    }
  };

  const resetEudi = () => {
    setEudiResult(null);
    setEudiInput("");
  };

  // ── Old token scan ─────────────────────────────────────────────────────────

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = scanToken.trim();
    if (!token) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await sharingApi.scanToken(token);
      const result: OldScanResult = { ...res.data, scanned_at: new Date().toISOString() };
      setScanResult(result);
      setHistory((prev) => [result, ...prev].slice(0, 5));
      setScanToken("");
      addToast("Document verificat cu succes!", "success");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Token invalid sau expirat", "error");
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => {
    setScanResult(null);
    setScanToken("");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
        <div className="bg-gradient-to-r from-actid-blue to-actid-blue-light p-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <ScanLine size={24} className="text-white" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">Portal Funcționar</h1>
                <span className="bg-white/25 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  SPCLEP
                </span>
              </div>
              <p className="text-white/80 text-sm mt-0.5 truncate">
                {user.full_name} · {user.city}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "eudi"}
          onClick={() => { setActiveTab("eudi"); setEudiResult(null); setScanResult(null); }}
          className={cn(
            "flex-1 py-2 px-2 sm:px-3 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5",
            activeTab === "eudi"
              ? "bg-white shadow-sm text-actid-blue"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Shield size={14} aria-hidden="true" /> Prezentare EUDI
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "token"}
          onClick={() => { setActiveTab("token"); setEudiResult(null); setScanResult(null); }}
          className={cn(
            "flex-1 py-2 px-2 sm:px-3 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 sm:gap-1.5",
            activeTab === "token"
              ? "bg-white shadow-sm text-actid-blue"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <QrCode size={14} aria-hidden="true" /> Token QR
        </button>
      </div>

      {/* ── EUDI tab ─────────────────────────────────────────────────────── */}
      {activeTab === "eudi" && (
        <>
          {eudiResult ? (
            <EudiVerifyResult result={eudiResult} onReset={resetEudi} />
          ) : (
            <Card>
              <CardContent className="py-5 space-y-4">
                <div>
                  <h2 className="font-semibold text-base">Verificare prezentare EUDI</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Cetățeanul prezintă codul QR generat din portofelul digital.
                  </p>
                </div>

                <div
                  className="border-2 border-dashed border-actid-blue/30 rounded-2xl p-8 text-center bg-blue-50/40"
                  aria-label="Zonă scanare cameră"
                >
                  <div className="w-16 h-16 bg-actid-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Camera size={28} className="text-actid-blue" aria-hidden="true" />
                  </div>
                  <p className="font-semibold text-sm text-actid-blue">Scanare cameră</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Funcție disponibilă în aplicația mobilă nativă
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">sau introdu manual</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleEudiScan} className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="eudi-input" className="text-sm font-medium">
                      URL prezentare sau ID
                    </label>
                    <textarea
                      id="eudi-input"
                      className="w-full rounded-xl border border-input bg-white px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue resize-none transition-all"
                      rows={3}
                      placeholder="https://actid.example/verify/pres_abc123 sau pres_abc123"
                      value={eudiInput}
                      onChange={(e) => setEudiInput(e.target.value)}
                      aria-label="URL sau ID prezentare EUDI"
                    />
                    <p className="text-xs text-muted-foreground">
                      Acceptă URL-ul complet din QR sau doar ID-ul prezentării.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    loading={eudiScanning}
                    disabled={!eudiInput.trim()}
                    className="w-full gap-1.5"
                    size="lg"
                  >
                    <ShieldCheck size={18} aria-hidden="true" /> Verifică prezentarea EUDI
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Token QR tab (existing flow) ─────────────────────────────────── */}
      {activeTab === "token" && (
        <>
          {scanResult ? (
            <OldScanResultCard result={scanResult} onReset={resetScan} />
          ) : (
            <Card>
              <CardContent className="py-5 space-y-4">
                <div>
                  <h2 className="font-semibold text-base">Verificare token QR</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Cetățeanul prezintă codul QR de pe telefon.
                  </p>
                </div>

                <div
                  className="border-2 border-dashed border-actid-blue/30 rounded-2xl p-8 text-center bg-blue-50/40"
                  aria-label="Zonă scanare cameră"
                >
                  <div className="w-16 h-16 bg-actid-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Camera size={28} className="text-actid-blue" aria-hidden="true" />
                  </div>
                  <p className="font-semibold text-sm text-actid-blue">Scanare cameră</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Funcție disponibilă în aplicația mobilă nativă
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">sau introdu manual</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <form onSubmit={handleScan} className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="scan-token" className="text-sm font-medium">
                      Cod token QR
                    </label>
                    <textarea
                      id="scan-token"
                      className="w-full rounded-xl border border-input bg-white px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue resize-none transition-all"
                      rows={3}
                      placeholder="Lipsește codul token din QR..."
                      value={scanToken}
                      onChange={(e) => setScanToken(e.target.value)}
                      aria-label="Token QR de la cetățean"
                    />
                  </div>
                  <Button
                    type="submit"
                    loading={scanning}
                    disabled={!scanToken.trim()}
                    className="w-full gap-1.5"
                    size="lg"
                  >
                    <ClipboardCheck size={18} aria-hidden="true" /> Verifică documentele
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Recent scans history */}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Verificări recente
              </p>
              <div className="space-y-2">
                {history.map((entry) => (
                  <Card key={`${entry.owner.cnp}-${entry.scanned_at}`}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 size={18} className="text-green-600" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{entry.owner.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.context} · {entry.documents.length}{" "}
                            {entry.documents.length === 1 ? "document" : "documente"}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDateTime(entry.scanned_at)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── EUDI verification result ─────────────────────────────────────────────────

function EudiVerifyResult({
  result,
  onReset,
}: {
  result: PresentationVerifyResult;
  onReset: () => void;
}) {
  const credLabel = CREDENTIAL_TYPE_LABEL[result.credential_type] || result.credential_type;

  if (!result.valid) {
    return (
      <Card className="border-red-200 overflow-hidden">
        <div className="bg-red-50 px-5 py-4 border-b border-red-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldX size={20} className="text-red-700" aria-hidden="true" />
            </div>
            <p className="font-bold text-red-800">Prezentare invalidă</p>
          </div>
        </div>
        <CardContent className="py-4">
          <Button variant="secondary" onClick={onReset} className="w-full gap-1.5">
            <ArrowLeft size={14} aria-hidden="true" /> Scanare nouă
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Success header */}
      <Card className="border-green-200 overflow-hidden">
        <div className="bg-green-50 px-5 py-4 border-b border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-green-700" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-green-800">Prezentare EUDI verificată</p>
              <p className="text-xs text-green-600 mt-0.5">
                {credLabel} · {formatDateTime(result.verified_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Issuer trust block */}
        <div className="px-5 py-4 border-b border-border bg-blue-50/40">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-actid-blue/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-actid-blue" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm text-foreground">{result.issuer.name}</p>
                {result.issuer.trusted && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={10} aria-hidden="true" /> Emitent de încredere
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.issuer.country} · {result.issuer.id}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="py-4 space-y-4">
          {/* Purpose — citizen may have skipped this when creating the presentation */}
          {result.purpose && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Scop:</span>
              <Badge variant="info">{result.purpose}</Badge>
            </div>
          )}

          {/* Disclosed attributes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Atribute divulgate
            </p>
            <div className="space-y-2">
              {Object.entries(result.disclosed_attributes).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50 rounded-xl"
                >
                  <span className="text-xs text-muted-foreground">
                    {ATTR_LABELS[key] || key}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {typeof value === "boolean" ? (value ? "Da" : "Nu") : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button variant="secondary" onClick={onReset} className="w-full gap-1.5">
            <ArrowLeft size={14} aria-hidden="true" /> Scanare nouă
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Old token scan result ────────────────────────────────────────────────────

function OldScanResultCard({
  result,
  onReset,
}: {
  result: OldScanResult;
  onReset: () => void;
}) {
  const maskedCnp = result.owner.cnp.replace(/\d(?=\d{4})/g, "*");

  return (
    <Card className="border-green-200 overflow-hidden">
      <div className="bg-green-50 px-4 py-4 border-b border-green-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-green-700" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-green-800">Token valid · Document verificat</p>
            <p className="text-sm text-green-700 mt-0.5">
              {result.owner.full_name} · CNP: {maskedCnp}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="py-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="info">{result.context}</Badge>
          {result.permissions.map((p) => (
            <Badge key={p} variant="outline" className="capitalize">
              {p === "read" ? "Vizualizare" : p === "request_renewal" ? "Reînnoire" : p}
            </Badge>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Documente partajate
          </p>
          {result.documents.map((doc) => {
            const label = DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type;
            const statusVariant =
              doc.status === "valid" ? "success" : doc.status === "expirat" ? "danger" : "warning";
            const statusLabel =
              doc.status === "valid" ? "Valabil" : doc.status === "expirat" ? "Expirat" : "Expiră curând";
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border border-border">
                  <DocTypeIcon type={doc.doc_type} size={18} className="text-actid-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{label}</p>
                  {doc.doc_number && (
                    <p className="text-xs text-muted-foreground font-mono">{doc.doc_number}</p>
                  )}
                  {doc.issued_by && (
                    <p className="text-xs text-muted-foreground">{doc.issued_by}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant={statusVariant}>{statusLabel}</Badge>
                  {doc.is_verified && (
                    <span className="text-[10px] text-green-600 font-medium">Verificat digital</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button variant="secondary" onClick={onReset} className="w-full gap-1.5">
          <ArrowLeft size={14} aria-hidden="true" /> Scanare nouă
        </Button>
      </CardContent>
    </Card>
  );
}
