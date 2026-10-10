import { Ban, Copy, Download, FileText, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api, download, errorMessage } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import type { SurveySummary } from "../types.ts";

interface Invite {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  url: string;
}

/** Convites de uso único: cada link/QR aceita uma única resposta, que continua anônima. */
export function InvitesPanel({ survey, onChanged, notify }: { survey: SurveySummary; onChanged: () => void; notify: (m: string) => void }) {
  const invites = useAsync((signal) => api<Invite[]>(`/api/admin/surveys/${survey.id}/invites`, { signal }), [survey.id]);
  const [count, setCount] = useState(20);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requireInvite, setRequireInvite] = useState(survey.requireInvite);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      notify(message);
      invites.reload();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Atualização otimista: o interruptor responde ao toque e volta atrás se o servidor recusar.
  const toggle = async (value: boolean) => {
    setRequireInvite(value);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/surveys/${survey.id}/meta`, { method: "PUT", body: { requireInvite: value } });
      notify(value ? "Convite agora é obrigatório" : "Pesquisa aberta a qualquer pessoa com o link");
      onChanged();
    } catch (e) {
      setRequireInvite(!value);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const list = invites.data ?? [];
  const used = list.filter((i) => i.usedAt).length;
  const revoked = list.filter((i) => i.revokedAt).length;
  const available = list.length - used - revoked;

  return (
    <div className="stack-lg">
      <section className={`invite-mode${requireInvite ? " is-on" : ""}`}>
        <label className="checkbox invite-toggle">
          <input type="checkbox" checked={requireInvite} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
          <span><b>Exigir convite de uso único</b> para responder</span>
        </label>
        <p className="panel-note">
          {requireInvite
            ? "Só responde quem tem um convite válido; cada convite aceita uma única resposta. O link geral da pesquisa deixa de funcionar."
            : "Qualquer pessoa com o link geral pode responder. Convites gerados ainda são registrados quando usados."}
        </p>
        <p className="panel-note row"><ShieldCheck size={14} /> A resposta continua anônima: o sistema não sabe quem recebeu cada convite.</p>
      </section>

      <div className="stat-strip">
        <div><strong>{list.length - revoked}</strong><span>convites ativos</span></div>
        <div><strong>{used}</strong><span>utilizados (responderam)</span></div>
        <div><strong>{available}</strong><span>disponíveis</span></div>
      </div>

      <form className="invite-form" onSubmit={(e) => { e.preventDefault(); void run(() => api(`/api/admin/surveys/${survey.id}/invites`, { method: "POST", body: { count, label: label || null } }), `${count} convite(s) gerado(s)`); }}>
        <div className="field">
          <label htmlFor="inv-count">Quantidade</label>
          <input id="inv-count" type="number" min={1} max={500} className="input" value={count} onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} />
        </div>
        <div className="field grow">
          <label htmlFor="inv-label">Rótulo do lote <span className="dim">(opcional — evite nomes de pessoas)</span></label>
          <input id="inv-label" className="input" value={label} maxLength={80} placeholder="Ex.: Residentes — turma 2026" onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}><Plus /> Gerar convites</button>
      </form>

      <div className="row">
        <button type="button" className="btn" disabled={!available} onClick={() => download(`/api/admin/surveys/${survey.id}/invites/qr.pdf`).catch((e) => setError(errorMessage(e)))}><FileText /> Folha de QR Codes (PDF)</button>
        <button type="button" className="btn" disabled={!list.length} onClick={() => download(`/api/admin/surveys/${survey.id}/invites.csv`).catch((e) => setError(errorMessage(e)))}><Download /> Lista em CSV</button>
      </div>
      <p className="panel-note">A folha em PDF traz apenas convites disponíveis, em cartões recortáveis (8 por página). O CSV traz os links para envio por mensagem.</p>

      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {invites.loading && <Loading />}
      {invites.error != null && <ErrorState error={invites.error} onRetry={invites.reload} />}
      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th>Código</th><th>Situação</th><th>Rótulo</th><th /></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="num">{i.code}</td>
                  <td>
                    {i.revokedAt ? <span className="badge">Revogado</span> : i.usedAt ? <span className="badge badge-ok">Utilizado {dateTime(i.usedAt)}</span> : <span className="badge badge-accent">Disponível</span>}
                  </td>
                  <td className="dim">{i.label ?? "—"}</td>
                  <td>
                    {!i.usedAt && !i.revokedAt && (
                      <div className="row">
                        <button type="button" className="btn btn-sm btn-ghost" aria-label={`Copiar link do convite ${i.code}`} onClick={() => navigator.clipboard.writeText(i.url).then(() => notify("Link do convite copiado"), () => notify(i.url))}><Copy /></button>
                        <button type="button" className="btn btn-sm btn-ghost btn-danger" aria-label={`Revogar convite ${i.code}`} disabled={busy} onClick={() => window.confirm("Revogar este convite? Ele deixará de funcionar.") && void run(() => api(`/api/admin/surveys/${survey.id}/invites/${i.id}/revoke`, { method: "POST" }), "Convite revogado")}><Ban /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
