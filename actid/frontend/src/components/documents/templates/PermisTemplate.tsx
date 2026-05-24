/**
 * PermisTemplate — Romanian driving licence (EU model, pink theme).
 * ISO/IEC 7810 ID-1 size, EU stars at top-left.
 */
import type { Document } from "@/types";
import { formatDate } from "@/lib/utils";
import { DemoWatermark } from "./CITemplate";

const DEFAULT_CATEGORIES = ["B", "BE"];

export function PermisTemplate({ doc, fullName, userCnp }: {
  doc: Document;
  fullName: string;
  userCnp?: string;
}) {
  const cnp = doc.cnp || userCnp || "";
  const [given, family] = splitName(fullName);
  const birthDate = birthDateFromCnp(cnp);

  return (
    <div className="relative w-full aspect-[1.585/1] rounded-xl overflow-hidden shadow-xl"
         style={{
           background: "linear-gradient(135deg, #fce7e7 0%, #f9d4d4 50%, #f5c0c0 100%)",
         }}>
      {/* Subtle pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-25" preserveAspectRatio="none" viewBox="0 0 400 252">
        <defs>
          <pattern id="hexpattern" width="20" height="17.3" patternUnits="userSpaceOnUse">
            <polygon points="10,0 19,5 19,13 10,18 1,13 1,5" fill="none" stroke="#9b1c1c" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexpattern)" />
      </svg>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-3 py-2 flex items-center justify-between border-b border-red-900/30"
           style={{ background: "rgba(255,255,255,0.5)" }}>
        <div className="flex items-center gap-2">
          {/* EU stars + RO */}
          <div className="relative w-7 h-7 rounded-full flex items-center justify-center"
               style={{ background: "#003399" }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
              const r = 9;
              const x = 14 + r * Math.cos(angle);
              const y = 14 + r * Math.sin(angle);
              return (
                <div key={i}
                     className="absolute w-0.5 h-0.5 rounded-full"
                     style={{ background: "#FFCC00", left: `${x}px`, top: `${y}px` }} />
              );
            })}
            <span className="text-[7px] font-bold text-yellow-400">RO</span>
          </div>
          <div>
            <p className="font-bold text-[8px] leading-none text-red-950">PERMIS DE CONDUCERE</p>
            <p className="text-[6px] leading-none text-red-800 mt-0.5">DRIVING LICENCE</p>
            <p className="text-[6px] leading-none text-red-700 mt-0.5">UE / RO — MODEL 2013</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="absolute top-[42px] bottom-[16px] left-2 right-2 flex gap-2">
        {/* Photo + signature */}
        <div className="w-[22%] flex flex-col gap-1">
          <div className="flex-1 bg-red-100 rounded overflow-hidden border border-red-900/30">
            {doc.photo_base64 ? (
              <img src={doc.photo_base64} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-red-900/40" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
          <div className="h-[14%] bg-white/40 rounded border border-red-900/20 flex items-center justify-center px-1">
            <span className="text-[6px] italic text-red-900/70 truncate" style={{ fontFamily: "cursive" }}>
              {given.slice(0, 1)}. {family}
            </span>
          </div>
        </div>

        {/* Fields — numbered like the real EU permis */}
        <div className="flex-1 flex flex-col gap-1 text-red-950 min-w-0">
          <NumberedField n="1" label="Nume" value={family} large />
          <NumberedField n="2" label="Prenume" value={given} large />
          <div className="grid grid-cols-2 gap-2">
            <NumberedField n="3" label="Data și loc naștere" value={`${birthDate} CLUJ-NAPOCA`} />
            <NumberedField n="4a" label="Eliberat la" value={formatDate(doc.issued_date) || "—"} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberedField n="4b" label="Valabil până" value={formatDate(doc.expires_date) || "—"} />
            <NumberedField n="4c" label="Emis de" value={doc.issued_by || "RAR Cluj"} />
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex-1 min-w-0">
              <NumberedField n="5" label="Nr. permis" value={doc.doc_number || "—"} mono />
            </div>
            <div className="flex-shrink-0">
              <p className="text-[5.5px] uppercase tracking-wider text-red-700 leading-none">9. Categorii</p>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {DEFAULT_CATEGORIES.map((cat) => (
                  <span key={cat}
                        className="inline-flex items-center justify-center min-w-[18px] h-[14px] px-1 rounded text-[8px] font-bold border border-red-900/50 bg-white/70 text-red-950">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DemoWatermark />
    </div>
  );
}

// ─── Numbered field (EU driving license style) ───────────────────────────────

function NumberedField({ n, label, value, mono, large }: {
  n: string; label: string; value: string; mono?: boolean; large?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[5.5px] uppercase tracking-wider text-red-700 leading-none">
        <span className="font-bold mr-1">{n}.</span>{label}
      </p>
      <p className={`leading-tight mt-0.5 font-semibold ${
        large ? "text-[11px]" : "text-[9px] truncate"
      } ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitName(fullName: string): [string, string] {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

function birthDateFromCnp(cnp: string): string {
  if (!/^\d{13}$/.test(cnp)) return "—";
  const cm: Record<string, number> = { "1": 1900, "2": 1900, "3": 1800, "4": 1800, "5": 2000, "6": 2000 };
  const c = cm[cnp[0]]; if (!c) return "—";
  return `${cnp.slice(5, 7)}.${cnp.slice(3, 5)}.${c + parseInt(cnp.slice(1, 3), 10)}`;
}
