import { Archive, ArchiveRestore, Copy, Eye, FilePlus2, KeyRound, Lock, Pencil, Play, QrCode, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SURVEY_STATUS_LABELS } from "../../../shared/domain.ts";
import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { Drawer } from "../components/Drawer.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { SharePanel } from "../components/SharePanel.tsx";
import { InvitesPanel } from "../components/InvitesPanel.tsx";
import { useToast } from "../components/useToast.tsx";
import { useScope } from "../scope.tsx";
import { useSession } from "../session.tsx";
import type { SurveySummary } from "../types.ts";

type Action = "publish" | "close" | "reopen" | "archive" | "unarchive";

const CONFIRM: Partial<Record<Action, string>> = {
  close: "Encerrar a pesquisa? O link deixará de aceitar respostas (é possível reabrir depois).",
  archive: "Arquivar a pesquisa? Ela sai das listas ativas e o link deixa de funcionar. Os dados são preservados.",
};

export default function SurveysPage() {
  const { surveys, surveysLoading, reloadSurveys, setSurveyId } = useScope();
  const { canManage } = useSession();
  const [sharing, setSharing] = useState<SurveySummary | null>(null);
  const [inviting, setInviting] = useState<SurveySummary | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const run = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      toast.show(success);
      reloadSurveys();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const status = (s: SurveySummary, action: Action) => {
    if (CONFIRM[action] && !window.confirm(CONFIRM[action])) return;
    void run(s.id, () => api(`/api/admin/surveys/${s.id}/status`, { method: "POST", body: { action } }), "Status atualizado");
  };

  const duplicate = (s: SurveySummary) =>
    run(s.id, async () => {
      const copy = await api<{ id: string }>(`/api/admin/surveys/${s.id}/duplicate`, { method: "POST" });
      navigate(`/admin/pesquisas/${copy.id}`);
    }, "Pesquisa duplicada");

  const remove = (s: SurveySummary) => {
    if (!window.confirm(`Excluir o rascunho "${s.title}"? Esta ação não pode ser desfeita.`)) return;
    void run(s.id, () => api(`/api/admin/surveys/${s.id}`, { method: "DELETE" }), "Rascunho excluído");
  };

  return (
    <>
      <PageHeader
        eyebrow="Gerenciador de questionários"
        title="Pesquisas"
        description="Crie, publique, encerre e compartilhe questionários. Pesquisas com respostas ganham nova versão ao serem editadas — o histórico nunca é alterado."
        actions={canManage && <Link className="btn btn-primary" to="/admin/pesquisas/nova"><FilePlus2 /> Criar questionário</Link>}
      />
      {error != null && <ErrorState error={error} />}
      {surveysLoading && <Loading />}
      {!surveysLoading && surveys.length === 0 && <Empty title="Nenhuma pesquisa ainda" />}
      <ul className="survey-list">
        {surveys.map((s) => (
          <li key={s.id} className={`survey-card is-${s.status}`}>
            <div className="survey-card-main">
              <div className="row">
                <span className={`badge status-${s.status}`}>{SURVEY_STATUS_LABELS[s.status]}</span>
                {s.currentVersionNumber && <span className="badge">Questionário v{s.currentVersionNumber}</span>}
                {s.iventVersionLabel && <span className="badge badge-accent">{s.iventVersionLabel}</span>}
                {s.requireInvite && <span className="badge badge-warning"><KeyRound size={12} /> Convite obrigatório</span>}
                {s.invitesTotal > 0 && <span className="badge">Convites: <span className="num">{s.invitesUsed}/{s.invitesTotal}</span> usados</span>}
              </div>
              <h2 className="survey-card-title">{s.title}</h2>
              <p className="dim survey-card-meta">
                <span className="num">{s.responseCount}</span> resposta(s) · criada {dateTime(s.createdAt)}
                {s.publishedAt && ` · publicada ${dateTime(s.publishedAt)}`}
                {s.closedAt && ` · encerrada ${dateTime(s.closedAt)}`}
              </p>
            </div>
            <div className="survey-card-actions">
              {canManage && s.status === "draft" && <button type="button" className="btn btn-primary btn-sm" disabled={busy === s.id} onClick={() => status(s, "publish")}><Play /> Publicar</button>}
              {canManage && s.status === "published" && <button type="button" className="btn btn-sm" disabled={busy === s.id} onClick={() => status(s, "close")}><Lock /> Encerrar</button>}
              {canManage && s.status === "closed" && <button type="button" className="btn btn-sm" disabled={busy === s.id} onClick={() => status(s, "reopen")}><RotateCcw /> Reabrir</button>}
              {s.status !== "archived" && <button type="button" className="btn btn-sm" onClick={() => setSharing(s)}><QrCode /> Link e QR</button>}
              {canManage && s.status !== "archived" && <button type="button" className="btn btn-sm" onClick={() => setInviting(s)}><KeyRound /> Convites</button>}
              {canManage && s.status !== "archived" && <Link className="btn btn-sm" to={`/admin/pesquisas/${s.id}`}><Pencil /> Editar</Link>}
              <Link className="btn btn-sm btn-ghost" to={`/admin/pesquisas/${s.id}/previa`}><Eye /> Prévia</Link>
              {canManage && <button type="button" className="btn btn-sm btn-ghost" disabled={busy === s.id} onClick={() => duplicate(s)}><Copy /> Duplicar</button>}
              {canManage && (s.status !== "archived" ? (
                <button type="button" className="btn btn-sm btn-ghost" disabled={busy === s.id} onClick={() => status(s, "archive")}><Archive /> Arquivar</button>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost" disabled={busy === s.id} onClick={() => status(s, "unarchive")}><ArchiveRestore /> Desarquivar</button>
              ))}
              {canManage && s.status === "draft" && s.responseCount === 0 && (
                <button type="button" className="btn btn-sm btn-ghost btn-danger" disabled={busy === s.id} onClick={() => remove(s)} aria-label="Excluir rascunho"><Trash2 /></button>
              )}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSurveyId(s.id); navigate(`/admin?survey=${s.id}`); }}>Ver resultados</button>
            </div>
          </li>
        ))}
      </ul>
      <Drawer open={Boolean(sharing)} title="Link e QR Code" subtitle={sharing?.title} onClose={() => setSharing(null)}>
        {sharing && <SharePanel survey={sharing} onCopied={toast.show} />}
      </Drawer>
      <Drawer open={Boolean(inviting)} title="Convites de uso único" subtitle={inviting?.title} onClose={() => setInviting(null)}>
        {inviting && <InvitesPanel survey={inviting} onChanged={reloadSurveys} notify={toast.show} />}
      </Drawer>
      {toast.node}
      <span className="sr-only">{error ? errorMessage(error) : ""}</span>
    </>
  );
}
