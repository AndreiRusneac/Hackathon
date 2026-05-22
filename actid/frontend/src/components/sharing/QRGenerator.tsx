import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { sharingApi } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import type { Document, ShareToken } from "@/types";

interface QRGeneratorProps {
  documents: Document[];
  onTokenCreated?: (token: ShareToken) => void;
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

export function QRGenerator({ documents, onTokenCreated }: QRGeneratorProps) {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
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
              imageSettings={{
                src: "",
                x: undefined,
                y: undefined,
                height: 0,
                width: 0,
                excavate: false,
              }}
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
          <p className="text-sm font-semibold mb-3">1. Selectează documentele</p>
          <div className="space-y-2">
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nu ai documente disponibile
              </p>
            )}
            {documents.map((doc) => {
              const selected = selectedDocs.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  onClick={() => toggleDoc(doc.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    selected
                      ? "border-actid-blue bg-blue-50"
                      : "border-border hover:border-gray-300"
                  }`}
                  aria-pressed={selected}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 transition-all ${
                      selected ? "bg-actid-blue border-actid-blue" : "border-gray-300"
                    }`}
                  >
                    {selected && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.doc_type === "CI"
                        ? "Carte de Identitate"
                        : doc.doc_type === "PASAPORT"
                        ? "Pașaport"
                        : doc.doc_type}
                    </p>
                    {doc.doc_number && (
                      <p className="text-xs text-muted-foreground font-mono">{doc.doc_number}</p>
                    )}
                  </div>
                  <Badge
                    variant={
                      doc.status === "valid"
                        ? "success"
                        : doc.status === "expirat"
                        ? "danger"
                        : "warning"
                    }
                    className="flex-shrink-0"
                  >
                    {doc.status === "valid" ? "Valid" : doc.status === "expirat" ? "Expirat" : `${doc.days_remaining}z`}
                  </Badge>
                </button>
              );
            })}
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
          className="w-full"
          size="lg"
        >
          📱 Generează QR
        </Button>
      </CardContent>
    </Card>
  );
}
