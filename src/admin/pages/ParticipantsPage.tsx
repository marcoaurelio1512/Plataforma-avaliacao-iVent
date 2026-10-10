import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { dateTime } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { useScope } from "../scope.tsx";

interface Data {
  participants: { code: string; responseId: string; profession: string; experienceYears: string; simulatorExperience: string; iventExperience: string; deviceClass: string | null; submittedAt: string }[];
  distributions: Record<"profession" | "experienceYears" | "simulatorExperience" | "iventExperience" | "device", { label: string; n: number }[]>;
}

const DIST_TITLES: Record<keyof Data["distributions"], string> = {
  profession: "Categoria profissional",
  experienceYears: "Tempo de experiência",
  simulatorExperience: "Experiência com simuladores",
  iventExperience: "Experiência com o iVent",
  device: "Dispositivo usado",
};

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
            {(Object.keys(DIST_TITLES) as (keyof Data["distributions"])[]).map((k) => (
              <section key={k} className="panel">
                <h2 className="panel-title">{DIST_TITLES[k]}</h2>
                <ul className="dist-list">
                  {d.distributions[k].map((row) => (
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
                <tr><th>Código</th><th>Profissão</th><th>Experiência</th><th>Simuladores</th><th>iVent</th><th>Dispositivo</th><th>Enviado em</th></tr>
              </thead>
              <tbody>
                {d.participants.map((p) => (
                  <tr key={p.responseId}>
                    <td className="num">{p.code}</td><td>{p.profession}</td><td>{p.experienceYears}</td><td>{p.simulatorExperience}</td><td>{p.iventExperience}</td><td>{p.deviceClass ?? "—"}</td><td>{dateTime(p.submittedAt)}</td>
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
