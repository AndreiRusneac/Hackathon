import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, AlertTriangle, X } from "lucide-react";
import { identityApi, getErrMsg, type ScanIdResult } from "@/lib/api";
import { Alert, Button, Input } from "@/components/ui";

// Romanian CNP checksum — duplicate of the backend rule so we can revalidate
// after the user edits the field on the review screen.
const CNP_COEFFS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];
function isValidCnp(cnp?: string | null): boolean {
  if (!cnp || cnp.length !== 13 || !/^\d{13}$/.test(cnp)) return false;
  if (!"12345678".includes(cnp[0])) return false;
  const mm = parseInt(cnp.slice(3, 5), 10);
  const dd = parseInt(cnp.slice(5, 7), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cnp[i], 10) * CNP_COEFFS[i];
  let check = sum % 11;
  if (check === 10) check = 1;
  return check === parseInt(cnp[12], 10);
}

interface IdScannerProps {
  onSuccess: (result: ScanIdResult) => void;
  onCancel: () => void;
}

type Phase = "camera" | "preview" | "scanning" | "review" | "error";

export default function IdScanner({ onSuccess, onCancel }: IdScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<ScanIdResult | null>(null);
  const [edited, setEdited] = useState<ScanIdResult | null>(null);
  const [error, setError] = useState<string>("");

  // ── Camera lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera error", err);
        setError(
          "Nu pot accesa camera. Verifică permisiunile browserului și încearcă din nou."
        );
        setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [phase]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;

    // Crop to the ID overlay region (85% width, 1.585:1 aspect, centered)
    // so passporteye gets only the card — no background noise.
    const cropW = Math.round(video.videoWidth * 0.85);
    const cropH = Math.round(cropW / 1.585);
    const cropX = Math.round((video.videoWidth - cropW) / 2);
    const cropY = Math.round((video.videoHeight - cropH) / 2);

    // Modern phone cameras shoot at 4K+, which produces 10+ MB PNG dataURLs
    // and breaks both nginx body limits and OCR speed. Cap the longer edge
    // to 1600 px — still well above what passporteye needs for the MRZ band.
    const MAX_EDGE = 1600;
    const scale = Math.min(1, MAX_EDGE / cropW);
    const outW = Math.round(cropW * scale);
    const outH = Math.round(cropH * scale);

    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    // JPEG at q=0.92 is small enough to upload over a phone connection while
    // still keeping the OCR-B MRZ glyphs readable. PNG of a 1600 px crop is
    // ~4 MB and noticeably slower over Cloudflare's quick tunnel.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedImage(dataUrl);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setPhase("preview");
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setResult(null);
    setEdited(null);
    setError("");
    setPhase("camera");
  };

  const handleScan = async () => {
    if (!capturedImage) return;
    setError("");
    setPhase("scanning");
    try {
      const res = await identityApi.scanId(capturedImage);
      if (!res.data.success) {
        setError(res.data.message || "Scanare eșuată");
        setPhase("preview");
        return;
      }
      setResult(res.data);
      setEdited(res.data);
      setPhase("review");
    } catch (err) {
      setError(getErrMsg(err, "Scanare eșuată. Încearcă din nou."));
      setPhase("preview");
    }
  };

  const handleConfirm = () => {
    if (!edited) return;
    // Recompute full_name + cnp_valid from the (possibly edited) fields so
    // downstream code sees the user-corrected values.
    const surname = edited.surname?.trim() || undefined;
    const given_names = edited.given_names?.trim() || undefined;
    const full_name = [surname, given_names].filter(Boolean).join(" ") || edited.full_name?.trim() || undefined;
    const cnp = edited.cnp?.trim() || undefined;
    onSuccess({
      ...edited,
      surname,
      given_names,
      full_name,
      cnp,
      cnp_valid: isValidCnp(cnp),
    });
  };

  const updateField = (key: keyof ScanIdResult, value: string) => {
    setEdited((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Camera view + frame overlay */}
      {phase === "camera" && (
        <div className="space-y-3">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {/* ID positioning frame (Romanian CI ≈ 8.56 × 5.4 cm → ~1.585 aspect) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="border-2 border-white/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{ width: "85%", aspectRatio: "1.585 / 1" }}
              />
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-center text-white text-xs font-medium drop-shadow">
              Așază documentul în cadru
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
            >
              <X size={16} aria-hidden="true" />
              Anulează
            </Button>
            <Button onClick={handleCapture} className="flex-[2]" size="lg">
              <Camera size={18} aria-hidden="true" />
              Capturează
            </Button>
          </div>
        </div>
      )}

      {/* Preview captured image, then scan */}
      {phase === "preview" && capturedImage && (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
            <img
              src={capturedImage}
              alt="Document capturat"
              className="w-full h-full object-cover"
            />
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleRetake}
              className="flex-1"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Refă
            </Button>
            <Button onClick={handleScan} className="flex-[2]" size="lg">
              Scanează MRZ
            </Button>
          </div>
        </div>
      )}

      {/* Scanning spinner */}
      {phase === "scanning" && (
        <div className="py-12 text-center space-y-3">
          <div className="inline-block w-10 h-10 border-4 border-actid-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">
            Se extrage MRZ-ul și fotografia…
          </p>
        </div>
      )}

      {/* Review extracted data — only the 4 fields the user cares about. */}
      {phase === "review" && edited && (
        <div className="space-y-3">
          <Alert variant={isValidCnp(edited.cnp) ? "success" : "warning"} title="Verifică datele">
            {isValidCnp(edited.cnp)
              ? "CNP valid. Verifică Seria, Numărul și data de expirare."
              : "Verifică fiecare câmp și corectează dacă e cazul."}
          </Alert>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                label="CNP"
                inputMode="numeric"
                maxLength={13}
                value={edited.cnp ?? ""}
                onChange={(e) => updateField("cnp", e.target.value.replace(/\D/g, ""))}
                error={
                  edited.cnp && !isValidCnp(edited.cnp)
                    ? "CNP invalid — verifică cifrele"
                    : undefined
                }
              />
            </div>
            <Input
              label="Seria"
              maxLength={2}
              value={edited.series ?? ""}
              onChange={(e) =>
                updateField("series", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
              }
            />
            <Input
              label="Nr."
              inputMode="numeric"
              value={edited.document_number ?? ""}
              onChange={(e) =>
                updateField("document_number", e.target.value.replace(/\D/g, ""))
              }
            />
            <div className="col-span-2">
              <Input
                label="Data de expirare"
                type="date"
                value={edited.expiration_date ?? ""}
                onChange={(e) => updateField("expiration_date", e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleRetake} className="flex-1">
              <RotateCcw size={16} aria-hidden="true" />
              Refă
            </Button>
            <Button onClick={handleConfirm} className="flex-[2]" size="lg">
              <Check size={18} aria-hidden="true" />
              Continuă
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="space-y-3 py-6">
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-600" aria-hidden="true" />
            </div>
          </div>
          <Alert variant="error">{error}</Alert>
          <Button variant="secondary" onClick={onCancel} className="w-full">
            Înapoi
          </Button>
        </div>
      )}
    </div>
  );
}
