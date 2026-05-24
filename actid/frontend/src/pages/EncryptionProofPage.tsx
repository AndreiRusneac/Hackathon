/**
 * EncryptionProofPage — hidden demo route.
 *
 * Accesibilă DOAR prin URL direct:
 *   /debug/encryption-proof              → picker (lista documentelor tale)
 *   /debug/encryption-proof/:docId       → view side-by-side
 *
 * NU apare în navigare. Necesită autentificare (owner-only pe backend).
 * Folosită pentru a dovedi juriului că serverul nu vede plaintext-ul:
 * panoul stâng arată ciphertext-ul din DB, panoul drept arată ce vezi tu
 * după decriptarea cu cheia ta personală derivată (HKDF + user_id).
 */
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Lock, ShieldAlert, ServerCog, User as UserIcon,
  ChevronRight, ArrowLeft, AlertTriangle, KeyRound, Hash,
} from "lucide-react";
import { debugApi, type RawDocumentView, type DebugDocListItem } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { DOC_LABELS } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string | null, n = 64): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function statusBadge(status: string | null) {
  if (status === "v2") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
        <Lock size={9} /> v2 per-user
      </span>
    );
  }
  if (status === "v1") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
        <Lock size={9} /> v1 global
      </span>
    );
  }
  if (status === "plain") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
        <AlertTriangle size={9} /> plaintext
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
      null
    </span>
  );
}

// ─── Demo banner shared by all states ────────────────────────────────────────

function DemoBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-2 border-dashed border-amber-300 rounded-2xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <ShieldAlert size={20} className="text-amber-700" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm text-amber-900">
            🔒 PAGINĂ DEMO — Ascunsă din aplicația publică
          </p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Această pagină dovedește criptarea documentelor. NU este accesibilă din meniu.
            Vezi exact ce stochează serverul (ciphertext) vs ce vezi tu (plaintext după decriptare).
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Picker (no docId in URL) ────────────────────────────────────────────────

