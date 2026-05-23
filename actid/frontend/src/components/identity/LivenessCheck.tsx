import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Smile, ArrowLeft, ArrowRight, Check, AlertTriangle, Eye } from "lucide-react";
import { Alert, Button } from "@/components/ui";

// Served from frontend/public/models — see download script in README.
// Hosting locally avoids CORS/rate-limit failures from the GitHub.io CDN.
const MODEL_URL = "/models";

type Step =
  | "loading"
  | "ready"
  | "straight"
  | "left"
  | "right"
  | "smile"
  | "captured"
  | "error";

interface LivenessCheckProps {
  /** Called once all challenges pass. Receives the captured selfie as a base64 data URL. */
  onSuccess: (selfie_base64: string) => void;
  onCancel: () => void;
}

const YAW_TURN_THRESHOLD = 0.18;     // |yaw| > this = significantly turned
const YAW_STRAIGHT_THRESHOLD = 0.07; // |yaw| < this = facing forward
const SMILE_THRESHOLD = 0.7;          // happy expression score
const REQUIRED_CONFIRMATIONS = 3;     // consecutive frames matching the rule

const STEP_LABELS: Record<Exclude<Step, "loading" | "ready" | "captured" | "error">, string> = {
  straight: "Priviți drept înainte",
  left: "Întoarceți capul la stânga",
  right: "Întoarceți capul la dreapta",
  smile: "Acum zâmbiți",
};

const STEP_HINTS: Record<Exclude<Step, "loading" | "ready" | "captured" | "error">, string> = {
  straight: "Mențineți privirea spre cameră",
  left: "Întoarceți încet capul către umărul stâng",
  right: "Întoarceți încet capul către umărul drept",
  smile: "Un zâmbet sincer este suficient",
};

