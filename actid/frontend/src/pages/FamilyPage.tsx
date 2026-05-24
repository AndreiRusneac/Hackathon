import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCheck, Plus, X, Check,
  ChevronDown, Baby, FileText, ShieldCheck, ShieldAlert, Upload, UserPlus,
  Trash2, Search, Bus, Eye, GraduationCap,
} from "lucide-react";
import { childrenApi } from "@/lib/api";
import { useNotificationStore } from "@/store/notificationStore";
import { Card, CardContent, Badge, Button, Input, Alert } from "@/components/ui";
import { DocTypeIcon } from "@/components/documents/DocumentCard";
import { formatDate, DOC_LABELS, cn } from "@/lib/utils";
import type {
  ChildProfile, RegistryChild, MyChildProfile, GovDocResult,
} from "@/types";

const RELATIONSHIP_LABELS: Record<string, string> = {
  parent: "Părinte",
  legal_guardian: "Tutore Legal",
  adoptive_parent: "Părinte Adoptiv",
};

function ChildAge({ dob }: { dob: string }) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return <span>{age} ani</span>;
}

// ─── Add Child Wizard ─────────────────────────────────────────────────────────

const RECORD_TYPE_LABELS: Record<string, string> = {
  birth_certificate: "Certificat de Naștere",
  adoption_decree: "Decret de Adopție",
  court_order: "Hotărâre Judecătorească",
};

type SearchPhase = "idle" | "loading" | "results" | "empty" | "error";

