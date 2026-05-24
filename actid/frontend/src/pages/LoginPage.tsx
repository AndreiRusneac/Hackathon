import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, ChevronRight, Smartphone, ShieldCheck, Lock,
} from "lucide-react";
import { authApi, getErrMsg } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Input, Alert } from "@/components/ui";

type Step = "credentials" | "2fa";

const DEMO_ACCOUNTS = [
  { email: "ion.popescu@gmail.com",  initials: "IP", label: "Ion Popescu",       sublabel: "Buletin expiră curând", color: "bg-amber-500"  },
  { email: "alex.ionescu@gmail.com", initials: "AI", label: "Alex Ionescu",      sublabel: "Diaspora Londra",       color: "bg-teal-600"   },
  { email: "functionar@spclep.ro",   initials: "FS", label: "Funcționar SPCLEP", sublabel: "Verificare documente",  color: "bg-purple-600" },
] as const;

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

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
      const destination = next !== "/dashboard" ? next : data.user.role === "funcționar" ? "/functionar" : "/dashboard";
      navigate(destination, { replace: true });
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
    <div className="min-h-[100dvh] bg-background grid place-items-center p-5 safe-top safe-bottom">
      <div className="w-full max-w-[440px]">

        {/* Logo above card — matches LandingPage */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="w-9 h-9 bg-actid-blue rounded-xl flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <span className="text-white font-black text-sm select-none">ID</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">ActID</span>
        </div>

        {/* Card — same shadow/radius as LandingPage */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_28px_-2px_rgba(0,43,127,0.13),0_2px_8px_-2px_rgba(0,0,0,0.06)]">

          {step === "credentials" ? (
            <>
              {/* Form */}
              <form onSubmit={handleLogin} className="px-6 sm:px-10 pt-8 sm:pt-9 pb-7 sm:pb-8 space-y-5" noValidate>

                <div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">Autentificare</h1>
                  <p className="text-sm text-muted-foreground mt-1">Intră în contul tău ActID</p>
                </div>

                {error && <Alert variant="error">{error}</Alert>}

                <div className="space-y-3">
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
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-actid-blue text-white text-sm font-semibold rounded-xl transition-all hover:bg-actid-blue-light active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-offset-2"
                  >
                    {loading && <Spinner />}
                    Autentifică-te
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="w-full h-10 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded-xl"
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                    Înapoi
                  </button>
                </div>
              </form>

              {/* Demo accounts */}
              <div className="border-t border-border/60 bg-secondary/40 px-6 sm:px-10 py-6 sm:py-7">
                <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-widest mb-4">
                  Conturi demo
                </p>
                <div className="space-y-0.5">
                  {DEMO_ACCOUNTS.map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => fillDemo(u.email)}
                      className="w-full flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-background/70 transition-colors text-left group"
                      aria-label={`Folosește contul demo: ${u.label}`}
                    >
                      <div
                        className={`w-9 h-9 ${u.color} rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none`}
                        aria-hidden="true"
                      >
                        {u.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">{u.label}</p>
                        <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{u.sublabel}</p>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/50 mt-5 pt-4 border-t border-border/40">
                  Parolă: <span className="font-mono">Parola@123</span> · 2FA: <span className="font-mono">123456</span>
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 sm:px-10 py-4 border-t border-border/60 flex items-center justify-center gap-5">
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
            </>
          ) : (

            /* ── 2FA step ── */
            <div className="px-6 sm:px-10 pt-8 sm:pt-9 pb-7 sm:pb-8 space-y-6">

              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center mx-auto">
                  <Smartphone size={22} className="text-actid-blue" aria-hidden="true" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Verificare în 2 pași</h1>
                <p className="text-sm text-muted-foreground">
                  Bună, <span className="font-semibold text-foreground">{userName}</span>!
                </p>
                {otpMessage && (
                  <p className="text-xs text-muted-foreground">{otpMessage}</p>
                )}
              </div>

              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-amber-700 font-medium">Cod demo</p>
                  <p className="text-xs text-amber-600">Nu pentru producție</p>
                </div>
                <p className="text-2xl font-mono font-bold text-amber-800 tracking-widest">{demoOtp}</p>
              </div>

              {error && <Alert variant="error">{error}</Alert>}

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

              <div className="space-y-2.5">
                <button
                  onClick={() => handleVerify()}
                  disabled={otp.some((d) => !d) || loading}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-actid-blue text-white text-sm font-semibold rounded-xl transition-all hover:bg-actid-blue-light active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-offset-2"
                >
                  {loading && <Spinner />}
                  Verifică și intră
                </button>

                <button
                  onClick={() => { setStep("credentials"); setError(""); setOtp(["", "", "", "", "", ""]); }}
                  className="w-full h-10 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue rounded-xl"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Înapoi
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
