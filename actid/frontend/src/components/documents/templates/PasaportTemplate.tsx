/**
 * PasaportTemplate — Romanian biometric passport bio-data page.
 * Burgundy theme, EU stars on top.
 */
import type { Document } from "@/types";
import { formatDate } from "@/lib/utils";
import { DemoWatermark } from "./CITemplate";

export function PasaportTemplate({ doc, fullName, userCnp }: {
  doc: Document;
  fullName: string;
  userCnp?: string;
}) {
  const cnp = doc.cnp || userCnp || "";
  const [given, family] = splitName(fullName);
  const birthDate = birthDateFromCnp(cnp);
  const sex = sexFromCnp(cnp);
  const mrz = buildMrzPassport({ family, given, cnp, expires: doc.expires_date, docNumber: doc.doc_number || "" });

  return (
    <div className="relative w-full aspect-[1.42/1] rounded-xl overflow-hidden shadow-xl"
         style={{
           background: "linear-gradient(135deg, #f8e6e6 0%, #f0d4d4 50%, #e8c8c8 100%)",
         }}>
      {/* Burgundy band on the side */}
      <div className="absolute right-0 top-0 bottom-0 w-2"
           style={{ background: "linear-gradient(180deg, #6b0e15 0%, #4a0810 100%)" }} />

      {/* Subtle guilloché pattern (concentric arcs) */}
      <svg className="absolute inset-0 w-full h-full opacity-25" preserveAspectRatio="none" viewBox="0 0 400 282">
        <defs>
          <pattern id="guilloche" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="20" fill="none" stroke="#6b0e15" strokeWidth="0.3" />
            <circle cx="30" cy="30" r="15" fill="none" stroke="#6b0e15" strokeWidth="0.3" />
            <circle cx="30" cy="30" r="10" fill="none" stroke="#6b0e15" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#guilloche)" />
      </svg>

      {/* Header — EU stars + RO */}
      <div className="absolute top-0 left-0 right-2 px-3 py-2 flex items-center justify-between border-b border-red-900/30"
           style={{ background: "rgba(255,255,255,0.5)" }}>
        <div className="flex items-center gap-2">
          {/* EU stars circle */}
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
          </div>
          <div>
            <p className="text-[6px] leading-none text-red-900 font-semibold">UNIUNEA EUROPEANĂ</p>
            <p className="font-bold text-[8px] leading-none mt-0.5 text-red-950">ROMÂNIA</p>
            <p className="text-[6px] leading-none text-red-900 mt-0.5">PAȘAPORT / PASSPORT</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[6px] leading-none text-red-700">TIP / TYPE</p>
          <p className="font-mono text-[9px] font-bold leading-none mt-0.5 text-red-950">P</p>
          <p className="text-[6px] leading-none text-red-700 mt-1">COD ȚARĂ / COUNTRY CODE</p>
          <p className="font-mono text-[9px] font-bold leading-none mt-0.5 text-red-950">ROU</p>
        </div>
      </div>

      {/* Body */}
      <div className="absolute top-[48px] bottom-[40px] left-2 right-4 flex gap-3">
        {/* Photo */}
        <div className="w-[24%] flex flex-col gap-1">
          <div className="flex-1 bg-red-100 rounded overflow-hidden border-2 border-red-900/30">
            {doc.photo_base64 ? (
              <img src={doc.photo_base64} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-red-900/50" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1.5 text-red-950 min-w-0">
          <Field label="Nr. pașaport / Passport No." value={doc.doc_number || "—"} mono colSpan={2} />
          <Field label="Nume / Surname" value={family} colSpan={2} large />
          <Field label="Prenume / Given names" value={given} colSpan={2} large />
          <Field label="Cetățenie / Nationality" value="ROMÂNĂ / ROU" />
          <Field label="Data naștere / Date of birth" value={birthDate} />
          <Field label="Sex" value={sex} />
          <Field label="Locul nașterii / Place of birth" value="Cluj-Napoca, RO" />
          <Field label="Data emiterii / Date of issue" value={formatDate(doc.issued_date) || "—"} />
          <Field label="Valabil până / Date of expiry" value={formatDate(doc.expires_date) || "—"} />
          <Field label="Autoritatea / Authority" value={doc.issued_by || "MAI"} colSpan={2} />
        </div>
      </div>

      {/* MRZ */}
      <div className="absolute bottom-1 left-2 right-4 font-mono text-[7px] leading-tight tracking-wider text-red-950 select-none">
        <p>{mrz[0]}</p>
        <p>{mrz[1]}</p>
      </div>

      <DemoWatermark />
    </div>
  );
}

// ─── Field component (matches CI) ────────────────────────────────────────────

function Field({ label, value, mono, colSpan = 1, large }: {
  label: string; value: string; mono?: boolean; colSpan?: 1 | 2; large?: boolean;
}) {
  return (
    <div className={`min-w-0 ${colSpan === 2 ? "col-span-2" : ""}`}>
      <p className="text-[5.5px] uppercase tracking-wider text-red-700 leading-none">{label}</p>
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

function sexFromCnp(cnp: string): string {
  const d = parseInt(cnp[0] || "0", 10);
  if (d === 1 || d === 3 || d === 5) return "M";
  if (d === 2 || d === 4 || d === 6) return "F";
  return "—";
}

function buildMrzPassport({ family, given, cnp, expires, docNumber }: {
  family: string; given: string; cnp: string; expires?: string; docNumber: string;
}): [string, string] {
  const upper = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "<");
  const pad = (s: string, n: number, fill = "<") => (s + fill.repeat(n)).slice(0, n);
  const expCompact = expires ? expires.replace(/-/g, "").slice(2, 8) : "<<<<<<";
  const line1 = `P<ROU${pad(upper(family), 30)}<<${pad(upper(given), 30)}`.slice(0, 44);
  const line2 = `${pad(docNumber.replace(/\W/g, ""), 9)}0ROU<<<<<<<<<<<<${pad(cnp, 14)}<${expCompact}`.slice(0, 44);
  return [line1, line2];
}
