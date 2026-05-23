import { useEffect, useRef, useState } from "react";
import {
  Files, ShieldCheck, Clock, ShieldAlert, Plus, X, FileText,
  ChevronRight, ChevronLeft, Camera, type LucideIcon,
} from "lucide-react";
import { documentsApi } from "@/lib/api";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { DocumentCard, DocumentCardSkeleton, CATEGORY_META } from "@/components/documents/DocumentCard";
import { Button, Card, CardContent, Input } from "@/components/ui";
import type { Document, DocType } from "@/types";
import { DOC_LABELS, DOC_CATEGORIES, groupDocsIntoFolders, cn, formatDate } from "@/lib/utils";

type Filter = "all" | "valid" | "expiră_curând" | "expirat";
type ScanStep = "type" | "camera" | "form";

const FILTERS: { key: Filter; label: string; Icon: LucideIcon }[] = [
  { key: "all",           label: "Toate",         Icon: Files },
  { key: "valid",         label: "Valide",         Icon: ShieldCheck },
  { key: "expiră_curând", label: "Expiră curând",  Icon: Clock },
  { key: "expirat",       label: "Expirate",       Icon: ShieldAlert },
];

const STEP_LABELS: Record<ScanStep, string> = {
  type:   "Alege tipul documentului",
  camera: "Fotografiază documentul",
  form:   "Completează detaliile",
};
const STEPS: ScanStep[] = ["type", "camera", "form"];

