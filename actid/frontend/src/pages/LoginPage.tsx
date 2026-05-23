import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Smartphone, ShieldCheck, Lock,
} from "lucide-react";
import { authApi, getErrMsg } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, Alert } from "@/components/ui";

type Step = "credentials" | "2fa";

const DEMO_ACCOUNTS = [
  { email: "ion.popescu@gmail.com",  initials: "IP", label: "Ion Popescu",       sublabel: "Buletin expiră curând", color: "bg-amber-500"  },
  { email: "alex.ionescu@gmail.com", initials: "AI", label: "Alex Ionescu",      sublabel: "Diaspora Londra",       color: "bg-teal-600"   },
  { email: "functionar@spclep.ro",   initials: "FS", label: "Funcționar SPCLEP", sublabel: "Verificare documente",  color: "bg-purple-600" },
] as const;

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const next      = new URLSearchParams(location.search).get("next") || "/dashboard";
  const { setUser, setSessionToken, sessionToken, demoOtp } = useAuthStore();

  const [step,       setStep]       = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [otp,        setOtp]        = useState(["", "", "", "", "", ""]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [userName,   setUserName]   = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier || !password) { setError("Completează toate câmpurile"); return; }
    setLoading(true);
    try {
      const res  = await authApi.login(identifier, password);
      const data = res.data;
      setSessionToken(data.session_token, data.demo_otp);
      setUserName(data.user_name);
      setOtpMessage(data.message);
      setStep("2fa");
    } catch (err) {
      setError(getErrMsg(err, "Autentificare eșuată. Verifică datele."));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== "")) handleVerify(next.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      otpRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join("");
    if (otpCode.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const res  = await authApi.verify2fa(sessionToken!, otpCode);
      const data = res.data;
      setUser(data.user, data.access_token);
      navigate(next, { replace: true });
    } catch (err) {
      setError(getErrMsg(err, "Cod OTP incorect"));
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email: string) => {
    setIdentifier(email);
    setPassword("Parola@123");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-sm">

        {/* Wordmark above card — sits on the page, not inside */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-8 h-8 bg-actid-blue rounded-lg flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <span className="text-white font-black text-xs select-none">ID</span>
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">ActID</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">

          {step === "credentials" ? (
            <>
              {/* Form section */}
              <form onSubmit={handleLogin} className="px-6 pt-6 pb-5 space-y-4" noValidate>

                {/* ROeID badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg border border-border">
                  <div className="flex gap-px flex-shrink-0" aria-hidden="true">
                    <span className="w-2.5 h-4 bg-actid-blue rounded-sm" />
                    <span className="w-2.5 h-4 bg-yellow-400 rounded-sm" />
                    <span className="w-2.5 h-4 bg-actid-red rounded-sm" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground leading-tight">ROeID</p>
                    <p className="text-xs text-muted-foreground leading-tight">Sistem Național de Autentificare</p>
                  </div>
                </div>

                <div>
                  <h1 className="text-xl font-bold text-foreground tracking-tight">Autentificare</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">Intră în contul tău ActID</p>
                </div>

                {error && <Alert variant="error">{error}</Alert>}

                <Input
                  label="Email sau CNP"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ion.popescu@gmail.com"
                  autoComplete="username"
                  aria-label="Email sau CNP"
                />

                <Input
                  label="Parolă"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-label="Parolă"
                />

                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Autentifică-te cu ROeID
                </Button>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Înapoi
                </button>
              </form>

              {/* Demo section — separated visually, neutral tone */}
              <div className="border-t border-border bg-secondary/50 px-6 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Conturi demo
                </p>
                <div className="space-y-1">
                  {DEMO_ACCOUNTS.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => fillDemo(u.email)}
                      className="w-full flex items-center gap-3 py-2 px-2.5 rounded-xl hover:bg-secondary transition-colors text-left group"
                      aria-label={`Folosește contul demo: ${u.label}`}
                    >
                      <div
                        className={`w-8 h-8 ${u.color} rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none`}
                        aria-hidden="true"
                      >
                        {u.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">{u.label}</p>
                        <p className="text-xs text-muted-foreground truncate leading-tight">{u.sublabel}</p>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                  Parolă: <span className="font-mono">Parola@123</span> · 2FA: <span className="font-mono">123456</span>
                </p>
              </div>

              {/* Card footer */}
              <div className="px-6 py-3 border-t border-border flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} aria-hidden="true" />
                  ROeID · GDPR
                </span>
                <span className="w-px h-3 bg-border" aria-hidden="true" />
                <span className="flex items-center gap-1.5">
                  <Lock size={12} aria-hidden="true" />
                  TLS 1.3
                </span>
              </div>
            </>
          ) : (
            <div className="px-6 pt-6 pb-5 space-y-5">

              {/* 2FA header */}
              <div className="text-center">
                <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Smartphone size={22} className="text-actid-blue" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">Verificare în 2 pași</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Bună, <span className="font-semibold text-foreground">{userName}</span>!
                </p>
                {otpMessage && (
                  <p className="text-xs text-muted-foreground mt-0.5">{otpMessage}</p>
                )}
              </div>

              {/* Demo OTP — neutral amber, not competing with form */}
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-amber-700 font-medium">Cod demo</p>
                  <p className="text-xs text-amber-600">Nu pentru producție</p>
                </div>
                <p className="text-2xl font-mono font-bold text-amber-800 tracking-widest">{demoOtp}</p>
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              {/* OTP inputs */}
              <div>
                <p className="text-sm font-medium text-foreground text-center mb-3">
                  Introdu codul de 6 cifre
                </p>
                <div className="flex gap-2 justify-center" role="group" aria-label="Cod OTP">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      className="otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      aria-label={`Cifra ${i + 1}`}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
              </div>

              <Button
                onClick={() => handleVerify()}
                loading={loading}
                disabled={otp.some((d) => !d)}
                className="w-full"
                size="lg"
              >
                Verifică și intră
              </Button>

              <button
                onClick={() => { setStep("credentials"); setError(""); setOtp(["", "", "", "", "", ""]); }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                Înapoi
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
