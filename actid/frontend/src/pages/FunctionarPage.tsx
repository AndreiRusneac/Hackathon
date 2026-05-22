import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Camera, ClipboardCheck, CheckCircle2, ScanLine } from "lucide-react";
import { sharingApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Button } from "@/components/ui";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { DOC_LABELS, formatDateTime } from "@/lib/utils";

interface ScanResult {
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

export default function FunctionarPage() {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const [scanToken, setScanToken] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState<ScanResult[]>([]);

  if (!user) return null;
  if (user.role !== "funcționar") {
    return <Navigate to="/dashboard" replace />;
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = scanToken.trim();
    if (!token) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await sharingApi.scanToken(token);
      const result: ScanResult = { ...res.data, scanned_at: new Date().toISOString() };
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
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-slide-up">
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

      {scanResult ? (
        <ScanResultCard result={scanResult} onReset={resetScan} />
      ) : (
        <Card>
          <CardContent className="py-5 space-y-4">
            <div>
              <h2 className="font-semibold text-base">Verificare document cetățean</h2>
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
    </div>
  );
}

function ScanResultCard({ result, onReset }: { result: ScanResult; onReset: () => void }) {
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

        <Button variant="secondary" onClick={onReset} className="w-full">
          ← Scanare nouă
        </Button>
      </CardContent>
    </Card>
  );
}
