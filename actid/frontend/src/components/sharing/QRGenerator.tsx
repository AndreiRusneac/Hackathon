import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Search, X } from "lucide-react";
import { sharingApi } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { formatDateTime, DOC_LABELS } from "@/lib/utils";
import type { Document, ShareToken } from "@/types";

interface QRGeneratorProps {
  documents: Document[];
  onTokenCreated?: (token: ShareToken) => void;
  initialSelectedIds?: string[];
}

const CONTEXTS = [
  "Control frontieră",
  "Angajator",
  "Notar",
  "Bancă",
  "Primărie",
  "Spital",
  "Alt serviciu public",
];

export function QRGenerator({ documents, onTokenCreated, initialSelectedIds }: QRGeneratorProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>(initialSelectedIds ?? []);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [context, setContext] = useState(CONTEXTS[0]);
  const [expires, setExpires] = useState(24);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<ShareToken | null>(null);
  const { addToast } = useNotificationStore();

  const toggleDoc = (id: string) => {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const generate = async () => {
    if (!selectedDocs.length) {
      addToast("Selectează cel puțin un document", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await sharingApi.createToken({
        document_ids: selectedDocs,
        permissions: ["read"],
        context,
        recipient_role: "funcționar",
        expires_hours: expires,
      });
      setToken(res.data);
      onTokenCreated?.(res.data);
      addToast("Token QR creat cu succes!", "success");
    } catch (e: any) {
      addToast(e.response?.data?.detail || "Eroare la creare token", "error");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setToken(null);
    setSelectedDocs([]);
  };

  if (token) {
    const qrValue = `${window.location.origin}/scan/${token.token}`;
    const isExpired = new Date(token.expires_at) < new Date();

    return (
      <Card className="overflow-hidden">
        <div className="bg-actid-blue p-4 text-white text-center">
          <p className="font-bold text-lg">Token QR Generat</p>
          <p className="text-sm text-white/70 mt-0.5">{context}</p>
        </div>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          {/* QR Code */}
          <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
            <QRCodeSVG
              value={qrValue}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* Token details */}
          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Context:</span>
              <Badge variant="info">{context}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expiră:</span>
              <span className="font-medium">{formatDateTime(token.expires_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Utilizări:</span>
              <span className="font-medium">{token.use_count} / {token.max_uses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={isExpired ? "danger" : token.is_active ? "success" : "warning"}>
                {isExpired ? "Expirat" : token.is_active ? "Activ" : "Inactiv"}
              </Badge>
            </div>
          </div>

          {/* Token string (for demo) */}
          <div className="w-full bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
            <p className="text-xs text-muted-foreground mb-1">Token (demo scan):</p>
            <p className="font-mono text-xs break-all text-actid-blue">{token.token}</p>
          </div>

          <Button variant="secondary" onClick={reset} className="w-full">
            ← Generează alt token
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div>
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">1. Selectează documentele</p>
            <button
              type="button"
              onClick={() => { setShowAll((v) => !v); setSearch(""); }}
              className="text-xs text-actid-blue font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
            >
              {showAll ? "Restrânge" : "Vizualizează toate"}
            </button>
          </div>

          {/* Expanded panel — search + full scrollable list */}
          {showAll && (
            <div className="mb-3 rounded-2xl border border-actid-blue/20 bg-blue-50/30 p-3 space-y-2 animate-fade-in">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Caută document..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-8 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue transition-all placeholder:text-muted-foreground"
                  aria-label="Caută document"
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Șterge căutare"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin pr-0.5">
                {documents
                  .filter((doc) => {
                    if (!search) return true;
                    const q = search.toLowerCase();
                    return (
                      (DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type).toLowerCase().includes(q) ||
                      doc.doc_number?.toLowerCase().includes(q) ||
                      doc.issued_by?.toLowerCase().includes(q)
                    );
                  })
                  .map((doc) => {
                    const selected = selectedDocs.includes(doc.id);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => toggleDoc(doc.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all ${
                          selected ? "border-actid-blue bg-white" : "border-transparent bg-white hover:border-gray-200"
                        }`}
                        aria-pressed={selected}
                      >
                        <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                          <DocTypeIcon type={doc.doc_type} size={14} className="text-actid-blue" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type}
                          </p>
                          {doc.doc_number && (
                            <p className="text-[10px] text-muted-foreground font-mono">{doc.doc_number}</p>
                          )}
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                            selected ? "bg-actid-blue border-actid-blue" : "border-gray-300"
                          }`}
                          aria-hidden="true"
                        >
                          {selected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                {search && documents.filter((doc) => {
                  const q = search.toLowerCase();
                  return (
                    (DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type).toLowerCase().includes(q) ||
                    doc.doc_number?.toLowerCase().includes(q) ||
                    doc.issued_by?.toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Niciun rezultat pentru &ldquo;{search}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Default compact list */}
          <div className="space-y-2">
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nu ai documente disponibile
              </p>
            )}
            {documents.slice(0, 3).map((doc) => {
              const selected = selectedDocs.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggleDoc(doc.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    selected ? "border-actid-blue bg-blue-50" : "border-border hover:border-gray-300"
                  }`}
                  aria-pressed={selected}
                >
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                    <DocTypeIcon type={doc.doc_type} size={16} className="text-actid-blue" />
                  </div>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                      selected ? "bg-actid-blue border-actid-blue" : "border-gray-300"
                    }`}
                    aria-hidden="true"
                  >
                    {selected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type}
                    </p>
                    {doc.doc_number && (
                      <p className="text-xs text-muted-foreground font-mono">{doc.doc_number}</p>
                    )}
                  </div>
                  <Badge
                    variant={doc.status === "valid" ? "success" : doc.status === "expirat" ? "danger" : "warning"}
                    className="flex-shrink-0"
                  >
                    {doc.status === "valid" ? "Valabil" : doc.status === "expirat" ? "Expirat" : "Expiră curând"}
                  </Badge>
                </button>
              );
            })}
            {documents.length > 3 && !showAll && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full mt-1 py-2 text-xs text-actid-blue font-medium hover:bg-blue-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
              >
                + {documents.length - 3} alte documente — Vizualizează toate
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">2. Context partajare</p>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className="w-full h-11 rounded-xl border border-input bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30"
            aria-label="Context partajare"
          >
            {CONTEXTS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">3. Durata validitate</p>
          <div className="flex gap-2">
            {[1, 6, 24, 72].map((h) => (
              <button
                key={h}
                onClick={() => setExpires(h)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  expires === h
                    ? "bg-actid-blue text-white border-actid-blue"
                    : "border-border text-foreground hover:border-gray-300"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={generate}
          loading={loading}
          disabled={selectedDocs.length === 0}
          className="w-full gap-1.5"
          size="lg"
        >
          <QrCode size={18} aria-hidden="true" /> Generează QR
        </Button>
      </CardContent>
    </Card>
  );
}
