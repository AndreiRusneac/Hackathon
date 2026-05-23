import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, Phone, Lock, ArrowLeft } from "lucide-react";
import { authApi, getErrMsg, identityApi, type ScanIdResult } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Alert, Button, Input } from "@/components/ui";
import IdScanner from "@/components/identity/IdScanner";
import LivenessCheck from "@/components/identity/LivenessCheck";

type Step = "details" | "scan_id" | "liveness" | "done";

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

    // TODO Task #3: open ID scan camera here
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
      if (!res.data.match) {
        setError(
          `Fețele nu se potrivesc (similaritate ${Math.round(res.data.score * 100)}%). Reia verificarea.`
        );
        setLoading(false);
        // Send the user back to redo the liveness check
        setStep("liveness");
        return;
      }
      await submitRegistration({
        ...draft,
        face_verified: true,
        face_match_score: res.data.score,
      });
    } catch (err) {
      setError(getErrMsg(err, "Verificarea facială a eșuat. Încearcă din nou."));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-actid-blue via-[#0041BF] to-[#1a56db] flex items-center justify-center p-4 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-3">
            <div className="text-center">
              <span className="block text-actid-blue font-black text-lg leading-none">AC</span>
              <span className="block text-actid-red font-black text-lg leading-none">TID</span>
            </div>
          </div>
          <h1 className="text-white font-bold text-xl">Înregistrare cont nou</h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {(["details", "scan_id", "liveness"] as Step[]).map((s, i) => {
            const order: Step[] = ["details", "scan_id", "liveness", "done"];
            const currentIdx = order.indexOf(step);
            const stepIdx = order.indexOf(s);
            const active = stepIdx <= currentIdx;
            return (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  active ? "bg-white w-8" : "bg-white/30 w-4"
                }`}
                aria-label={`Pasul ${i + 1}`}
              />
            );
          })}
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {step === "details" && (
            <form onSubmit={handleDetailsSubmit} className="p-6 space-y-4" noValidate>
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold">Datele tale</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Pasul 1 din 3 — informații de bază
                </p>
              </div>

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

              <Button type="submit" className="w-full" size="lg">
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
            <div className="p-6 space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold">Scanare buletin / pașaport</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Pasul 2 din 3 — așază documentul în cadru
                </p>
              </div>

              <IdScanner
                onSuccess={handleIdScanSuccess}
                onCancel={() => setStep("details")}
              />
            </div>
          )}

          {step === "liveness" && (
            <div className="p-6 space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-bold">Verificare biometrică</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Pasul 3 din 3 — confirmăm că ești o persoană reală
                </p>
              </div>

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

        <p className="text-center text-white/50 text-xs mt-6">
          Datele tale sunt protejate conform GDPR
        </p>
      </div>
    </div>
  );
}
