import { useEffect, useState } from "react";
import {
  Files, ShieldCheck, Clock, ShieldAlert, Plus, X, FileText,
  ChevronRight, ChevronLeft, Building2, RotateCcw, Check,
  type LucideIcon,
} from "lucide-react";
import { documentsApi, type DocumentCatalogItem } from "@/lib/api";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { DocumentCard, DocumentCardSkeleton, CATEGORY_META, DocTypeIcon } from "@/components/documents/DocumentCard";
import { Button, Card, CardContent, Input } from "@/components/ui";
import type { Document } from "@/types";
import { DOC_LABELS, DOC_CATEGORIES, groupDocsIntoFolders, cn, formatDate } from "@/lib/utils";

type Filter = "all" | "valid" | "expiră_curând" | "expirat";

const FILTERS: { key: Filter; label: string; Icon: LucideIcon }[] = [
  { key: "all",           label: "Toate",         Icon: Files },
  { key: "valid",         label: "Valide",         Icon: ShieldCheck },
  { key: "expiră_curând", label: "Expiră curând",  Icon: Clock },
  { key: "expirat",       label: "Expirate",       Icon: ShieldAlert },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.key, c.label])
);

export default function DocumentsPage() {
  const { documents, setDocuments, loading, setLoading, removeDocument } = useDocumentStore();
  const { generateFromDocuments, addToast } = useNotificationStore();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState<Document | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  // Catalog modal state
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalog, setCatalog] = useState<DocumentCatalogItem[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [requestingType, setRequestingType] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list();
      setDocuments(res.data);
      generateFromDocuments(res.data);
    } catch {
      addToast("Eroare la încărcarea documentelor", "error");
    } finally {
      setLoading(false);
    }
  };

  const openCatalog = async () => {
    setCatalogOpen(true);
    setCatalogLoading(true);
    try {
      const res = await documentsApi.catalog();
      setCatalog(res.data);
    } catch {
      addToast("Eroare la încărcarea catalogului", "error");
      setCatalogOpen(false);
    } finally {
      setCatalogLoading(false);
    }
  };

  const closeCatalog = () => {
    setCatalogOpen(false);
    setCatalog(null);
    setRequestingType(null);
  };

  const handleRequest = async (item: DocumentCatalogItem) => {
    if (item.state === "owned") return;
    setRequestingType(item.doc_type);
    try {
      await documentsApi.request(item.doc_type);
      await load();
      // Refresh catalog so the button updates
      const res = await documentsApi.catalog();
      setCatalog(res.data);
      addToast(
        item.state === "expired"
          ? `${item.label} reînnoit cu succes!`
          : `${item.label} a fost emis în portofelul tău!`,
        "success"
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Eroare la emitere", "error");
    } finally {
      setRequestingType(null);
    }
  };

  const handleDelete = (doc: Document) => setDeletePending(doc);

  const handleDeleteConfirm = async () => {
    if (!deletePending) return;
    const doc = deletePending;
    setDeletePending(null);
    try {
      await documentsApi.delete(doc.id);
      removeDocument(doc.id);
      addToast("Document șters", "info");
    } catch {
      addToast("Ștergerea a eșuat. Documentul nu a fost șters, încearcă din nou.", "error");
    }
  };

  // Filtered + searched docs
  const byStatus = documents.filter((d) => filter === "all" || d.status === filter);
  const searchResults = byStatus.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.doc_type.toLowerCase().includes(q) ||
      DOC_LABELS[d.doc_type]?.toLowerCase().includes(q) ||
      d.doc_number?.toLowerCase().includes(q) ||
      d.issued_by?.toLowerCase().includes(q)
    );
  });
  const folders = groupDocsIntoFolders(byStatus);
  const activeFolder = openFolder ? folders.find((f) => f.key === openFolder) ?? null : null;

  // Group catalog items by category for the modal
  const catalogByCategory: Record<string, DocumentCatalogItem[]> = {};
  if (catalog) {
    for (const item of catalog) {
      (catalogByCategory[item.category] ??= []).push(item);
    }
  }

  return (
    <>
      {/* ── Catalog modal ─────────────────────────────────────────────────── */}
      {catalogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={closeCatalog}
        >
          <div
            className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-actid-blue to-actid-blue-light p-5 text-white flex-shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-lg">Solicită document oficial</h2>
                    <p className="text-white/80 text-xs mt-0.5">
                      Emis instant de instituția emitentă
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeCatalog}
                  className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0"
                  aria-label="Închide"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {catalogLoading || !catalog ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-border p-4">
                      <div className="flex gap-3">
                        <div className="w-11 h-11 skeleton rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <div className="skeleton h-4 w-40 rounded" />
                          <div className="skeleton h-3 w-56 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                DOC_CATEGORIES.map((cat) => {
                  const items = catalogByCategory[cat.key];
                  if (!items || items.length === 0) return null;
                  const meta = CATEGORY_META[cat.key] ?? CATEGORY_META.altele;
                  const Icon = meta.Icon;
                  return (
                    <section key={cat.key}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", meta.tile)}>
                          <Icon size={14} aria-hidden="true" />
                        </div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                          {CATEGORY_LABELS[cat.key] || cat.key}
                        </h3>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <CatalogRow
                            key={item.doc_type}
                            item={item}
                            loading={requestingType === item.doc_type}
                            onRequest={() => handleRequest(item)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── View modal ────────────────────────────────────────────────────── */}
      {viewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setViewDoc(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Photo or placeholder */}
            {viewDoc.photo_base64 ? (
              <img
                src={viewDoc.photo_base64}
                alt="Document"
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center gap-2 relative">
                <DocTypeIcon type={viewDoc.doc_type} size={56} className="text-actid-blue/60" />
                {viewDoc.is_verified && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold bg-green-50 text-green-700 px-2 py-1 rounded-full border border-green-200 shadow-sm">
                    <ShieldCheck size={11} aria-hidden="true" /> Document Oficial
                  </span>
                )}
              </div>
            )}

            {/* Fields */}
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-lg leading-tight">
                    {DOC_LABELS[viewDoc.doc_type] || viewDoc.doc_type}
                  </p>
                  {viewDoc.doc_number && (
                    <p className="font-mono text-sm text-muted-foreground mt-0.5">{viewDoc.doc_number}</p>
                  )}
                </div>
                <button
                  onClick={() => setViewDoc(null)}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0"
                  aria-label="Închide"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {viewDoc.doc_type === "CI" && viewDoc.cnp && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">CNP</p>
                    <p className="text-sm font-medium font-mono">{viewDoc.cnp}</p>
                  </div>
                )}
                {viewDoc.doc_number && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">
                      {viewDoc.doc_type === "CI" ? "Număr serie" : "Număr document"}
                    </p>
                    <p className="text-sm font-medium font-mono">{viewDoc.doc_number}</p>
                  </div>
                )}
                {viewDoc.issued_by && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Emis de</p>
                    <p className="text-sm font-medium">{viewDoc.issued_by}</p>
                  </div>
                )}
                {viewDoc.issued_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Data emiterii</p>
                    <p className="text-sm font-medium">{formatDate(viewDoc.issued_date)}</p>
                  </div>
                )}
                {viewDoc.expires_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expiră</p>
                    <p className={cn(
                      "text-sm font-medium",
                      viewDoc.status === "expirat" ? "text-red-600" :
                      viewDoc.status === "expiră_curând" ? "text-amber-600" : ""
                    )}>
                      {formatDate(viewDoc.expires_date)}
                    </p>
                  </div>
                )}
              </div>

              {viewDoc.description && (
                <div>
                  <p className="text-xs text-muted-foreground">Descriere</p>
                  <p className="text-sm">{viewDoc.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main page ─────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Documentele mele</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {documents.length} {documents.length === 1 ? "document înregistrat" : "documente înregistrate"}
            </p>
          </div>
          <Button
            size="sm"
            onClick={openCatalog}
            className="gap-1.5 flex-shrink-0"
          >
            <Plus size={14} aria-hidden="true" /> Solicită
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Caută document..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Caută document"
        />

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" role="tablist">
          {FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? documents.length
                : documents.filter((d) => d.status === f.key).length;
            const FilterIcon = f.Icon;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  filter === f.key
                    ? "bg-actid-blue text-white border-actid-blue"
                    : "border-border text-foreground hover:border-gray-300"
                }`}
              >
                <FilterIcon size={14} aria-hidden="true" />
                {f.label}
                {count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      filter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <DocumentCardSkeleton key={i} />)}
          </div>

        /* ── Search: flat results ──────────────────────────────────────── */
        ) : search ? (
          <div className="space-y-4" role="list" aria-label="Rezultate căutare">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {searchResults.length} {searchResults.length === 1 ? "rezultat" : "rezultate"}
              </h2>
              <div className="flex-1 h-px bg-border" aria-hidden="true" />
            </div>
            {searchResults.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileText size={22} className="text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="font-semibold">Niciun document găsit</p>
                  <p className="text-sm text-muted-foreground mt-1">Încearcă alt termen de căutare</p>
                </CardContent>
              </Card>
            ) : (
              searchResults.map((doc) => (
                <div key={doc.id} role="listitem" className="space-y-2">
                  <DocumentCard doc={doc} onDelete={handleDelete} onShare={() => {}} onView={setViewDoc} />
                  {deletePending?.id === doc.id && (
                    <DeleteConfirm
                      label={DOC_LABELS[doc.doc_type]}
                      onConfirm={handleDeleteConfirm}
                      onCancel={() => setDeletePending(null)}
                    />
                  )}
                </div>
              ))
            )}
          </div>

        /* ── Inside an open folder ─────────────────────────────────────── */
        ) : activeFolder ? (
          (() => {
            const meta = CATEGORY_META[activeFolder.key] ?? CATEGORY_META.altele;
            const Icon = meta.Icon;
            return (
              <div className="space-y-4">
                <button
                  onClick={() => setOpenFolder(null)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-actid-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded"
                >
                  <ChevronLeft size={16} aria-hidden="true" /> Toate folderele
                </button>
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", meta.tile)}>
                    <Icon size={22} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-lg leading-tight truncate">{activeFolder.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {activeFolder.docs.length} {activeFolder.docs.length === 1 ? "document" : "documente"}
                    </p>
                  </div>
                </div>
                <div className="space-y-4" role="list" aria-label={activeFolder.label}>
                  {activeFolder.docs.map((doc) => (
                    <div key={doc.id} role="listitem" className="space-y-2">
                      <DocumentCard doc={doc} onDelete={handleDelete} onShare={() => {}} onView={setViewDoc} />
                      {deletePending?.id === doc.id && (
                        <DeleteConfirm
                          label={DOC_LABELS[doc.doc_type]}
                          onConfirm={handleDeleteConfirm}
                          onCancel={() => setDeletePending(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()

        /* ── No documents for the active filter ───────────────────────── */
        ) : folders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText size={22} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-semibold">
                {filter === "expirat"
                  ? "Nu ai documente expirate"
                  : filter === "expiră_curând"
                  ? "Niciun document nu expiră curând"
                  : "Nu ai documente înregistrate"}
              </p>
              {filter === "all" && (
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={openCatalog}>
                  <Plus size={14} aria-hidden="true" /> Solicită primul document
                </Button>
              )}
            </CardContent>
          </Card>

        /* ── Folder overview grid ──────────────────────────────────────── */
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {folders.map((f) => {
                const meta = CATEGORY_META[f.key] ?? CATEGORY_META.altele;
                const Icon = meta.Icon;
                const expired = f.docs.filter((d) => d.status === "expirat").length;
                const soon = f.docs.filter((d) => d.status === "expiră_curând").length;
                return (
                  <button
                    key={f.key}
                    onClick={() => setOpenFolder(f.key)}
                    aria-label={`${f.label}, ${f.docs.length} ${f.docs.length === 1 ? "document" : "documente"}${expired > 0 ? `, ${expired} ${expired === 1 ? "expirat" : "expirate"}` : soon > 0 ? `, ${soon} expiră curând` : ", toate valabile"}`}
                    className="group text-left bg-white rounded-2xl border border-border p-4 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue"
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", meta.tile)}>
                        <Icon size={20} aria-hidden="true" />
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-400 transition-colors mt-1" aria-hidden="true" />
                    </div>
                    <p className="font-semibold text-sm mt-3 leading-snug">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.docs.length} {f.docs.length === 1 ? "document" : "documente"}
                    </p>
                    <div className="mt-2">
                      {expired > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                          <ShieldAlert size={11} aria-hidden="true" /> {expired} {expired === 1 ? "expirat" : "expirate"}
                        </span>
                      ) : soon > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                          <Clock size={11} aria-hidden="true" /> {soon} expiră curând
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                          <ShieldCheck size={11} aria-hidden="true" /> Toate valabile
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Catalog row ─────────────────────────────────────────────────────────────

function CatalogRow({
  item,
  loading,
  onRequest,
}: {
  item: DocumentCatalogItem;
  loading: boolean;
  onRequest: () => void;
}) {
  const isOwned = item.state === "owned";
  const isExpired = item.state === "expired";

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border-2 transition-colors",
      isExpired ? "border-amber-200 bg-amber-50/40" :
      isOwned ? "border-green-200 bg-green-50/30" :
      "border-border bg-white"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
        isExpired ? "bg-amber-100 text-amber-700" :
        isOwned ? "bg-green-100 text-green-700" :
        "bg-blue-50 text-blue-600"
      )}>
        <DocTypeIcon type={item.doc_type} size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.issuing_authority}</p>
      </div>
      {isOwned ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-3 py-2 rounded-xl flex-shrink-0">
          <Check size={13} aria-hidden="true" /> Ai deja
        </span>
      ) : isExpired ? (
        <Button
          size="sm"
          onClick={onRequest}
          loading={loading}
          variant="secondary"
          className="gap-1.5 flex-shrink-0 bg-amber-500 text-white hover:bg-amber-600 border-amber-500"
        >
          <RotateCcw size={13} aria-hidden="true" /> Reînnoiește
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onRequest}
          loading={loading}
          className="gap-1.5 flex-shrink-0"
        >
          <Plus size={13} aria-hidden="true" /> Solicită
        </Button>
      )}
    </div>
  );
}

function DeleteConfirm({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card className="border-actid-red/30 bg-red-50/50">
      <CardContent className="py-4">
        <p className="text-sm font-semibold text-red-800">Ștergi &ldquo;{label}&rdquo;?</p>
        <p className="text-xs text-red-600 mt-0.5">Această acțiune nu poate fi anulată.</p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="destructive" onClick={onConfirm} className="flex-1">
            Da, șterge
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel} className="flex-1">
            Anulează
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