function AddChildWizard({ onCreated, onCancel }: { onCreated: (child: ChildProfile) => void; onCancel: () => void }) {
  const { addToast } = useNotificationStore();
  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [results, setResults] = useState<RegistryChild[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");
    setPhase("loading");
    try {
      const res = await childrenApi.searchRegistry();
      const data: RegistryChild[] = res.data;
      setResults(data);
      setPhase(data.length === 0 ? "empty" : "results");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Eroare la căutare");
      setPhase("error");
    }
  };

  const handleLink = async (child: RegistryChild) => {
    setLinkingId(child.registry_id);
    try {
      const res = await childrenApi.linkFromRegistry(child.registry_id);
      addToast(`Profil adăugat pentru ${child.child_full_name}`, "success");
      onCreated(res.data);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Eroare la adăugare", "error");
      setLinkingId(null);
    }
  };

  return (
    <Card className="border-actid-blue/20">
      <CardContent className="py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Adaugă profil copil</h2>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {phase === "idle" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5"><ShieldCheck size={14} /> Verificare automată</p>
              <p className="text-xs">
                Sistemul caută în Registrul Civil înregistrările unde CNP-ul tău apare ca părinte sau tutore.
                Relația este verificată automat — nu ai nevoie să scanezi nimic.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={onCancel}>Anulează</Button>
              <Button className="flex-[2] gap-2" onClick={handleSearch}>
                <Search size={15} /> Caută copiii mei
              </Button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="py-10 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-4 border-actid-blue border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Se caută în Registrul Civil…</p>
          </div>
        )}

        {phase === "empty" && (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
              <Baby size={22} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Niciun copil găsit</p>
            <p className="text-xs text-muted-foreground">
              CNP-ul tău nu apare în nicio înregistrare din Registrul Civil.
              Dacă crezi că este o eroare, contactează Starea Civilă.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setPhase("idle")}>Înapoi</Button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-3">
            <Alert variant="error">{error}</Alert>
            <Button variant="secondary" size="sm" onClick={() => setPhase("idle")}>Înapoi</Button>
          </div>
        )}

        {phase === "results" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {results.length} {results.length === 1 ? "înregistrare găsită" : "înregistrări găsite"}
            </p>
            {results.map((child) => (
              <div key={child.registry_id} className={cn(
                "rounded-xl border p-3.5 flex items-center gap-3",
                child.already_linked ? "border-border bg-gray-50 opacity-60" : "border-actid-blue/20 bg-blue-50/30"
              )}>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Baby size={18} className="text-actid-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{child.child_full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(child.child_date_of_birth)} · {RECORD_TYPE_LABELS[child.record_type] ?? child.record_type}
                  </p>
                  {child.already_linked && (
                    <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                      <Check size={10} /> Deja adăugat
                    </p>
                  )}
                </div>
                {!child.already_linked && (
                  <Button
                    size="sm"
                    loading={linkingId === child.registry_id}
                    onClick={() => handleLink(child)}
                    className="flex-shrink-0 gap-1.5"
                  >
                    <Plus size={13} /> Adaugă
                  </Button>
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" className="w-full" onClick={onCancel}>Închide</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Add Guardian Modal ───────────────────────────────────────────────────────

function AddGuardianForm({
  childId,
  childName,
  onDone,
  onCancel,
}: {
  childId: string;
  childName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { addToast } = useNotificationStore();
  const [form, setForm] = useState({ guardian_email: "", relationship_type: "legal_guardian", proof_type: "court_order" });
  const [proofBase64, setProofBase64] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofBase64(await fileToBase64(file));
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.guardian_email) { setError("Introdu email-ul tutorelui"); return; }
    setSubmitting(true);
    try {
      await childrenApi.addGuardian(childId, { ...form, proof_image_base64: proofBase64 || undefined });
      addToast("Tutore adăugat cu succes", "success");
      onDone();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err.response?.data?.detail || "Eroare la adăugarea tutorelui");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <p className="text-xs font-semibold">Adaugă tutore pentru {childName}</p>
      {error && <Alert variant="error">{error}</Alert>}
      <Input
        label="Email tutore"
        type="email"
        value={form.guardian_email}
        onChange={(e) => setForm((f) => ({ ...f, guardian_email: e.target.value }))}
        placeholder="tutore@email.com"
      />
      <div>
        <p className="text-xs font-medium mb-1.5">Tip relație</p>
        <div className="flex gap-2">
          {[
            { key: "parent", label: "Părinte" },
            { key: "legal_guardian", label: "Tutore" },
            { key: "adoptive_parent", label: "Adoptiv" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, relationship_type: opt.key }))}
              className={cn(
                "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all",
                form.relationship_type === opt.key ? "border-actid-blue bg-blue-50 text-actid-blue" : "border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium mb-1.5">Tip dovadă</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { key: "court_order", label: "Hotărâre Judec." },
            { key: "adoption_decree", label: "Decret Adopție" },
            { key: "birth_certificate", label: "Cert. Naștere" },
            { key: "ci", label: "CI (14+)" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, proof_type: opt.key }))}
              className={cn(
                "py-1.5 rounded-lg border text-xs font-medium transition-all",
                form.proof_type === opt.key ? "border-actid-blue bg-blue-50 text-actid-blue" : "border-border"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full border border-dashed border-border rounded-xl py-2 text-xs text-muted-foreground flex items-center justify-center gap-1.5 hover:border-actid-blue hover:text-actid-blue transition-colors"
      >
        <Upload size={12} /> {proofBase64 ? "Document încărcat ✓" : "Încarcă document dovadă (opțional)"}
      </button>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={onCancel}>Anulează</Button>
        <Button size="sm" className="flex-1" loading={submitting} onClick={handleSubmit}>
          <UserPlus size={13} className="mr-1" /> Adaugă
        </Button>
      </div>
    </div>
  );
}

// ─── Child Card ───────────────────────────────────────────────────────────────

type DocSearchPhase = "idle" | "loading" | "results" | "empty";

function DocSearchPanel({ child, onAdded }: { child: ChildProfile; onAdded: () => void }) {
  const { addToast } = useNotificationStore();
  const [phase, setPhase] = useState<DocSearchPhase>("idle");
  const [docs, setDocs] = useState<GovDocResult[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const handleSearch = async () => {
    setPhase("loading");
    try {
      const res = await childrenApi.availableDocuments(child.id);
      const data: GovDocResult[] = res.data;
      setDocs(data);
      setPhase(data.length === 0 ? "empty" : "results");
    } catch {
      setPhase("idle");
      addToast("Eroare la căutarea documentelor", "error");
    }
  };

  const handleLink = async (doc: GovDocResult) => {
    setLinkingId(doc.gov_doc_id);
    try {
      await childrenApi.linkDocument(child.id, doc.gov_doc_id);
      addToast(`${DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] ?? doc.doc_type} adăugat`, "success");
      setDocs((prev) => prev.map((d) => d.gov_doc_id === doc.gov_doc_id ? { ...d, already_linked: true } : d));
      onAdded();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Eroare la adăugare", "error");
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="space-y-2">
      {phase === "idle" && (
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={handleSearch}>
          <Search size={12} /> Caută documente în registru
        </Button>
      )}
      {phase === "loading" && (
        <div className="py-3 text-center">
          <div className="inline-block w-5 h-5 border-2 border-actid-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground mt-1">Se caută în registru…</p>
        </div>
      )}
      {phase === "empty" && (
        <p className="text-xs text-muted-foreground italic text-center py-2">Niciun document disponibil în registrul guvernamental.</p>
      )}
      {phase === "results" && (
        <div className="space-y-1.5">
          {docs.map((doc) => (
            <div key={doc.gov_doc_id} className={cn(
              "flex items-center gap-2 text-xs rounded-lg px-3 py-2 border",
              doc.already_linked ? "bg-gray-50 border-border/40 opacity-60" : "bg-blue-50/40 border-actid-blue/20"
            )}>
              <DocTypeIcon type={doc.doc_type} size={13} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{(DOC_LABELS as Record<string, string>)[doc.doc_type] ?? doc.doc_type}</p>
                {doc.doc_number && <p className="font-mono text-muted-foreground text-[10px]">{doc.doc_number}</p>}
              </div>
              {doc.already_linked
                ? <span className="text-green-600 text-[10px] font-medium flex items-center gap-0.5"><Check size={9} /> Adăugat</span>
                : <Button size="sm" className="h-6 px-2 text-[10px]" loading={linkingId === doc.gov_doc_id} onClick={() => handleLink(doc)}>
                    <Plus size={10} /> Adaugă
                  </Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChildCard({ child, onRefresh }: { child: ChildProfile; onRefresh: () => void }) {
  const { addToast } = useNotificationStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showDocSearch, setShowDocSearch] = useState(false);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [requestingCarnet, setRequestingCarnet] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);

  const handleRemoveMe = async () => {
    try {
      await childrenApi.removeMeAsGuardian(child.id);
      addToast("Ai fost eliminat ca tutore", "success");
      onRefresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Eroare la eliminare", "error");
    }
  };

  const handleRequestStudentId = async () => {
    setRequestingCarnet(true);
    try {
      await childrenApi.requestStudentId(child.id);
      addToast("Carnet de elev adăugat din registru!", "success");
      onRefresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Carnet negăsit în registru", "error");
    } finally {
      setRequestingCarnet(false);
    }
  };

  const handleGenerateTransportCard = async () => {
    setGeneratingCard(true);
    try {
      await childrenApi.generateTransportCard(child.id);
      addToast("Card transport generat cu succes!", "success");
      onRefresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      addToast(err.response?.data?.detail || "Eroare", "error");
    } finally {
      setGeneratingCard(false);
    }
  };

  const hasTransportCard = child.documents.some((d) => d.doc_type === "CARD_TRANSPORT_ELEV");

  return (
    <div className={cn("rounded-2xl border overflow-hidden transition-shadow", open ? "border-actid-blue/30 shadow-sm" : "border-border")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-4 text-left bg-white hover:bg-gray-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-inset transition-colors"
      >
        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
          <Baby size={18} className="text-actid-blue" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{child.full_name}</p>
            {child.proof_verified
              ? <Badge variant="success">Verificat</Badge>
              : <Badge variant="warning">Neverificat</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <ChildAge dob={child.date_of_birth} /> · {formatDate(child.date_of_birth)} · {RELATIONSHIP_LABELS[child.relationship_type] ?? child.relationship_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {child.documents.length} {child.documents.length === 1 ? "document" : "documente"} · {child.guardians.length} {child.guardians.length === 1 ? "tutore" : "tutori"}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground transition-transform flex-shrink-0", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-border/60 bg-gray-50/30 px-4 py-3 space-y-4" onClick={(e) => e.stopPropagation()}>

          {/* Guardians */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tutori legali</p>
            <div className="space-y-1.5">
              {child.guardians.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-border/50">
                  <UserCheck size={12} className="text-actid-blue flex-shrink-0" />
                  <span className="font-medium flex-1">{g.guardian_name}</span>
                  <span className="text-muted-foreground">{RELATIONSHIP_LABELS[g.relationship_type] ?? g.relationship_type}</span>
                  {g.proof_verified
                    ? <ShieldCheck size={11} className="text-green-500" />
                    : <ShieldAlert size={11} className="text-amber-500" />}
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documente</p>
            {child.documents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Niciun document adăugat</p>
            ) : (
              <div className="space-y-1.5">
                {child.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-border/50">
                    <DocTypeIcon type={doc.doc_type} size={14} />
                    <span className="font-medium flex-1">{(DOC_LABELS as Record<string, string>)[doc.doc_type] ?? doc.doc_type}</span>
                    {doc.doc_number && <span className="font-mono text-muted-foreground">{doc.doc_number}</span>}
                    {doc.expires_date && <span className="text-muted-foreground">exp. {formatDate(doc.expires_date)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student ID (Carnet de elev) */}
          {(() => {
            const carnet = child.documents.find((d) => d.doc_type === "CARNET_ELEV");
            return (
              <div className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                carnet ? "bg-violet-50/50 border-violet-200" : "bg-gray-50 border-border/50"
              )}>
                <GraduationCap size={15} className={carnet ? "text-violet-600 flex-shrink-0" : "text-muted-foreground flex-shrink-0"} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">Carnet de elev</p>
                  {carnet ? (
                    <>
                      <p className="text-[10px] text-violet-700 font-mono mt-0.5">{carnet.doc_number}</p>
                      {carnet.issued_by && <p className="text-[10px] text-muted-foreground truncate">{carnet.issued_by}</p>}
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Niciun carnet înregistrat</p>
                  )}
                </div>
                {!carnet && (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1 flex-shrink-0"
                    loading={requestingCarnet}
                    onClick={handleRequestStudentId}
                  >
                    <Search size={11} /> Solicită
                  </Button>
                )}
              </div>
            );
          })()}

          {/* Transport card — shown only when child has a CARNET_ELEV */}
          {child.is_student && (
            <div className="flex items-center justify-between bg-blue-50/50 rounded-xl border border-actid-blue/20 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Bus size={14} className="text-actid-blue" />
                <div>
                  <p className="text-xs font-medium">Card Transport Elev</p>
                  {hasTransportCard && <p className="text-[10px] text-green-600 font-medium">Generat ✓</p>}
                </div>
              </div>
              {!hasTransportCard && (
                <Button size="sm" className="h-7 px-2.5 text-xs gap-1" loading={generatingCard} onClick={handleGenerateTransportCard}>
                  <Bus size={11} /> Generează
                </Button>
              )}
            </div>
          )}

          {/* Actions */}
          {!showDocSearch && !showAddGuardian && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => navigate(`/documents?child=${child.id}`)}>
                <Eye size={12} /> Documente
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowDocSearch(true)}>
                <FileText size={12} /> Adaugă document
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAddGuardian(true)}>
                <UserPlus size={12} /> Adaugă tutore
              </Button>
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-red-500 hover:text-red-700 ml-auto" onClick={handleRemoveMe}>
                <Trash2 size={12} /> Retrage-te
              </Button>
            </div>
          )}

          {showDocSearch && (
            <div className="pt-1 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Adaugă document din registru</p>
                <button type="button" onClick={() => setShowDocSearch(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <DocSearchPanel child={child} onAdded={() => { setShowDocSearch(false); onRefresh(); }} />
            </div>
          )}

          {showAddGuardian && (
            <AddGuardianForm
              childId={child.id}
              childName={child.full_name}
              onDone={() => { setShowAddGuardian(false); onRefresh(); }}
              onCancel={() => setShowAddGuardian(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FamilyPage() {
  const { addToast } = useNotificationStore();
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [myChildProfile, setMyChildProfile] = useState<MyChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await childrenApi.list();
      childrenApi.myProfile().then((r) => setMyChildProfile(r.data)).catch(() => setMyChildProfile(null));
      setChildren(res.data);
    } catch {
      addToast("Eroare la încărcarea datelor", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Familie</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Profiluri copii</p>
        </div>
        <Button size="sm" onClick={() => setShowAddChild(!showAddChild)} className="gap-1.5">
          {showAddChild ? <><X size={14} /> Anulează</> : <><Plus size={14} /> Adaugă copil</>}
        </Button>
      </div>

      {/* Banner for users who are themselves registered as minors (turned 14, created account) */}
      {myChildProfile && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50/60 to-pink-50/60">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Baby size={18} className="text-purple-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Profilul tău de minor</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ești înregistrat ca minor în sistemul ActID. La 18 ani accesul tutorelui se revocă automat.
                </p>
                <div className="mt-2 space-y-1.5">
                  {myChildProfile.guardians.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white/70 rounded-lg px-2.5 py-1.5 border border-purple-100">
                      <UserCheck size={11} className="text-purple-500 flex-shrink-0" />
                      <span className="font-medium flex-1">{g.guardian_name}</span>
                      <span className="text-muted-foreground capitalize">{RELATIONSHIP_LABELS[g.relationship_type] ?? g.relationship_type}</span>
                      {g.proof_verified
                        ? <ShieldCheck size={10} className="text-green-500" />
                        : <ShieldAlert size={10} className="text-amber-500" />}
                    </div>
                  ))}
                </div>
                {myChildProfile.documents.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {myChildProfile.documents.length} {myChildProfile.documents.length === 1 ? "document" : "documente"} gestionate de tutore
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add child wizard */}
      {showAddChild && (
        <AddChildWizard
          onCreated={(child) => {
            setChildren((prev) => [child, ...prev]);
            setShowAddChild(false);
          }}
          onCancel={() => setShowAddChild(false)}
        />
      )}

      {/* Children list */}
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
        ) : children.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Baby size={22} className="text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-semibold">Niciun profil de copil</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sistemul caută automat copiii tăi în Registrul Civil după CNP-ul tău.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddChild(true)}>
                <Plus size={13} className="mr-1.5" /> Adaugă copil
              </Button>
            </CardContent>
          </Card>
        ) : (
          children.map((child) => (
            <ChildCard key={child.id} child={child} onRefresh={load} />
          ))
        )}
      </div>
    </div>
  );
}
