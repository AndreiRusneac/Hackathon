import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, AlertTriangle, X } from "lucide-react";
import { identityApi, getErrMsg, type ScanIdResult } from "@/lib/api";
import { Alert, Button } from "@/components/ui";

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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
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
      setPhase("review");
    } catch (err) {
      setError(getErrMsg(err, "Scanare eșuată. Încearcă din nou."));
      setPhase("preview");
    }
  };

  const handleConfirm = () => {
    if (result) onSuccess(result);
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

      {/* Review extracted data */}
      {phase === "review" && result && (
        <div className="space-y-3">
          <Alert variant="success" title="Document scanat">
            {result.message}
          </Alert>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            {result.id_face_base64 && (
              <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                <img
                  src={result.id_face_base64}
                  alt="Foto din document"
                  className="w-16 h-20 object-cover rounded-lg ring-2 ring-white shadow"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{result.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.nationality ?? ""} · {result.sex ?? ""}
                  </p>
                </div>
              </div>
            )}
            <Row label="CNP" value={result.cnp} />
            <Row label="Nr. document" value={result.document_number} />
            <Row label="Data nașterii" value={result.date_of_birth} />
            <Row label="Expiră" value={result.expiration_date} />
          </div>

          <div className="flex gap-3">
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

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-right truncate">{value || "—"}</span>
    </div>
  );
}
