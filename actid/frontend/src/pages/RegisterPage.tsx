import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, Phone, Lock, ArrowLeft, ShieldCheck } from "lucide-react";
import { authApi, getErrMsg, identityApi, type ScanIdResult } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Alert, Button, Input } from "@/components/ui";
import IdScanner from "@/components/identity/IdScanner";
import LivenessCheck from "@/components/identity/LivenessCheck";

type Step = "details" | "scan_id" | "liveness" | "done";

const STEP_META: Record<Step, { title: string; subtitle: string }> = {
  details:  { title: "Datele tale",           subtitle: "Pasul 1 din 3 — informații de bază" },
  scan_id:  { title: "Scanează documentul",   subtitle: "Pasul 2 din 3 — așază buletinul în cadru" },
  liveness: { title: "Verificare biometrică", subtitle: "Pasul 3 din 3 — confirmăm că ești o persoană reală" },
  done:     { title: "Gata",                  subtitle: "" },
};

export interface RegisterDraft {
  full_name: string;
  phone: string;
  password: string;
  // Filled later by Task #3 (ID scan)
  cnp?: string;
  email?: string;
  id_verified?: boolean;
  id_photo_base64?: string;
  // Filled later by Task #4 (liveness + face match)
  face_verified?: boolean;
  face_match_score?: number;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [step, setStep] = useState<Step>("details");
  const [draft, setDraft] = useState<RegisterDraft>({
    full_name: "",
    phone: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: Details form ─────────────────────────────────────────────────
  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!draft.full_name.trim() || draft.full_name.trim().length < 3) {
      setError("Numele complet trebuie să aibă cel puțin 3 caractere");
      return;
    }
    if (!/^[+\d\s-]{7,}$/.test(draft.phone.trim())) {
      setError("Numărul de telefon nu este valid");
      return;
    }
    if (draft.password.length < 6) {
      setError("Parola trebuie să aibă minim 6 caractere");
      return;
    }
    if (draft.password !== confirmPassword) {
      setError("Parolele nu coincid");
      return;
    }

    setStep("scan_id");
  };

  // ── Final: send to backend, auto-login ──────────────────────────────────
  const submitRegistration = async (finalDraft: RegisterDraft) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.register({
        full_name: finalDraft.full_name,
        phone: finalDraft.phone,
        password: finalDraft.password,
        cnp: finalDraft.cnp,
        email: finalDraft.email,
        id_verified: finalDraft.id_verified ?? false,
        face_verified: finalDraft.face_verified ?? false,
        face_match_score: finalDraft.face_match_score,
      });
      const data = res.data;
      setUser(data.user, data.access_token);
      setStep("done");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrMsg(err, "Înregistrarea a eșuat. Încearcă din nou."));
    } finally {
      setLoading(false);
    }
  };

  // ── ID scan success → store extracted fields, advance to liveness ───────
  const handleIdScanSuccess = (scan: ScanIdResult) => {
    setDraft((d) => ({
      ...d,
      full_name: scan.full_name || d.full_name,
      cnp: scan.cnp ?? d.cnp,
      id_verified: true,
      id_photo_base64: scan.id_face_base64 ?? d.id_photo_base64,
    }));
    setStep("liveness");
  };

  // ── Liveness done → compare selfie to ID face → register ────────────────
  const handleLivenessSuccess = async (selfieBase64: string) => {
    setError("");
    if (!draft.id_photo_base64) {
      // No ID face available (shouldn't happen if scan succeeded). Skip the match
      // step and register without face verification flag.
      submitRegistration({ ...draft, face_verified: false });
      return;
    }
    setLoading(true);
    try {
      const res = await identityApi.verifyFace(draft.id_photo_base64, selfieBase64);
      if (!res.data.match && !res.data.fallback) {
        setError(
          `Fețele nu se potrivesc (similaritate ${Math.round(res.data.score * 100)}%). Reia verificarea.`
        );
        setLoading(false);
        // Send the user back to redo the liveness check
        setStep("liveness");
        return;
      }
      // Fallback path = backend couldn't actually compare (e.g. face_recognition
      // not installed). Treat as unverified but let registration proceed.
      await submitRegistration({
        ...draft,
        face_verified: !res.data.fallback,
        face_match_score: res.data.fallback ? undefined : res.data.score,
      });
    } catch (err) {
      setError(getErrMsg(err, "Verificarea facială a eșuat. Încearcă din nou."));
      setLoading(false);
    }
  };

  const meta = STEP_META[step];

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-5 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-[440px]">

        {/* Card — single white surface, brand integrated at top, premium shadow */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_28px_-2px_rgba(0,43,127,0.13),0_2px_8px_-2px_rgba(0,0,0,0.06)]">

          {/* Header — brand, dynamic title, step progress */}
          <div className="px-6 sm:px-10 pt-9 sm:pt-11 pb-6 flex flex-col gap-6">

            {/* Brand — matches the landing lockup */}
            <div className="flex items-center justify-center gap-2.5">
              <div
                className="w-9 h-9 bg-actid-blue rounded-xl flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <span className="text-white font-black text-sm select-none">ID</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-foreground">ActID</span>
            </div>

            {/* Title */}
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{meta.title}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{meta.subtitle}</p>
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
              {(["details", "scan_id", "liveness"] as Step[]).map((s) => {
                const order: Step[] = ["details", "scan_id", "liveness", "done"];
                const active = order.indexOf(s) <= order.indexOf(step);
                return (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      active ? "bg-actid-blue w-8" : "bg-actid-blue/15 w-4"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 sm:px-10 pb-8 sm:pb-10">
            {step === "details" && (
              <form onSubmit={handleDetailsSubmit} className="space-y-4" noValidate>
                {error && <Alert variant="error">{error}</Alert>}

                <Input
                  label="Nume complet"
                  type="text"
                  icon={<UserIcon size={16} />}
                  value={draft.full_name}
                  onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
                  placeholder="Ion Popescu"
                  autoComplete="name"
                />

                <Input
                  label="Telefon"
                  type="tel"
                  icon={<Phone size={16} />}
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="+40 712 345 678"
                  autoComplete="tel"
                />

                <Input
                  label="Parolă"
                  type="password"
                  icon={<Lock size={16} />}
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  placeholder="Minim 6 caractere"
                  autoComplete="new-password"
                />

                <Input
                  label="Confirmă parola"
                  type="password"
                  icon={<Lock size={16} />}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Reintrodu parola"
                  autoComplete="new-password"
                />

                <Button type="submit" size="lg" className="w-full h-14 text-base font-bold">
                  Continuă
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Înapoi
                </button>
              </form>
            )}

            {step === "scan_id" && (
              <IdScanner
                onSuccess={handleIdScanSuccess}
                onCancel={() => setStep("details")}
              />
            )}

            {step === "liveness" && (
              <div className="space-y-4">
                {error && <Alert variant="error">{error}</Alert>}

                {loading ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="inline-block w-10 h-10 border-4 border-actid-blue border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Se compară cu fotografia din document…
                    </p>
                  </div>
                ) : (
                  <LivenessCheck
                    onSuccess={handleLivenessSuccess}
                    onCancel={() => setStep("scan_id")}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer — security assurances, matches landing */}
          <div className="px-6 sm:px-10 py-4 sm:py-5 border-t border-border/60 flex items-center justify-center gap-5">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <ShieldCheck size={11} aria-hidden="true" />
              GDPR
            </span>
            <span className="w-px h-3 bg-border/60" aria-hidden="true" />
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Lock size={11} aria-hidden="true" />
              TLS 1.3
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
