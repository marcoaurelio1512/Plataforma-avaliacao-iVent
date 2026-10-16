import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { useScope } from "../scope.tsx";

interface Data {
  /** Texto da pergunta de categoria profissional; null se ela não existe e nenhuma resposta tem profissão. */
  professionLabel: string | null;
  columns: { key: string; label: string }[];
  participants: { code: string; responseId: string; profession: string; answers: Record<string, string>; deviceClass: string | null; submittedAt: string }[];
  distributions: { key: string; title: string; rows: { label: string; n: number }[] }[];
}

export default function ParticipantsPage() {
  const { query, surveyId } = useScope();
  const state = useAsync((signal) => (surveyId ? api<Data>("/api/admin/participants", { query, signal }) : Promise.resolve(null)), [JSON.stringify(query)]);
  const d = state.data;
  const total = d?.participants.length ?? 0;
  return (
    <>
      <PageHeader eyebrow="Dados coletados" title="Participantes" description="Perfis anônimos: nenhum nome ou contato é coletado. Cada participante é identificado apenas por um código aleatório." />
      <FilterBar show={["profession", "from", "to", "iventVersionId"]} />
      {state.loading && <Loading />}
      {state.error != null && <ErrorState error={state.error} onRetry={state.reload} />}
      {d && total === 0 && <Empty title="Nenhum participante com estes filtros" />}
      {d && total > 0 && (
        <>
          <div className="dist-grid">
            {d.distributions.map((dist) => (
              <section key={dist.key} className="panel">
                <h2 className="panel-title">{dist.title}</h2>
                <ul className="dist-list">
                  {dist.rows.map((row) => (
                    <li key={row.label}>
                      <div className="row-between"><span>{row.label}</span><span className="num">{row.n} <span className="dim">({Math.round((row.n / total) * 100)}%)</span></span></div>
                      <div className="dist-bar"><span style={{ transform: `scaleX(${row.n / total})` }} /></div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  {d.professionLabel && <th>{d.professionLabel}</th>}
                  {d.columns.map((col) => <th key={col.key}>{col.label}</th>)}
                  <th>Dispositivo</th><th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {d.participants.map((p) => (
                  <tr key={p.responseId}>
                    <td className="num">{p.code}</td>
                    {d.professionLabel && <td>{p.profession}</td>}
                    {d.columns.map((col) => <td key={col.key}>{p.answers[col.key]}</td>)}
                    <td>{p.deviceClass ?? "—"}</td><td>{dateTime(p.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
