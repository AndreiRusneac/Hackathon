import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Link2, Camera, CheckCircle2, Inbox } from "lucide-react";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { documentsApi, sharingApi } from "@/lib/api";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { QRGenerator } from "@/components/sharing/QRGenerator";
import { Card, CardContent, Badge, Button, StatusBadge } from "@/components/ui";
import { formatDateTime, truncateHash } from "@/lib/utils";
import type { ShareToken } from "@/types";

export default function SharingPage() {
  const { documents, setDocuments } = useDocumentStore();
  const { addToast } = useNotificationStore();
  const location = useLocation();
  const preselectId = (location.state as { preselect?: string } | null)?.preselect ?? null;
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanToken, setScanToken] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "active" | "scan">("create");

  useEffect(() => {
    if (preselectId) setActiveTab("create");
  }, [preselectId]);

  useEffect(() => {
    const load = async () => {
      try {
        const [docsRes, tokensRes] = await Promise.all([
          documentsApi.list(),
          sharingApi.listTokens(),
        ]);
        setDocuments(docsRes.data);
        setTokens(tokensRes.data);
      } catch {
        addToast("Eroare la încărcare", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleRevoke = async (id: string) => {
    try {
      await sharingApi.revokeToken(id);
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: false } : t))
      );
      addToast("Token revocat", "success");
    } catch {
      addToast("Eroare la revocare", "error");
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanToken.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await sharingApi.scanToken(scanToken.trim());
      setScanResult(res.data);
      addToast("Token scanat cu succes!", "success");
    } catch (e: any) {
      addToast(e.response?.data?.detail || "Token invalid sau expirat", "error");
    } finally {
      setScanning(false);
    }
  };

  const activeTokens = tokens.filter((t) => t.is_active && new Date(t.expires_at) > new Date());
  const inactiveTokens = tokens.filter((t) => !t.is_active || new Date(t.expires_at) <= new Date());

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Distribuire documente</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Partajează temporar documente prin QR · 24h valabilitate
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl" role="tablist">
        {[
          { key: "create", label: "Creare QR",  Icon: QrCode },
          { key: "active", label: `Active (${activeTokens.length})`, Icon: Link2 },
          { key: "scan",   label: "Scanare",    Icon: Camera },
        ].map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === tab.key
                ? "bg-white shadow-sm text-actid-blue"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.Icon size={14} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create QR */}
      {activeTab === "create" && (
        <QRGenerator
          key={preselectId ?? "default"}
          documents={documents}
          initialSelectedIds={preselectId ? [preselectId] : undefined}
          onTokenCreated={(token) => {
            setTokens((prev) => [token, ...prev]);
            setActiveTab("active");
          }}
        />
      )}

      {/* Active tokens */}
      {activeTab === "active" && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-border p-4">
                  <div className="skeleton h-4 w-40 rounded mb-2" />
                  <div className="skeleton h-3 w-60 rounded" />
                </div>
              ))}
            </div>
          ) : activeTokens.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Inbox size={22} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="font-semibold">Niciun token activ</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Generează un QR pentru a partaja documente
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setActiveTab("create")}
                >
                  Generează QR
                </Button>
              </CardContent>
            </Card>
          ) : (
            activeTokens.map((token) => (
              <TokenCard key={token.id} token={token} onRevoke={handleRevoke} />
            ))
          )}

          {inactiveTokens.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
                Expirate / Revocate
              </p>
              {inactiveTokens.slice(0, 3).map((token) => (
                <TokenCard key={token.id} token={token} onRevoke={handleRevoke} inactive />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scan (funcționar view) */}
      {activeTab === "scan" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-5">
              <h2 className="font-semibold mb-1">Scanare token (funcționar)</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Introdu token-ul primit prin QR pentru a vedea documentele partajate
              </p>
              <form onSubmit={handleScan} className="space-y-3">
                <textarea
                  className="w-full rounded-xl border border-input bg-white px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-actid-blue/30 resize-none"
                  rows={3}
                  placeholder="Paste token-ul QR aici..."
                  value={scanToken}
                  onChange={(e) => setScanToken(e.target.value)}
                  aria-label="Token QR"
                />
                <Button type="submit" loading={scanning} className="w-full gap-1.5">
                  <Camera size={16} aria-hidden="true" /> Verifică documente
                </Button>
              </form>
            </CardContent>
          </Card>

          {scanResult && (
            <Card className="border-green-200">
              <div className="bg-green-50 px-4 py-3 rounded-t-2xl border-b border-green-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-green-700 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-green-800">Token valid</p>
                    <p className="text-xs text-green-600">
                      {scanResult.owner?.full_name} · CNP: {scanResult.owner?.cnp?.replace(/\d(?=\d{4})/g, "*")}
                    </p>
                  </div>
                </div>
              </div>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="info">{scanResult.context || "General"}</Badge>
                  {scanResult.permissions?.map((p: string) => (
                    <Badge key={p} variant="outline">{p}</Badge>
                  ))}
                </div>
                {scanResult.documents?.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
                      <DocTypeIcon type={doc.doc_type} size={16} className="text-actid-blue" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
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
                    <StatusBadge status={doc.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function TokenCard({
  token,
  onRevoke,
  inactive = false,
}: {
  token: ShareToken;
  onRevoke: (id: string) => void;
  inactive?: boolean;
}) {
  const [showQR, setShowQR] = useState(false);
  const isExpired = new Date(token.expires_at) < new Date();
  const qrValue = `${window.location.origin}/scan/${token.token}`;

  return (
    <Card className={`mb-3 ${inactive ? "opacity-60" : ""}`}>
      <CardContent className="py-4">
        <button
          className="w-full flex items-start gap-3 text-left"
          onClick={() => !inactive && setShowQR((v) => !v)}
          aria-expanded={showQR}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${inactive ? "bg-gray-100" : "bg-purple-50"}`}>
            <QrCode size={18} className={inactive ? "text-gray-400" : "text-purple-600"} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{token.context || "Partajare generală"}</p>
              <Badge variant={isExpired ? "danger" : !token.is_active ? "warning" : "success"}>
                {isExpired ? "Expirat" : !token.is_active ? "Revocat" : "Activ"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {token.document_ids.length} documente · Expiră {formatDateTime(token.expires_at)}
            </p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
              {truncateHash(token.token, 12)}
            </p>
          </div>
          {!inactive && (
            <span className="text-xs text-muted-foreground flex-shrink-0 pt-0.5">
              {showQR ? "▲" : "▼"}
            </span>
          )}
        </button>

        {showQR && !inactive && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
              <QRCodeSVG value={qrValue} size={200} level="H" includeMargin={false} />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRevoke(token.id)}
              className="text-red-500 hover:text-red-700 w-full"
            >
              Revocă token
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
