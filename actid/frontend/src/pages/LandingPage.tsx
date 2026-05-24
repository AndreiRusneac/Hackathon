import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, ShieldCheck, Lock } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[100dvh] bg-background grid place-items-center p-5 safe-top safe-bottom">
      <div className="w-full max-w-[440px]">

        {/* Card — logo integrated at top, premium shadow, no border */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_28px_-2px_rgba(0,43,127,0.13),0_2px_8px_-2px_rgba(0,0,0,0.06)]">

          <div className="px-6 sm:px-10 pt-9 sm:pt-11 pb-8 sm:pb-10 flex flex-col gap-8">

            {/* Brand — anchors the card */}
            <div className="flex items-center justify-center gap-2.5">
              <div
                className="w-9 h-9 bg-actid-blue rounded-xl flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <span className="text-white font-black text-sm select-none">ID</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-foreground">ActID</span>
            </div>

            {/* Heading */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Bine ai venit!
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Continuă cu contul tău sau creează unul nou.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => navigate("/login")}
                aria-label="Loghează-te în contul tău"
                className="w-full h-12 flex items-center justify-center gap-2 bg-actid-blue text-white text-sm font-semibold rounded-xl transition-all hover:bg-actid-blue-light active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-offset-2"
              >
                <LogIn size={17} aria-hidden="true" />
                Loghează-te
              </button>

              <button
                onClick={() => navigate("/register")}
                aria-label="Creează un cont nou"
                className="w-full h-12 flex items-center justify-center gap-2 bg-white border border-actid-blue/20 text-actid-blue text-sm font-semibold rounded-xl transition-all hover:bg-blue-50/50 hover:border-actid-blue/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-actid-blue focus-visible:ring-offset-2"
              >
                <UserPlus size={17} aria-hidden="true" />
                Înregistrare
              </button>
            </div>

          </div>

          {/* Footer */}
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
