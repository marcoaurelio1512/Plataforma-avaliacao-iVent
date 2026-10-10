import { Copy, Download, ExternalLink } from "lucide-react";
import type { SurveySummary } from "../types.ts";

/** Link público exclusivo + QR Code da pesquisa. */
export function SharePanel({ survey, onCopied }: { survey: SurveySummary; onCopied: (m: string) => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(survey.publicUrl);
      onCopied("Link copiado");
    } catch {
      onCopied("Não foi possível copiar automaticamente — selecione o link e copie.");
    }
  };
  const qrSrc = `/api/admin/surveys/${survey.id}/qr.png?v=${encodeURIComponent(survey.updatedAt)}`;
  return (
    <div className="share">
      <div className="share-qr">
        <img src={qrSrc} width={180} height={180} alt={`QR Code para ${survey.publicUrl}`} />
      </div>
      <div className="stack">
        <div className="stack-sm">
          <p className="field-label">Link público</p>
          <div className="url-box">{survey.publicUrl}</div>
        </div>
        {survey.requireInvite && (
          <p className="panel-note">Esta pesquisa exige convite: o link geral não aceita respostas. Distribua os links individuais em “Convites”.</p>
        )}
        {survey.status !== "published" && (
          <p className="panel-note">O link só aceita respostas enquanto a pesquisa estiver publicada.</p>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={copy}><Copy /> Copiar link</button>
          <a className="btn" href={`${qrSrc}&download=1`} download><Download /> Baixar QR Code</a>
          <a className="btn btn-ghost" href={survey.publicUrl.replace(/^https?:\/\/[^/]+/, "")} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a>
        </div>
      </div>
    </div>
  );
}