export default function DocumentsPage() {
  const { documents, setDocuments, loading, setLoading, removeDocument } = useDocumentStore();
  const { generateFromDocuments, addToast } = useNotificationStore();

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletePending, setDeletePending] = useState<Document | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [scanStep, setScanStep] = useState<ScanStep | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [newDoc, setNewDoc] = useState({
    doc_type: "CI" as DocType,
    doc_number: "",
    issued_by: "",
    issued_date: "",
    expires_date: "",
    description: "",
    cnp: "",
  });

  useEffect(() => { load(); }, []);

  // Start camera when scan step is "camera", stop otherwise
  useEffect(() => {
    if (scanStep !== "camera") return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        addToast("Nu am putut accesa camera. Acordă permisiune în browser.", "error");
        setScanStep("type");
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [scanStep]);

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

  const handleDelete = (doc: Document) => setDeletePending(doc);

  const handleDeleteConfirm = async () => {
    if (!deletePending) return;
    const doc = deletePending;
    setDeletePending(null);
    try {
      await documentsApi.delete(doc.id);
      removeDocument(doc.id);
      addToast("Document șters", "info", { label: "Anulează", onClick: () => restoreDocument(doc) });
    } catch {
      addToast("Ștergerea a eșuat. Documentul nu a fost șters, încearcă din nou.", "error");
    }
  };

  const restoreDocument = async (doc: Document) => {
    try {
      await documentsApi.create({
        doc_type: doc.doc_type,
        doc_number: doc.doc_number ?? "",
        issued_by: doc.issued_by ?? "",
        issued_date: doc.issued_date ?? null,
        expires_date: doc.expires_date ?? null,
        description: doc.description ?? "",
      });
      await load();
      addToast("Document restaurat", "success");
    } catch {
      addToast("Restaurarea a eșuat. Documentul nu a putut fi recuperat.", "error");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const payload: Record<string, unknown> = {
        ...newDoc,
        issued_date: newDoc.issued_date || null,
        expires_date: newDoc.expires_date || null,
        cnp: newDoc.cnp || null,
      };
      if (capturedPhoto) payload.photo_base64 = capturedPhoto;
      const res = await documentsApi.create(payload);
      const docs = [res.data, ...documents];
      setDocuments(docs);
      generateFromDocuments(docs);
      setShowAddForm(false);
      setScanStep(null);
      setCapturedPhoto(null);
      setOpenFolder(null);
      setNewDoc({ doc_type: "CI", doc_number: "", issued_by: "", issued_date: "", expires_date: "", description: "", cnp: "" });
      addToast("Document adăugat!", "success");
    } catch (e: any) {
      addToast(e.response?.data?.detail || "Eroare la adăugare", "error");
    } finally {
      setAdding(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.85));
    setScanStep("form");
  };

  const closeScanModal = () => {
    setScanStep(null);
    setCapturedPhoto(null);
    setNewDoc({ doc_type: "CI", doc_number: "", issued_by: "", issued_date: "", expires_date: "", description: "", cnp: "" });
  };

  const handleScanBack = () => {
    if (scanStep === "type")   closeScanModal();
    else if (scanStep === "camera") setScanStep("type");
    else if (scanStep === "form")   { setCapturedPhoto(null); setScanStep("camera"); }
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

  return (
    <>
      {/* ── Scan modal (full-screen) ───────────────────────────────────────── */}
      {scanStep !== null && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3 bg-black/80 backdrop-blur-sm flex-shrink-0">
            <button
              onClick={handleScanBack}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Înapoi"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{STEP_LABELS[scanStep]}</p>
              <div className="flex gap-1 mt-1.5">
                {STEPS.map((s) => (
                  <div
                    key={s}
                    className={cn(
                      "h-1 rounded-full flex-1 transition-all",
                      s === scanStep ? "bg-white" :
                      STEPS.indexOf(s) < STEPS.indexOf(scanStep) ? "bg-white/60" : "bg-white/20"
                    )}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={closeScanModal}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white"
              aria-label="Închide"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── Step: type ── */}
          {scanStep === "type" && (
            <div className="flex-1 flex flex-col bg-white overflow-y-auto">
              <div className="flex-1 p-5 space-y-3">
                <p className="text-sm text-muted-foreground">Ce document vrei să adaugi?</p>
                <select
                  value={newDoc.doc_type}
                  onChange={(e) => setNewDoc({ ...newDoc, doc_type: e.target.value as DocType })}
                  className="w-full h-12 rounded-xl border border-input bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30"
                >
                  {DOC_CATEGORIES.map((cat) => (
                    <optgroup key={cat.key} label={cat.label}>
                      {cat.types.map((t) => (
                        <option key={t} value={t}>{DOC_LABELS[t]}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="p-5">
                <Button className="w-full gap-2" onClick={() => setScanStep("camera")}>
                  <Camera size={16} /> Continuă la cameră
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: camera ── */}
          {scanStep === "camera" && (
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Document frame guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[85%] aspect-[1.586/1] border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
              <p className="absolute top-4 inset-x-0 text-center text-white text-sm font-medium drop-shadow px-4">
                Încadrează documentul în dreptunghi
              </p>
              {/* Shutter button */}
              <button
                onClick={capturePhoto}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white border-[5px] border-white/40 shadow-xl active:scale-95 transition-transform"
                aria-label="Capturează"
              />
            </div>
          )}

          {/* ── Step: form ── */}
          {scanStep === "form" && (
            <div className="flex-1 overflow-y-auto bg-white">
              {/* Captured photo preview */}
              {capturedPhoto && (
                <div className="relative">
                  <img
                    src={capturedPhoto}
                    alt="Document capturat"
                    className="w-full aspect-video object-cover"
                  />
                  <button
                    onClick={() => { setCapturedPhoto(null); setScanStep("camera"); }}
                    className="absolute top-3 right-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white"
                    aria-label="Refă poza"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              )}

              <form onSubmit={handleAdd} className="p-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tip:{" "}
                  <span className="font-semibold text-foreground">
                    {DOC_LABELS[newDoc.doc_type] || newDoc.doc_type}
                  </span>
                </p>
                {newDoc.doc_type === "CI" ? (
                  <>
                    <Input
                      label="CNP"
                      value={newDoc.cnp}
                      onChange={(e) => setNewDoc({ ...newDoc, cnp: e.target.value })}
                      placeholder="ex: 1234567890123"
                      maxLength={13}
                    />
                    <Input
                      label="Număr serie"
                      value={newDoc.doc_number}
                      onChange={(e) => setNewDoc({ ...newDoc, doc_number: e.target.value })}
                      placeholder="ex: AX123456"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Data emiterii"
                        type="date"
                        value={newDoc.issued_date}
                        onChange={(e) => setNewDoc({ ...newDoc, issued_date: e.target.value })}
                      />
                      <Input
                        label="Data expirării"
                        type="date"
                        value={newDoc.expires_date}
                        onChange={(e) => setNewDoc({ ...newDoc, expires_date: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      label="Număr document"
                      value={newDoc.doc_number}
                      onChange={(e) => setNewDoc({ ...newDoc, doc_number: e.target.value })}
                      placeholder="ex: CJ123456"
                    />
                    <Input
                      label="Emis de"
                      value={newDoc.issued_by}
                      onChange={(e) => setNewDoc({ ...newDoc, issued_by: e.target.value })}
                      placeholder="ex: SPCLEP Cluj-Napoca"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Data emiterii"
                        type="date"
                        value={newDoc.issued_date}
                        onChange={(e) => setNewDoc({ ...newDoc, issued_date: e.target.value })}
                      />
                      <Input
                        label="Data expirării"
                        type="date"
                        value={newDoc.expires_date}
                        onChange={(e) => setNewDoc({ ...newDoc, expires_date: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <Button type="submit" loading={adding} className="w-full">
                  Salvează documentul
                </Button>
              </form>
            </div>
          )}
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
              <div className="w-full aspect-video bg-gray-100 flex flex-col items-center justify-center gap-2">
                <FileText size={48} className="text-gray-300" />
                <p className="text-xs text-muted-foreground">Nicio fotografie atașată</p>
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
                {viewDoc.doc_type !== "CI" && viewDoc.issued_by && (
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
                  <p className="text-xs text-muted-foreground">Note</p>
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
              {documents.length} documente înregistrate
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setScanStep("type")}
              className="gap-1.5"
            >
              <Camera size={14} aria-hidden="true" /> Scanează
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-1.5"
            >
              {showAddForm
                ? <><X size={14} aria-hidden="true" /> Anulează</>
                : <><Plus size={14} aria-hidden="true" /> Adaugă</>}
            </Button>
          </div>
        </div>

        {/* Manual add form (no photo) */}
        {showAddForm && (
          <Card className="border-actid-blue/20">
            <CardContent className="py-5">
              <h2 className="font-semibold mb-4">Adaugă document nou</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Tip document</label>
                  <select
                    value={newDoc.doc_type}
                    onChange={(e) => setNewDoc({ ...newDoc, doc_type: e.target.value as DocType })}
                    className="w-full h-11 rounded-xl border border-input bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-actid-blue/30"
                    required
                  >
                    {DOC_CATEGORIES.map((cat) => (
                      <optgroup key={cat.key} label={cat.label}>
                        {cat.types.map((t) => (
                          <option key={t} value={t}>{DOC_LABELS[t]}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {newDoc.doc_type === "CI" ? (
                  <>
                    <Input
                      label="CNP"
                      value={newDoc.cnp}
                      onChange={(e) => setNewDoc({ ...newDoc, cnp: e.target.value })}
                      placeholder="ex: 1234567890123"
                      maxLength={13}
                    />
                    <Input
                      label="Număr serie"
                      value={newDoc.doc_number}
                      onChange={(e) => setNewDoc({ ...newDoc, doc_number: e.target.value })}
                      placeholder="ex: AX123456"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Data emiterii"
                        type="date"
                        value={newDoc.issued_date}
                        onChange={(e) => setNewDoc({ ...newDoc, issued_date: e.target.value })}
                      />
                      <Input
                        label="Data expirării"
                        type="date"
                        value={newDoc.expires_date}
                        onChange={(e) => setNewDoc({ ...newDoc, expires_date: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      label="Număr document"
                      value={newDoc.doc_number}
                      onChange={(e) => setNewDoc({ ...newDoc, doc_number: e.target.value })}
                      placeholder="ex: CJ123456"
                    />
                    <Input
                      label="Emis de"
                      value={newDoc.issued_by}
                      onChange={(e) => setNewDoc({ ...newDoc, issued_by: e.target.value })}
                      placeholder="ex: SPCLEP Cluj-Napoca"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Data emiterii"
                        type="date"
                        value={newDoc.issued_date}
                        onChange={(e) => setNewDoc({ ...newDoc, issued_date: e.target.value })}
                      />
                      <Input
                        label="Data expirării"
                        type="date"
                        value={newDoc.expires_date}
                        onChange={(e) => setNewDoc({ ...newDoc, expires_date: e.target.value })}
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Button type="submit" loading={adding} className="flex-1">Salvează</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                    Anulează
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

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
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
                  Adaugă primul document
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