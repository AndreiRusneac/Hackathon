import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    // CONSISTENCY: gradient anchored to sidebar navy (#002B7F) — darker top for depth
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#001850] via-actid-blue to-[#0033A0] flex items-center justify-center p-6 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm">

        {/* CONSISTENCY: shadow + radius match dashboard document cards */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Top accent strip in brand blue */}
          <div className="h-1 bg-actid-blue" aria-hidden="true" />

          {/* CONSISTENCY: p-8 matches dashboard card spacing (~32px) */}
          <div className="p-8 space-y-6">

            {/* Wordmark — matches SideNav brand block exactly */}
            {/* CONSISTENCY: same logo pattern as sidebar header */}
            <div className="flex items-center gap-3 justify-center">
              <div
                className="w-10 h-10 bg-actid-blue rounded-xl flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <span className="text-white font-black text-sm select-none">ID</span>
              </div>
              <div>
                <p className="font-bold text-xl leading-tight tracking-tight text-foreground">ActID</p>
                <p className="text-xs text-muted-foreground leading-tight">Portofelul Digital Român</p>
              </div>
            </div>

            {/* Heading + subtitle */}
            <div className="text-center">
              {/* CONSISTENCY: tracking-tight + font-bold matches dashboard page headings */}
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Bine ai venit!</h1>
              {/* CONSISTENCY: text-sm text-muted-foreground matches dashboard secondary text */}
              <p className="text-sm text-muted-foreground mt-1.5">
                Continuă cu contul tău sau creează unul nou.
              </p>
            </div>

            {/* Buttons */}
            {/* CONSISTENCY: space-y-2 — 8px gap between buttons */}
            <div className="space-y-2">
              {/* A11Y: explicit aria-label in Romanian; size="lg" = h-13 (52px) > 48px min */}
              <Button
                onClick={() => navigate("/login")}
                className="w-full"
                size="lg"
                aria-label="Loghează-te în contul tău"
              >
                <LogIn size={18} aria-hidden="true" />
                {/* FIX: diacritice — "Logheaza-te" → "Loghează-te" */}
                Loghează-te
              </Button>

              {/* A11Y: explicit aria-label in Romanian */}
              <Button
                onClick={() => navigate("/register")}
                variant="outline"
                className="w-full"
                size="lg"
                aria-label="Creează un cont nou"
              >
                <UserPlus size={18} aria-hidden="true" />
                Înregistrare
              </Button>
            </div>

            {/* Trust indicators — inside card */}
            <div className="space-y-2.5 pt-1 border-t border-border">
              {/* CONSISTENCY: text-xs text-muted-foreground matches dashboard footer items */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                <ShieldCheck size={13} aria-hidden="true" />
                <span>Verificare biometrică · ROeID · GDPR</span>
              </div>
              {/* A11Y: lock icon decorative; text moved inside card for better contrast */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
                <Lock size={11} aria-hidden="true" />
                <span>Conexiune securizată TLS 1.3</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
