import { fmt } from "../../lib/format.ts";
import { PHYSIO, RESIDENT } from "../../../shared/domain.ts";
import type { Dashboard } from "../types.ts";

export function Kpis({ overview }: { overview: Dashboard["overview"] }) {
  const count = (code: string) => overview.byProfession.find((p) => p.code === code)?.count ?? 0;
  const others = overview.byProfession.filter((p) => p.code !== RESIDENT && p.code !== PHYSIO);
  const mean = overview.generalMean.mean;
  return (
    <section className="kpi-grid" aria-label="Indicadores">
      <div className="kpi kpi-hero">
        <span className="kpi-label">Média geral</span>
        <div>
          <span className="kpi-value num">{fmt(mean)}</span>
          <span className="kpi-sub num"> / 5</span>
        </div>
        <div>
          <div className="kpi-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${mean === null ? 0 : (mean - 1) / 4})` }} />
          </div>
          <p className="kpi-sub">Todas as notas válidas das perguntas Likert · n = {overview.generalMean.n}</p>
        </div>
      </div>
      <Kpi label="Participantes" value={overview.totalParticipants} />
      <Kpi label="Respostas concluídas" value={overview.completedResponses} />
      <Kpi label="Médicos residentes" value={count(RESIDENT)} tone="accent" />
      <Kpi label="Fisioterapeutas" value={count(PHYSIO)} tone="ok" />
      {others.map((o) => (
        <Kpi key={o.code} label={o.label} value={o.count} />
      ))}
      <Kpi label="Comentários por item" value={overview.commentCount} />
      <Kpi label="Respostas abertas" value={overview.openAnswerCount} />
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "accent" | "ok" }) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value num">{value}</span>
    </div>
  );
}