export default function LivenessCheck({ onSuccess, onCancel }: LivenessCheckProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stepRef = useRef<Step>("loading");
  const confirmsRef = useRef<number>(0);

  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string>("");
  const [progress, setProgress] = useState<number>(0); // 0..1 within current challenge

  // Keep ref in sync so the rAF loop reads the latest step
  useEffect(() => {
    stepRef.current = step;
    confirmsRef.current = 0;
    setProgress(0);
  }, [step]);

  // ── Load models + start camera ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // Don't attach to videoRef here — the <video> element only renders
        // once step !== "loading". A second effect (below) handles attachment
        // as soon as the element mounts.
        setStep("ready");
      } catch (err) {
        console.error("Liveness setup failed", err);
        setError(
          "Nu pot porni camera sau modelele de detecție. Verifică permisiunile și conexiunea la internet."
        );
        setStep("error");
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ── Attach the live stream once the <video> element actually mounts ──────
  // The setup effect above runs on initial mount, but the <video> is
  // conditionally rendered (only when step !== "loading"). So we attach the
  // stream here, after each step change, when both the stream and the DOM
  // node are guaranteed to exist.
  useEffect(() => {
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    if (v.srcObject === s) return;
    v.srcObject = s;
    // Safari/iOS sometimes rejects the auto-play; the muted+playsInline attrs
    // make it succeed on the second tick, so swallow the first rejection.
    v.play().catch((err) => console.warn("video.play() rejected", err));
  }, [step]);

  // ── Detection loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (step === "loading" || step === "ready" || step === "captured" || step === "error") {
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    const detector = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    });

    const tick = async () => {
      if (!videoRef.current || stepRef.current === "captured") return;

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, detector)
          .withFaceLandmarks()
          .withFaceExpressions();

        if (detection) {
          const passed = evaluateChallenge(stepRef.current, detection);
          if (passed) {
            confirmsRef.current += 1;
            setProgress(Math.min(1, confirmsRef.current / REQUIRED_CONFIRMATIONS));
            if (confirmsRef.current >= REQUIRED_CONFIRMATIONS) {
              advance();
              return;
            }
          } else {
            // Soft decay instead of hard reset — small bobbles don't ruin progress
            confirmsRef.current = Math.max(0, confirmsRef.current - 1);
            setProgress(confirmsRef.current / REQUIRED_CONFIRMATIONS);
          }
        }
      } catch (err) {
        // Per-frame errors are non-fatal; just keep looping
        console.warn("Detection tick error", err);
      }

      rafRef.current = window.setTimeout(
        () => requestAnimationFrame(tick),
        180 // ~5fps is plenty for liveness checks and keeps the CPU quiet
      ) as unknown as number;
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        clearTimeout(rafRef.current);
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [step]);

  // ── State machine: move to next challenge ───────────────────────────────
  const advance = () => {
    const next: Record<Step, Step> = {
      loading: "loading",
      ready: "straight",
      straight: "left",
      left: "right",
      right: "smile",
      smile: "captured",
      captured: "captured",
      error: "error",
    };
    const target = next[stepRef.current];
    if (target === "captured") {
      captureAndFinish();
    } else {
      setStep(target);
    }
  };

  const captureAndFinish = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setStep("captured");
    // Stop the camera as soon as we have the frame
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onSuccess(dataUrl);
  };

  const startChallenges = () => setStep("straight");

  // ── Render ──────────────────────────────────────────────────────────────
  const isChallenge = step === "straight" || step === "left" || step === "right" || step === "smile";

  return (
    <div className="space-y-4">
      {step === "loading" && (
        <div className="py-10 text-center space-y-3">
          <div className="inline-block w-10 h-10 border-4 border-actid-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Pregătim verificarea biometrică…</p>
        </div>
      )}

      {step === "error" && (
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

      {(step === "ready" || isChallenge) && (
        <>
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-square">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Oval face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="border-[3px] border-white/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                style={{ width: "70%", aspectRatio: "3/4" }}
              />
            </div>

            {/* Progress ring on the right side */}
            {isChallenge && (
              <div className="absolute top-3 right-3 bg-black/60 rounded-full px-3 py-1 text-xs text-white font-semibold">
                {Math.round(progress * 100)}%
              </div>
            )}
          </div>

          {step === "ready" && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Vom verifica că ești o persoană reală prin câteva mișcări simple.
              </p>
              <Button onClick={startChallenges} className="w-full" size="lg">
                Începe verificarea
              </Button>
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Anulează
              </button>
            </div>
          )}

          {isChallenge && (
            <ChallengePrompt step={step} progress={progress} />
          )}
        </>
      )}

      {step === "captured" && (
        <div className="py-6 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-2xl">
            <Check size={24} className="text-green-600" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold">Imagine capturată</p>
          <p className="text-xs text-muted-foreground">Se compară cu fotografia din document…</p>
          <div className="inline-block w-8 h-8 border-4 border-actid-blue border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── Per-step rule ────────────────────────────────────────────────────────────

type FaceDetection = faceapi.WithFaceExpressions<
  faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>
>;

function evaluateChallenge(step: Step, det: FaceDetection): boolean {
  const yaw = estimateYaw(det.landmarks);

  switch (step) {
    case "straight":
      return Math.abs(yaw) < YAW_STRAIGHT_THRESHOLD;
    case "left":
      // Anatomical left turn → nose moves to image right → positive yaw
      return yaw > YAW_TURN_THRESHOLD;
    case "right":
      return yaw < -YAW_TURN_THRESHOLD;
    case "smile":
      return (det.expressions.happy ?? 0) > SMILE_THRESHOLD;
    default:
      return false;
  }
}

/**
 * Estimate yaw from 68 landmarks.
 * Returns the normalized horizontal offset of the nose tip from the midline
 * between the eye centers. Positive = user turned to their anatomical LEFT.
 */
function estimateYaw(landmarks: faceapi.FaceLandmarks68): number {
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();   // image-left → user's right eye
  const rightEye = landmarks.getRightEye(); // image-right → user's left eye

  const noseTip = nose[6]; // bottom-center of the nose path
  const leftCenter = avgX(leftEye);
  const rightCenter = avgX(rightEye);

  const midX = (leftCenter + rightCenter) / 2;
  const eyeDist = Math.abs(rightCenter - leftCenter);
  if (eyeDist < 1) return 0;

  return (noseTip.x - midX) / eyeDist;
}

function avgX(points: { x: number }[]): number {
  return points.reduce((s, p) => s + p.x, 0) / points.length;
}

// ─── Prompt UI ────────────────────────────────────────────────────────────────

function ChallengePrompt({ step, progress }: { step: Step; progress: number }) {
  const icon =
    step === "straight" ? <Eye size={22} /> :
    step === "left" ? <ArrowLeft size={22} /> :
    step === "right" ? <ArrowRight size={22} /> :
    step === "smile" ? <Smile size={22} /> : null;

  const label = step in STEP_LABELS ? STEP_LABELS[step as keyof typeof STEP_LABELS] : "";
  const hint = step in STEP_HINTS ? STEP_HINTS[step as keyof typeof STEP_HINTS] : "";

  return (
    <div className="bg-actid-blue/5 border border-actid-blue/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-actid-blue text-white rounded-xl flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="h-2 bg-white rounded-full overflow-hidden">
        <div
          className="h-full bg-actid-blue transition-all duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
