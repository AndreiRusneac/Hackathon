/**
 * CITemplate — recreation of a Romanian Carte de Identitate (CI).
 * ISO/IEC 7810 ID-1 aspect ratio (85.6mm × 53.98mm ≈ 1.585:1).
 *
 * Watermark "DEMO — Document de prezentare" overlays the entire card
 * so the rendering cannot be confused for a real ID.
 */
import type { Document } from "@/types";
import { formatDate } from "@/lib/utils";

export function CITemplate({ doc, fullName, userCnp }: {
  doc: Document;
  fullName: string;
  userCnp?: string;
}) {
  const cnp = doc.cnp || userCnp || "";
  const [given, family] = splitName(fullName);
  const birthDate = birthDateFromCnp(cnp);
  const sex = sexFromCnp(cnp);
  const seriesAndNumber = parseSerialNumber(doc.doc_number || "");
  const mrz = buildMrz({ family, given, cnp, expires: doc.expires_date });

  return (
    <div className="relative w-full aspect-[1.585/1] rounded-xl overflow-hidden shadow-xl"
         style={{
           background: "linear-gradient(135deg, #e8eef5 0%, #d4dde8 50%, #c5d2e0 100%)",
         }}>
      {/* Subtle wave pattern background */}
      <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="none" viewBox="0 0 400 252">
        <defs>
          <pattern id="waves" width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 10 Q10 0 20 10 T40 10" fill="none" stroke="#1e3a8a" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#waves)" />
      </svg>

      {/* Romanian flag stripe (left edge) */}
      <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col">
        <div className="flex-1" style={{ background: "#002B7F" }} />
        <div className="flex-1" style={{ background: "#FCD116" }} />
        <div className="flex-1" style={{ background: "#CE1126" }} />
      </div>

      {/* Header bar */}
      <div className="absolute top-0 left-1 right-0 px-3 py-2 flex items-center justify-between border-b border-slate-400/30"
           style={{ background: "rgba(255,255,255,0.4)" }}>
        <div className="flex items-center gap-2">
          {/* Stema RO — simplified eagle silhouette */}
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)" }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FCD116">
              <path d="M12 2 L8 6 L8 9 L4 11 L8 13 L8 16 L12 20 L16 16 L16 13 L20 11 L16 9 L16 6 Z" />
              <circle cx="12" cy="11" r="1.5" fill="#CE1126" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-[8px] leading-none text-slate-800">ROMÂNIA</p>
            <p className="text-[6px] leading-none text-slate-600 mt-0.5">CARTE DE IDENTITATE / IDENTITY CARD</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[6px] leading-none text-slate-500">SERIA</p>
          <p className="font-mono text-[10px] font-bold leading-none mt-0.5 text-slate-800">{seriesAndNumber.series}</p>
          <p className="text-[6px] leading-none text-slate-500 mt-1">NR</p>
          <p className="font-mono text-[10px] font-bold leading-none mt-0.5 text-slate-800">{seriesAndNumber.number}</p>
        </div>
      </div>

      {/* Body: photo + fields */}
      <div className="absolute top-[42px] bottom-[36px] left-2 right-2 flex gap-3">
        {/* Photo */}
        <div className="w-[26%] flex flex-col gap-1">
          <div className="flex-1 bg-slate-300 rounded overflow-hidden border border-slate-400/50">
            {doc.photo_base64 ? (
              <img src={doc.photo_base64} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-slate-400" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
          {/* Signature placeholder */}
          <div className="h-[14%] bg-white/40 rounded border border-slate-400/30 flex items-center justify-center">
            <span className="text-[6px] italic text-slate-500" style={{ fontFamily: "cursive" }}>
              {given.slice(0, 1)}. {family}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-slate-900 min-w-0">
          <Field label="CNP" value={cnp} mono colSpan={2} />
          <Field label="Nume / Last name" value={family} colSpan={2} large />
          <Field label="Prenume / First name" value={given} colSpan={2} large />
          <Field label="Cetățenie / Nationality" value="ROMÂNĂ / ROU" />
          <Field label="Sex" value={sex} />
          <Field label="Loc naștere / Place of birth" value="Cluj-Napoca, RO" colSpan={2} />
          <Field label="Valabil până / Valid until" value={formatDate(doc.expires_date) || "—"} colSpan={2} />
        </div>
      </div>

      {/* MRZ zone (bottom) */}
      <div className="absolute bottom-1 left-2 right-2 font-mono text-[7px] leading-tight tracking-wider text-slate-800 select-none">
        <p>{mrz[0]}</p>
        <p>{mrz[1]}</p>
      </div>

      {/* DEMO watermark */}
      <DemoWatermark />
    </div>
  );
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, value, mono, colSpan = 1, large }: {
  label: string; value: string; mono?: boolean; colSpan?: 1 | 2; large?: boolean;
}) {
  return (
    <div className={`min-w-0 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <p className="text-[5.5px] uppercase tracking-wider text-slate-500 leading-none">{label}</p>
      <p className={`leading-tight mt-0.5 font-semibold ${
        large ? "text-[11px]" : "text-[9px] truncate"
      } ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

// ─── Watermark used by all templates ─────────────────────────────────────────

export function DemoWatermark() {
  // SVG scales with the document container automatically via viewBox.
  // Text rotated -22°, opacity high enough to read but low enough not to hide info.
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      viewBox="0 0 100 63"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g transform="translate(50 32) rotate(-22)" textAnchor="middle">
        <text
          fontSize="14"
          fontWeight="900"
          fontFamily="system-ui, sans-serif"
          fill="#dc2626"
          fillOpacity="0.32"
          letterSpacing="2"
          y="-2"
        >
          DEMO
        </text>
        <text
          fontSize="3.5"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          fill="#dc2626"
          fillOpacity="0.40"
          letterSpacing="1.2"
          y="5.5"
        >
          DOCUMENT DE PREZENTARE
        </text>
      </g>
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitName(fullName: string): [string, string] {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  // Convention in this app: "Ion Popescu" → given=Ion, family=Popescu
  return [parts[0], parts.slice(1).join(" ")];
}

function birthDateFromCnp(cnp: string): string {
  if (!/^\d{13}$/.test(cnp)) return "—";
  const centuryMap: Record<string, number> = { "1": 1900, "2": 1900, "3": 1800, "4": 1800, "5": 2000, "6": 2000 };
  const century = centuryMap[cnp[0]];
  if (!century) return "—";
  const yy = cnp.slice(1, 3);
  const mm = cnp.slice(3, 5);
  const dd = cnp.slice(5, 7);
  return `${dd}.${mm}.${century + parseInt(yy, 10)}`;
}

function sexFromCnp(cnp: string): string {
  if (!cnp || cnp.length < 1) return "—";
  const d = parseInt(cnp[0], 10);
  if (d === 1 || d === 3 || d === 5) return "M";
  if (d === 2 || d === 4 || d === 6) return "F";
  return "—";
}

function parseSerialNumber(docNumber: string): { series: string; number: string } {
  const match = docNumber.match(/^([A-Z]{2})(\d+)$/);
  if (match) return { series: match[1], number: match[2] };
  return { series: docNumber.slice(0, 2) || "—", number: docNumber.slice(2) || "—" };
}

function buildMrz({ family, given, cnp, expires }: {
  family: string; given: string; cnp: string; expires?: string;
}): [string, string] {
  // Simplified TD1 MRZ — not standards-compliant, demo-only
  const upper = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "<");
  const pad = (s: string, n: number, fill = "<") => (s + fill.repeat(n)).slice(0, n);
  const expCompact = expires ? expires.replace(/-/g, "").slice(2, 8) : "<<<<<<";
  const line1 = `IDROU${pad(cnp, 9)}<<<<<<<<<<<<<<<<<<<<`.slice(0, 44);
  const line2 = `${pad(upper(family), 22)}${pad(upper(given), 17)}${expCompact}<<<<<`.slice(0, 44);
  return [line1, line2];
}
