import { useEffect, useState } from "react";
import { documentsApi } from "@/lib/api";
import { useDocumentStore } from "@/store/documentStore";
import { useNotificationStore } from "@/store/notificationStore";
import { DocumentCard, DocumentCardSkeleton } from "@/components/documents/DocumentCard";
import { Button, Card, CardContent, Input } from "@/components/ui";
import type { Document, DocType } from "@/types";
import { DOC_LABELS } from "@/lib/utils";

type Filter = "all" | "valid" | "expiră_curând" | "expirat";

const FILTERS: { key: Filter; label: string; icon: string }[] = [
  { key: "all", label: "Toate", icon: "📁" },
  { key: "valid", label: "Valide", icon: "✅" },
  { key: "expiră_curând", label: "Expiră curând", icon: "⚡" },
  { key: "expirat", label: "Expirate", icon: "🚨" },
];

const DOC_TYPES: DocType[] = [
  "CI", "PASAPORT", "PERMIS", "CAZIER", "CERT_NASTERE",
  "ADEVERINTA", "ANAF", "ONRC", "ROVINIETA",
];

export default function DocumentsPage() {
  const { documents, setDocuments, loading, setLoading, removeDocument } = useDocumentStore();
  const { generateFromDocuments, addToast } = useNotificationStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newDoc, setNewDoc] = useState({
    doc_type: "CI" as DocType,
    doc_number: "",
    issued_by: "",
    issued_date: "",
    expires_date: "",
    description: "",
  });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await documentsApi.list();
      setDocuments(res.data);
      generateFromDocuments(res.data);
    } catch (err: any) {
      addToast(err.userMessage || "Eroare la încărcarea documentelor", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Ștergi ${DOC_LABELS[doc.doc_type] || doc.doc_type}?`)) return;
    try {
      await documentsApi.delete(doc.id);
      removeDocument(doc.id);
      addToast("Document șters", "success");
    } catch (err: any) {
      addToast(err.userMessage || "Eroare la ștergere", "error");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const payload = {
        ...newDoc,
        issued_date: newDoc.issued_date || null,
        expires_date: newDoc.expires_date || null,
      };
      const res = await documentsApi.create(payload);
      const docs = [res.data, ...documents];
      setDocuments(docs);
      generateFromDocuments(docs);
      setShowAddForm(false);
      setNewDoc({ doc_type: "CI", doc_number: "", issued_by: "", issued_date: "", expires_date: "", description: "" });
      addToast("Document adăugat!", "success");
    } catch (err: any) {
      addToast(err.userMessage || "Eroare la adăugare", "error");
    } finally {
      setAdding(false);
    }
  };

  const filtered = documents
    .filter((d) => filter === "all" || d.status === filter)
    .filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        d.doc_type.toLowerCase().includes(q) ||
        DOC_LABELS[d.doc_type]?.toLowerCase().includes(q) ||
        d.doc_number?.toLowerCase().includes(q) ||
        d.issued_by?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Documentele mele</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{documents.length} documente înregistrate</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "✕ Anulează" : "+ Adaugă"}
        </Button>
      </div>

      {/* Add form */}
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
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{DOC_LABELS[t]}</option>
                  ))}
                </select>
              </div>
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
              <div className="flex gap-2">
                <Button type="submit" loading={adding} className="flex-1">
                  Salvează
                </Button>
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
              <span>{f.icon}</span>
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

      {/* Document list */}
      <div className="space-y-3" role="list" aria-label="Lista documente">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <DocumentCardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-4xl mb-3">
                {filter === "expirat" ? "✅" : filter === "expiră_curând" ? "🎉" : "🔍"}
              </p>
              <p className="font-semibold">
                {search
                  ? "Niciun document găsit"
                  : filter === "expirat"
                  ? "Nu ai documente expirate"
                  : filter === "expiră_curând"
                  ? "Niciun document nu expiră curând"
                  : "Nu ai documente înregistrate"}
              </p>
              {!search && filter === "all" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddForm(true)}
                >
                  + Adaugă primul document
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((doc) => (
            <div key={doc.id} role="listitem">
              <DocumentCard
                doc={doc}
                onDelete={handleDelete}
                onShare={() => {}}
                onView={() => {}}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
