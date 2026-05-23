import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-actid-blue via-[#0041BF] to-[#1a56db] flex items-center justify-center p-6 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-2xl mb-5">
            <div className="text-center">
              <span className="block text-actid-blue font-black text-3xl leading-none">AC</span>
              <span className="block text-actid-red font-black text-3xl leading-none">TID</span>
            </div>
          </div>
          <h1 className="text-white font-bold text-3xl">ActID</h1>
          <p className="text-white/80 text-sm mt-2">
            Portofelul Digital al Cetățeanului Român
          </p>
        </div>

        {/* Welcome card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">Bine ai venit!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Continuă cu contul tău sau creează unul nou.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate("/login")}
              className="w-full"
              size="lg"
            >
              <LogIn size={18} aria-hidden="true" />
              Logheaza-te
            </Button>

            <Button
              onClick={() => navigate("/register")}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <UserPlus size={18} aria-hidden="true" />
              Înregistrare
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>Verificare biometrică · ROeID · GDPR</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          Conexiune securizată TLS 1.3 · GDPR compliant
        </p>
      </div>
    </div>
  );
}
