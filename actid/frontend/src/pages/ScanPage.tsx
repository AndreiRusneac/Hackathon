import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { sharingApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, Badge } from "@/components/ui";
import { DOC_LABELS } from "@/lib/utils";

interface ScanResult {
  owner: { full_name: string; cnp: string };
  context: string;
  permissions: string[];
  documents: Array<{
    id: string;
    doc_type: string;
    doc_number?: string;
    status: string;
  }>;
  scanned_at: string;
}

export default function ScanPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate(`/login?next=/scan/${token}`, { replace: true });
      return;
    }
    if (!token) return;

    sharingApi.scanToken(token)
      .then((res) => setResult(res.data))
      .catch((e) => setError(e.response?.data?.detail || "Token invalid sau expirat"))
      .finally(() => setLoading(false));
  }, [token, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-actid-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm border-red-200">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <XCircle size={48} className="text-red-500" />
            <p className="font-bold text-lg">Token invalid</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!result) return null;

  const cnpMasked = result.owner.cnp?.replace(/\d(?=\d{4})/g, "*");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm border-green-200">
        <div className="bg-green-50 px-5 py-4 rounded-t-2xl border-b border-green-200 flex items-center gap-3">
          <CheckCircle2 size={28} className="text-green-700 flex-shrink-0" />
          <div>
            <p className="font-bold text-green-800">Token valid</p>
            <p className="text-xs text-green-600">{result.owner.full_name} · CNP: {cnpMasked}</p>
          </div>
        </div>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="info">{result.context || "General"}</Badge>
            {result.permissions?.map((p) => (
              <Badge key={p} variant="outline">{p}</Badge>
            ))}
          </div>
          {result.documents?.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {DOC_LABELS[doc.doc_type as keyof typeof DOC_LABELS] || doc.doc_type}
                </p>
                {doc.doc_number && (
                  <p className="text-xs text-muted-foreground font-mono">{doc.doc_number}</p>
                )}
              </div>
              <Badge variant={doc.status === "valid" ? "success" : doc.status === "expirat" ? "danger" : "warning"}>
                {doc.status === "valid" ? "Valabil" : doc.status === "expirat" ? "Expirat" : "Expiră curând"}
              </Badge>
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-1">
            Scanat la {new Date(result.scanned_at).toLocaleString("ro-RO")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
