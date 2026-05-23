import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Search, X, ChevronDown, Check, FolderOpen, Minus } from "lucide-react";
import { sharingApi } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { DocTypeIcon, CATEGORY_META } from "@/components/documents/DocumentCard";
import { formatDateTime, DOC_LABELS, groupDocsIntoFolders, cn } from "@/lib/utils";
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
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
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

  const setFolderSelected = (docs: Document[], select: boolean) => {
    const ids = docs.map((d) => d.id);
    setSelectedDocs((prev) =>
      select
        ? Array.from(new Set([...prev, ...ids]))
        : prev.filter((id) => !ids.includes(id))
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

  const folders = groupDocsIntoFolders(documents);
  const q = search.trim().toLowerCase();
  const searchResults = q
    ? documents.filter(
        (d) =>
          (DOC_LABELS[d.doc_type] || d.doc_type).toLowerCase().includes(q) ||
          d.doc_number?.toLowerCase().includes(q) ||
          d.issued_by?.toLowerCase().includes(q)
      )
    : [];

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
          <p className="text-sm font-semibold mb-3">1. Selectează documentele</p>

          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nu ai documente disponibile
            </p>
          ) : (
            <div className="space-y-3">
              {/* Selection summary — persists across search, recent and folders */}
              {selectedDocs.length > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-blue-50 border border-actid-blue/20 px-3 py-2">
                  <span className="text-xs font-semibold text-actid-blue">
                    {selectedDocs.length} {selectedDocs.length === 1 ? "document selectat" : "documente selectate"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDocs([])}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Golește
                  </button>
                </div>
              )}

              {/* Search — fastest path when you know the document */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Caută document..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-9 rounded-xl border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30 focus:border-actid-blue transition-all placeholder:text-muted-foreground"
                  aria-label="Caută document"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    /* ACCESSIBILITY: larger hit area + focus ring for the clear button */
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-9 min-w-9 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
                    aria-label="Șterge căutarea"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              {search ? (
                <div className="space-y-1.5">
                  {searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Niciun rezultat pentru &ldquo;{search}&rdquo;
                    </p>
                  ) : (
                    searchResults.map((doc) => (
                      <DocPickItem key={doc.id} doc={doc} selected={selectedDocs.includes(doc.id)} onToggle={() => toggleDoc(doc.id)} />
                    ))
                  )}
                </div>
              ) : (
                <>
                  {/* Folders — browse by category */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FolderOpen size={12} className="text-muted-foreground" aria-hidden="true" />
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Foldere</p>
                    </div>
                    <div className="space-y-1.5">
                      {folders.map((f) => {
                        const meta = CATEGORY_META[f.key] ?? CATEGORY_META.altele;
                        const Icon = meta.Icon;
                        const open = expandedFolder === f.key;
                        const selectedCount = f.docs.filter((d) => selectedDocs.includes(d.id)).length;
                        const allSelected = selectedCount === f.docs.length;
                        const someSelected = selectedCount > 0 && !allSelected;
                        return (
                          <div key={f.key} className="rounded-xl border border-border overflow-hidden">
                            <div className="flex items-center gap-2 p-2.5 bg-white">
                              {/* Select the whole folder (tri-state: all / some / none) */}
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !allSelected;
                                  setFolderSelected(f.docs, next);
                                  if (next) setExpandedFolder(f.key);
                                }}
                                aria-pressed={allSelected}
                                aria-label={`${allSelected ? "Deselectează" : "Selectează"} tot din ${f.label}, ${f.docs.length} documente`}
                                /* ACCESSIBILITY: 44x44 touch target around the small checkbox (WCAG 2.5.5) */
                                className="flex-shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
                              >
                                <span
                                  className={cn(
                                    "w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all",
                                    allSelected || someSelected ? "bg-actid-blue border-actid-blue" : "border-gray-300"
                                  )}
                                  aria-hidden="true"
                                >
                                  {allSelected ? (
                                    <Check size={13} className="text-white" strokeWidth={3} />
                                  ) : someSelected ? (
                                    <Minus size={13} className="text-white" strokeWidth={3} />
                                  ) : null}
                                </span>
                              </button>

                              {/* Tap to expand / collapse and pick individual documents */}
                              <button
                                type="button"
                                onClick={() => setExpandedFolder(open ? null : f.key)}
                                aria-expanded={open}
                                aria-label={`${f.label}, ${f.docs.length} documente`}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
                              >
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", meta.tile)}>
                                  <Icon size={16} aria-hidden="true" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{f.label}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {f.docs.length} {f.docs.length === 1 ? "document" : "documente"}
                                  </p>
                                </div>
                                {selectedCount > 0 && (
                                  <span className="text-[10px] font-bold text-white bg-actid-blue rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                                    {selectedCount}
                                  </span>
                                )}
                                <ChevronDown size={16} className={cn("text-muted-foreground transition-transform flex-shrink-0", open && "rotate-180")} aria-hidden="true" />
                              </button>
                            </div>
                            {open && (
                              <div className="p-1.5 pt-0 space-y-1.5 bg-gray-50/40">
                                {f.docs.map((doc) => (
                                  <DocPickItem key={doc.id} doc={doc} selected={selectedDocs.includes(doc.id)} onToggle={() => toggleDoc(doc.id)} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
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

function DocPickItem({
  doc,
  selected,
  onToggle,
}: {
  doc: Document;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      // ACCESSIBILITY: announce name + selection state, e.g. "Pașaport, Selectat" (WCAG 4.1.2)
      aria-label={`${DOC_LABELS[doc.doc_type] || doc.doc_type}, ${selected ? "Selectat" : "Neselectat"}`}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all",
        // ACCESSIBILITY: visible keyboard focus indicator (WCAG 2.4.7)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue",
        selected ? "border-actid-blue bg-blue-50" : "border-border bg-white hover:border-gray-300"
      )}
    >
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0 border border-border">
        <DocTypeIcon type={doc.doc_type} size={16} className="text-actid-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{DOC_LABELS[doc.doc_type] || doc.doc_type}</p>
        {doc.doc_number && (
          <p className="text-[10px] text-muted-foreground font-mono">{doc.doc_number}</p>
        )}
      </div>
      <span
        className={cn(
          "w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-all",
          selected ? "bg-actid-blue border-actid-blue" : "border-gray-300"
        )}
        aria-hidden="true"
      >
        {selected && <Check size={13} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
