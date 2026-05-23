import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, getErrMsg } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button, Input, Alert } from "@/components/ui";

type Step = "credentials" | "2fa";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setSessionToken, sessionToken, demoOtp } = useAuthStore();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Step 1: Login ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier || !password) {
      setError("Completează toate câmpurile");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(identifier, password);
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

  // ── Step 2: 2FA ────────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (newOtp.every((d) => d !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join("");
    if (otpCode.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verify2fa(sessionToken!, otpCode);
      const data = res.data;
      setUser(data.user, data.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrMsg(err, "Cod OTP incorect"));
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-actid-blue via-[#0041BF] to-[#1a56db] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <div className="text-center">
              <span className="block text-actid-blue font-black text-2xl leading-none">AC</span>
              <span className="block text-actid-red font-black text-2xl leading-none">TID</span>
            </div>
          </div>
          <h1 className="text-white font-bold text-2xl">ActID</h1>
          <p className="text-white/70 text-sm mt-1">Portofelul Digital al Cetățeanului Român</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {step === "credentials" ? (
            <form onSubmit={handleLogin} className="p-6 space-y-4" noValidate>
              {/* ROeID branding */}
              <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-2xl border border-gray-100 mb-2">
                <div className="w-8 h-5 bg-gradient-to-r from-actid-blue via-yellow-400 to-actid-red rounded-sm" />
                <div>
                  <p className="text-xs font-bold text-gray-700 leading-tight">ROeID</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Sistem Național de Autentificare</p>
                </div>
              </div>

              <h2 className="text-lg font-bold text-foreground text-center">Autentificare</h2>

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

              {/* Demo hint */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs text-blue-700 font-semibold mb-1">Conturi demo:</p>
                <div className="space-y-1">
                  {[
                    { email: "ion.popescu@gmail.com", label: "Ion (buletin expiră curând)" },
                    { email: "alex.ionescu@gmail.com", label: "Alex (diaspora Londra)" },
                    { email: "functionar@spclep.ro", label: "Funcționar SPCLEP" },
                  ].map((u) => (
                    <button
                      key={u.email}
                      type="button"
                      onClick={() => { setIdentifier(u.email); setPassword("Parola@123"); }}
                      className="w-full text-left text-xs text-blue-600 hover:text-blue-800 py-0.5 transition-colors"
                    >
                      → {u.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-blue-500 mt-1">Parolă: Parola@123</p>
              </div>
            </form>
          ) : (
            <div className="p-6 space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                </div>
                <h2 className="text-lg font-bold">Verificare în 2 pași</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Bună, <span className="font-semibold text-foreground">{userName}</span>!
                </p>
                <p className="text-xs text-muted-foreground mt-1">{otpMessage}</p>
              </div>

              {/* Demo OTP banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-700 font-medium">Cod demo (nu pentru producție)</p>
                <p className="text-2xl font-mono font-bold text-amber-800 tracking-widest mt-1">
                  {demoOtp}
                </p>
              </div>

              {error && <Alert variant="error">{error}</Alert>}

              {/* OTP input */}
              <div>
                <p className="text-sm font-medium text-center mb-3">Introdu codul de 6 cifre</p>
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
                onClick={() => { setStep("credentials"); setError(""); setOtp(["","","","","",""]); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Înapoi
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          Conexiune securizată TLS 1.3 · GDPR compliant
        </p>
      </div>
    </div>
  );
}