function DocumentPicker() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ user_name: string; documents: DebugDocListItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugApi.myDocsList()
      .then((res) => setData(res.data))
      .catch(() => setError("Eroare la încărcare. Verifică că ești logat."));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <DemoBanner />
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Lock size={22} className="text-actid-blue" /> Dovadă de criptare — alege un document
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Selectează un document din portofelul tău pentru a vedea side-by-side ce e în DB vs ce vezi tu.
      </p>

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {error}
        </div>
      )}

      {!data ? (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : data.documents.length === 0 ? (
        <div className="mt-6 p-8 text-center bg-gray-50 rounded-2xl">
          <p className="font-semibold">Nu ai niciun document.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Solicită unul din pagina <Link to="/documents" className="text-actid-blue underline">Documente</Link>.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {data.documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/debug/encryption-proof/${doc.id}`)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-white hover:border-actid-blue text-left transition-colors"
            >
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{doc.id}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-muted-foreground">doc_number:</span>
                  {statusBadge(doc.doc_number_status)}
                  {doc.cnp_status && (
                    <>
                      <span className="text-[10px] text-muted-foreground ml-2">cnp:</span>
                      {statusBadge(doc.cnp_status)}
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Side-by-side viewer ─────────────────────────────────────────────────────

function SideBySideViewer({ docId }: { docId: string }) {
  const navigate = useNavigate();
  const [view, setView] = useState<RawDocumentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    setError(null);
    debugApi.rawDocument(docId)
      .then((res) => setView(res.data))
      .catch((e: { response?: { status?: number; data?: { detail?: string } } }) => {
        if (e.response?.status === 404) {
          setError("Document inexistent sau nu îți aparține.");
        } else {
          setError(e.response?.data?.detail || "Eroare la încărcare.");
        }
      });
  }, [docId]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <DemoBanner />
        <button
          onClick={() => navigate("/debug/encryption-proof")}
          className="text-sm text-actid-blue inline-flex items-center gap-1 mb-4 hover:underline"
        >
          <ArrowLeft size={14} /> Înapoi la lista documentelor
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-800">
          {error}
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <DemoBanner />
        <div className="space-y-3">
          <div className="h-8 skeleton rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-96 skeleton rounded-2xl" />
            <div className="h-96 skeleton rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const fields = ["doc_number", "issued_by", "description", "cnp", "photo_base64"] as const;
  const fieldLabels: Record<string, string> = {
    doc_number: "Număr document",
    issued_by: "Emis de",
    description: "Descriere",
    cnp: "CNP",
    photo_base64: "Poză document",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <DemoBanner />

      <button
        onClick={() => navigate("/debug/encryption-proof")}
        className="text-sm text-actid-blue inline-flex items-center gap-1 mb-4 hover:underline"
      >
        <ArrowLeft size={14} /> Înapoi la lista documentelor
      </button>

      {/* Header info */}
      <div className="bg-white border border-border rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Document</p>
            <h1 className="text-xl font-bold mt-0.5">
              {DOC_LABELS[view.plaintext_fields.doc_type as keyof typeof DOC_LABELS] || view.plaintext_fields.doc_type}
            </h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">{view.doc_id}</p>
          </div>
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-actid-blue" />
            <span className="text-xs font-mono text-muted-foreground">
              {view.encryption.algorithm} · {view.encryption.key_derivation}
            </span>
          </div>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SERVER VIEW — encrypted */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-black/30 border-b border-white/10 flex items-center gap-2">
            <ServerCog size={18} className="text-red-400" />
            <div className="min-w-0">
              <p className="font-bold text-sm">Ce vede SERVERUL (DB row)</p>
              <p className="text-[11px] text-slate-400">Stocat brut în SQLite</p>
            </div>
          </div>
          <div className="p-4 space-y-3 font-mono text-[11px] leading-relaxed">
            {fields.map((f) => (
              <div key={f}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">{f}:</span>
                  {statusBadge(view.encryption.per_field_status[f])}
                </div>
                <p className="break-all text-amber-200 bg-black/30 p-2 rounded">
                  {truncate(view.server_view[f], 120) || "null"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* USER VIEW — decrypted */}
        <section className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-green-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-green-100/60 border-b border-green-200 flex items-center gap-2">
            <UserIcon size={18} className="text-green-700" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-green-900">Ce vezi TU (decriptat)</p>
              <p className="text-[11px] text-green-700">Decriptat în memorie cu cheia ta</p>
            </div>
          </div>
          <div className="p-4 space-y-3 text-sm">
            {fields.map((f) => (
              <div key={f}>
                <p className="text-xs text-green-800 font-semibold mb-1">{fieldLabels[f]}:</p>
                <p className="break-all text-foreground bg-white/70 p-2 rounded border border-green-100">
                  {view.user_view[f] || <span className="italic text-muted-foreground">(gol)</span>}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Plaintext fields (indexable) */}
      <div className="mt-5 bg-blue-50/40 border border-blue-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Hash size={16} className="text-blue-700" />
          <p className="font-bold text-sm text-blue-900">Câmpuri în plaintext (necesare pentru index / filtre / notificări)</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {Object.entries(view.plaintext_fields).map(([k, v]) => (
            <div key={k}>
              <p className="text-blue-700 font-mono text-[10px] uppercase tracking-wider">{k}</p>
              <p className="font-mono text-foreground mt-0.5 truncate">{String(v ?? "null")}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-blue-700 mt-3 italic">
          Aceste câmpuri rămân în clar pentru ca serverul să poată calcula expirarea,
          filtra după tip, și genera notificări — fără să le criptăm pierdem aceste funcții.
        </p>
      </div>

      {/* Crypto details */}
      <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-slate-700" />
          <p className="font-bold text-sm">Detalii criptare</p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-muted-foreground">Algoritm</dt>
            <dd className="font-mono font-semibold">{view.encryption.algorithm}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-muted-foreground">Derivare cheie</dt>
            <dd className="font-mono font-semibold">HKDF-SHA256</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-muted-foreground">Lungime cheie</dt>
            <dd className="font-mono font-semibold">256 bits</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1">
            <dt className="text-muted-foreground">Auth tag</dt>
            <dd className="font-mono font-semibold">GCM 128 bits</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1 col-span-full">
            <dt className="text-muted-foreground">Input HKDF (info)</dt>
            <dd className="font-mono font-semibold break-all text-right">{view.encryption.key_fingerprint}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-200 py-1 col-span-full">
            <dt className="text-muted-foreground">user_id (input HKDF)</dt>
            <dd className="font-mono font-semibold break-all text-right">{view.encryption.user_id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// ─── Page (router gate) ──────────────────────────────────────────────────────

export default function EncryptionProofPage() {
  const { docId } = useParams<{ docId?: string }>();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login?next=/debug/encryption-proof" replace />;
  }
  return docId ? <SideBySideViewer docId={docId} /> : <DocumentPicker />;
}
