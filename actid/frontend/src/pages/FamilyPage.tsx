import { useEffect, useState } from "react";
import { Globe, Users, UserCheck, ArrowDownToLine, ArrowUpFromLine, Plus, X, Check, ChevronDown } from "lucide-react";
import { familyApi, documentsApi } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { useDocumentStore } from "@/store/documentStore";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, Badge, Button, Input, Alert, StatusBadge } from "@/components/ui";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { formatDate, formatDateTime, DOC_LABELS, cn } from "@/lib/utils";
import type { DelegationGrant, DelegatedDocument, DocStatus } from "@/types";

const DOCUMENT_CATEGORIES = [
  { key: "CI", label: "Carte de Identitate" },
  { key: "PASAPORT", label: "Pașaport" },
  { key: "PERMIS", label: "Permis de Conducere" },
  { key: "CAZIER", label: "Cazier Judiciar" },
  { key: "CERT_NASTERE", label: "Certificat Naștere" },
  { key: "ROVINIETA", label: "Rovinietă" },
  { key: "ANAF", label: "Certificat ANAF" },
];

export default function FamilyPage() {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const { delegatedDocuments, setDelegatedDocuments } = useDocumentStore();
  const [myDelegations, setMyDelegations] = useState<DelegationGrant[]>([]);
  const [delegationsToMe, setDelegationsToMe] = useState<DelegationGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [revokePendingId, setRevokePendingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"received" | "given">("received");
  const [expandedDelegationId, setExpandedDelegationId] = useState<string | null>(null);
  const [form, setForm] = useState({
    delegate_email: "",
    document_categories: [] as string[],
    permissions: ["read"],
    valid_days: 365,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [myRes, toMeRes, delegatedRes] = await Promise.all([
        familyApi.listDelegations(),
        familyApi.listDelegatedToMe(),
        documentsApi.listDelegated(),
      ]);
      setMyDelegations(myRes.data);
      setDelegationsToMe(toMeRes.data);
      setDelegatedDocuments(delegatedRes.data);
    } catch {
      addToast("Eroare la încărcarea delegărilor", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setForm((prev) => ({
      ...prev,
      document_categories: prev.document_categories.includes(cat)
        ? prev.document_categories.filter((c) => c !== cat)
        : [...prev.document_categories, cat],
    }));
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.delegate_email) {
      setFormError("Introdu email-ul persoanei delegate");
      return;
    }
    if (form.document_categories.length === 0) {
      setFormError("Selectează cel puțin o categorie de documente");
      return;
    }
    setSubmitting(true);
    try {
      const res = await familyApi.createDelegation(form);
      setMyDelegations((prev) => [res.data, ...prev]);
      setShowForm(false);
      setForm({ delegate_email: "", document_categories: [], permissions: ["read"], valid_days: 365, notes: "" });
      addToast("Delegare creată cu succes!", "success");
    } catch (e: any) {
      setFormError(e.response?.data?.detail || "Eroare la creare delegare");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = (id: string) => {
    setRevokePendingId(id);
  };

  const handleRevokeConfirm = async () => {
    if (!revokePendingId) return;
    const id = revokePendingId;
    setRevokePendingId(null);
    try {
      await familyApi.revokeDelegation(id);
      setMyDelegations((prev) => prev.filter((d) => d.id !== id));
      addToast("Delegare revocată", "success");
    } catch {
      addToast("Eroare la revocare", "error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delegare Familie</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Administrează accesul membrilor familiei la documentele tale
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          {showForm ? <><X size={14} aria-hidden="true" /> Anulează</> : <><Plus size={14} aria-hidden="true" /> Delegare</>}
        </Button>
      </div>

      {/* Diaspora context banner */}
      {delegationsToMe.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50/60 to-indigo-50/60 border-blue-100">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe size={18} className="text-blue-600" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-sm">
                  Ai acces delegat la documentele familiei
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Poți gestiona documente pentru {delegationsToMe.length}{" "}
                  {delegationsToMe.length === 1 ? "persoană" : "persoane"} din familie, chiar și de la distanță.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="border-actid-blue/20">
          <CardContent className="py-5">
            <h2 className="font-semibold mb-4">Acordă delegare</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && <Alert variant="error">{formError}</Alert>}

              <Input
                label="Email persoana delegată"
                type="email"
                value={form.delegate_email}
                onChange={(e) => setForm({ ...form, delegate_email: e.target.value })}
                placeholder="alex.ionescu@gmail.com"
                required
              />

              <div>
                <p className="text-sm font-medium mb-2">Categorii documente</p>
                <div className="grid grid-cols-2 gap-2">
                  {DOCUMENT_CATEGORIES.map((cat) => {
                    const selected = form.document_categories.includes(cat.key);
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => toggleCategory(cat.key)}
                        className={`flex items-center gap-1.5 text-left p-2.5 min-h-[44px] rounded-xl border-2 text-xs font-medium transition-all ${
                          selected
                            ? "border-actid-blue bg-blue-50 text-actid-blue"
                            : "border-border hover:border-gray-300"
                        }`}
                        aria-pressed={selected}
                      >
                        {selected && <Check size={11} className="flex-shrink-0" aria-hidden="true" />}
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Permisiuni</p>
                <div className="flex gap-2">
                  {[
                    { key: "read", label: "Vizualizare" },
                    { key: "request_renewal", label: "Reînnoire" },
                  ].map((perm) => {
                    const selected = form.permissions.includes(perm.key);
                    return (
                      <button
                        key={perm.key}
                        type="button"
                        onClick={() => togglePermission(perm.key)}
                        className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition-all ${
                          selected
                            ? "border-actid-blue bg-blue-50 text-actid-blue"
                            : "border-border hover:border-gray-300"
                        }`}
                        aria-pressed={selected}
                      >
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Durată validitate</p>
                <div className="flex gap-2">
                  {[90, 180, 365, 730].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setForm({ ...form, valid_days: days })}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        form.valid_days === days
                          ? "bg-actid-blue text-white border-actid-blue"
                          : "border-border hover:border-gray-300"
                      }`}
                    >
                      {days < 365 ? `${days}z` : `${days / 365}an`}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Note (opțional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ex: Fiu în diaspora — gestionează actele mele din UK"
              />

              <Button type="submit" loading={submitting} className="w-full gap-1.5">
                <UserCheck size={16} aria-hidden="true" /> Creează delegare
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "received"}
          onClick={() => { setActiveTab("received"); setRevokePendingId(null); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
            activeTab === "received"
              ? "bg-white shadow-sm text-actid-blue"
              : "text-muted-foreground"
          }`}
        >
          <ArrowDownToLine size={14} aria-hidden="true" /> Primit ({delegationsToMe.length})
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "given"}
          onClick={() => { setActiveTab("given"); setRevokePendingId(null); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
            activeTab === "given"
              ? "bg-white shadow-sm text-actid-blue"
              : "text-muted-foreground"
          }`}
        >
          <ArrowUpFromLine size={14} aria-hidden="true" /> Acordat ({myDelegations.length})
        </button>
      </div>

      {/* Received delegations → accordion by family member */}
      {activeTab === "received" && (
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-36 rounded" />
                  <div className="skeleton h-3 w-52 rounded" />
                </div>
              </div>
            </div>
          ) : delegationsToMe.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users size={22} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="font-semibold">Nicio delegare primită</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Un membru al familiei îți poate acorda acces la documentele sale
                </p>
              </CardContent>
            </Card>
          ) : (
            delegationsToMe.map((grant) => {
              const grantDocs = (delegatedDocuments as DelegatedDocument[]).filter(
                (d) => d.delegation_id === grant.id
              );
              const isOpen = expandedDelegationId === grant.id;
              const initials = (grant.delegator_name || "?")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={grant.id}
                  className={cn(
                    "rounded-2xl border overflow-hidden transition-shadow",
                    isOpen ? "border-actid-blue/30 shadow-sm" : "border-border"
                  )}
                >
                  {/* Member row — accordion trigger */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDelegationId(isOpen ? null : grant.id)
                    }
                    aria-expanded={isOpen}
                    aria-label={`${grant.delegator_name}, ${grantDocs.length} documente delegate, ${isOpen ? "restrânge" : "extinde"}`}
                    className={cn(
                      "w-full flex items-center gap-3 p-4 text-left bg-white transition-colors",
                      "hover:bg-gray-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-inset"
                    )}
                  >
                    {/* Initials avatar */}
                    <div className="w-10 h-10 bg-actid-blue rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-bold">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{grant.delegator_name}</p>
                        <Badge variant="success">Activ</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {grantDocs.length > 0
                          ? `${grantDocs.length} ${grantDocs.length === 1 ? "document" : "documente"} delegate`
                          : grant.document_categories.length + " categorii"}
                        {grant.valid_until && ` · până ${formatDate(grant.valid_until)}`}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {grant.document_categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium"
                          >
                            {cat}
                          </span>
                        ))}
                        {grant.document_categories.length > 3 && (
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            +{grant.document_categories.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {grantDocs.length > 0 && (
                      <span className="text-[10px] font-bold text-white bg-actid-blue rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">
                        {grantDocs.length}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={cn(
                        "text-muted-foreground transition-transform flex-shrink-0",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Expanded: notes + document rows */}
                  {isOpen && (
                    <div className="border-t border-border/60">
                      {grant.notes && (
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-border/40">
                          <p className="text-xs text-muted-foreground italic">
                            &ldquo;{grant.notes}&rdquo;
                          </p>
                        </div>
                      )}
                      {grantDocs.length === 0 ? (
                        <div className="px-4 py-6 text-center bg-gray-50/40">
                          <p className="text-sm text-muted-foreground">
                            Niciun document disponibil momentan
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/60 bg-gray-50/30">
                          {grantDocs.map((doc) => {
                            const status = (doc.status || "valid") as DocStatus;
                            return (
                              <div
                                key={doc.id}
                                className="flex items-center gap-3 px-4 py-3"
                              >
                                <div
                                  className={cn(
                                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                                    status === "expirat"
                                      ? "bg-red-50 text-red-500"
                                      : status === "expiră_curând"
                                      ? "bg-amber-50 text-amber-600"
                                      : "bg-blue-50 text-blue-600"
                                  )}
                                >
                                  <DocTypeIcon type={doc.doc_type} size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {DOC_LABELS[doc.doc_type] || doc.doc_type}
                                  </p>
                                  {doc.doc_number && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      {doc.doc_number}
                                    </p>
                                  )}
                                  {doc.expires_date && (
                                    <p className="text-[10px] text-muted-foreground">
                                      Expiră: {formatDate(doc.expires_date)}
                                    </p>
                                  )}
                                </div>
                                <StatusBadge status={status} className="flex-shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Revoke confirmation */}
      {revokePendingId && activeTab === "given" && (
        <Card className="border-actid-red/30 bg-red-50/50">
          <CardContent className="py-4">
            <p className="text-sm font-semibold text-red-800">Revocare delegare?</p>
            <p className="text-xs text-red-600 mt-0.5">
              Persoana delegată va pierde accesul imediat.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="destructive" onClick={handleRevokeConfirm} className="flex-1">
                Da, revocă
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setRevokePendingId(null)} className="flex-1">
                Anulează
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Given delegations */}
      {activeTab === "given" && (
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-2xl border border-border p-4">
              <div className="skeleton h-4 w-48 rounded mb-2" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
          ) : myDelegations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ArrowUpFromLine size={22} className="text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="font-semibold">Nu ai acordat nicio delegare</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Delegă accesul unui membru de familie sau persoane de încredere
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowForm(true)}
                >
                  + Acordă delegare
                </Button>
              </CardContent>
            </Card>
          ) : (
            myDelegations.map((grant) => (
              <Card key={grant.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <UserCheck size={18} className="text-purple-600" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{grant.delegate_name}</p>
                      <p className="text-xs text-muted-foreground">{grant.delegate_email}</p>
                      {grant.notes && (
                        <p className="text-xs text-muted-foreground italic mt-0.5">"{grant.notes}"</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {grant.document_categories.map((cat) => (
                          <Badge key={cat} variant="info" className="text-[10px]">{cat}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Consimțământ: {formatDateTime(grant.consent_timestamp)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevoke(grant.id)}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      Revocă
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
