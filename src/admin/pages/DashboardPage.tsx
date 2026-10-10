import { ArrowRight, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { DistributionChart } from "../../components/charts/DistributionChart.tsx";
import { GroupBarsChart } from "../../components/charts/GroupBarsChart.tsx";
import { MeansChart } from "../../components/charts/MeansChart.tsx";
import { TimelineCharts } from "../../components/charts/TimelineCharts.tsx";
import { shortLabel } from "../../components/charts/ChartTooltip.tsx";
import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { date, fmt, scoreTone } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { Kpis } from "../components/Kpis.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { Priorities } from "../components/Priorities.tsx";
import { VersionSnapshot } from "../components/VersionSnapshot.tsx";
import { useScope, useScopedLink } from "../scope.tsx";
import type { Dashboard, QuestionStats } from "../types.ts";

export default function DashboardPage() {
  const { query, surveyId, surveysLoading, filters } = useScope();
  const link = useScopedLink();
  const state = useAsync((signal) => (surveyId ? api<Dashboard>("/api/admin/dashboard", { query, signal }) : Promise.resolve(null)), [JSON.stringify(query)]);

  if (surveysLoading) return <Loading />;
  if (!surveyId) {
    return (
      <Empty title="Nenhuma pesquisa cadastrada">
        <Link to="/admin/pesquisas/nova">Criar questionário</Link>
      </Empty>
    );
  }
  const d = state.data;
  const likert = d?.stats.filter((s) => s.scale && s.type === "likert") ?? [];
  const byId = new Map(d?.stats.map((s) => [s.questionId, s]) ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard de Avaliação iVent NeoPed"
        title={d?.survey.title ?? "Carregando…"}
        description={
          d && (
            <span>
              Questionário v{d.version.number}
              {d.survey.iventVersionLabel && ` · ${d.survey.iventVersionLabel}`}
              {d.overview.firstSubmission && ` · respostas de ${date(d.overview.firstSubmission)} a ${date(d.overview.lastSubmission)}`}
            </span>
          )
        }
        actions={
          <Link className="btn" to={link("/admin/relatorios")}>
            Relatórios <ArrowRight />
          </Link>
        }
      />
      <FilterBar versions={d?.versions} />
      {state.loading && !d && <Loading />}
      {state.error != null && <ErrorState error={state.error} onRetry={state.reload} />}
      {d && d.overview.completedResponses === 0 && (
        <Empty title={Object.keys(filters).length ? "Nenhuma resposta com estes filtros" : "Ainda não há respostas"} icon={<Share2 />}>
          Publique a pesquisa e compartilhe o link ou QR Code em <Link to={link("/admin/pesquisas")}>Pesquisas</Link>.
        </Empty>
      )}
      {d && d.overview.completedResponses > 0 && (
        <>
          <Kpis overview={d.overview} />
          <div className="panel-grid">
            <section className="panel panel-8" aria-labelledby="p-means">
              <div className="panel-head">
                <h2 id="p-means" className="panel-title">Média de cada pergunta</h2>
                <span className="panel-note">“Não utilizei” e “Não se aplica” fora do cálculo</span>
              </div>
              <MeansChart
                data={likert.map((s) => ({ position: s.position, key: s.key, category: s.category, text: s.text, mean: s.scale!.mean, median: s.scale!.median, sd: s.scale!.sd, n: s.scale!.validN, notUsed: s.scale!.notUsed + s.scale!.notApplicable }))}
              />
            </section>
            <section className="panel panel-4" aria-labelledby="p-rank">
              <h2 id="p-rank" className="panel-title">Destaques</h2>
              <RankList title="Mais bem avaliadas" items={d.top.map((id) => byId.get(id)!).filter(Boolean)} />
              <RankList title="Menores avaliações" items={d.bottom.map((id) => byId.get(id)!).filter(Boolean)} />
            </section>
            <section className="panel" aria-labelledby="p-dist">
              <div className="panel-head">
                <h2 id="p-dist" className="panel-title">Distribuição das notas 1–5</h2>
                <span className="panel-note">Percentual sobre respostas válidas de cada pergunta</span>
              </div>
              <DistributionChart data={likert.map((s) => ({ position: s.position, key: s.key, category: s.category, text: s.text, n: s.scale!.validN, frequencies: s.scale!.frequencies }))} />
            </section>
            <section className="panel" aria-labelledby="p-improve">
              <div className="panel-head">
                <h2 id="p-improve" className="panel-title">Principais oportunidades de melhoria</h2>
                <span className="badge">Ferramenta operacional — não é evidência científica</span>
              </div>
              <Priorities data={d.priorities} />
            </section>
            <section className="panel" aria-labelledby="p-groups">
              <div className="panel-head">
                <div className="stack-sm">
                  <h2 id="p-groups" className="panel-title">{d.groups.groupA.label} × {d.groups.groupB.label}</h2>
                  <p className="panel-note">
                    n = {d.groups.groupA.n} × {d.groups.groupB.n} · média geral {fmt(d.groups.overall.a.mean)} × {fmt(d.groups.overall.b.mean)}. {d.groups.overall.note}
                  </p>
                </div>
                <Link className="btn btn-sm" to={link("/admin/grupos")}>Comparação detalhada <ArrowRight /></Link>
              </div>
              <GroupBarsChart
                labelA={d.groups.groupA.label}
                labelB={d.groups.groupB.label}
                data={d.groups.questions.filter((q) => q.scaleMin === 1 && q.scaleMax === 5).map((q) => {
                  const s = d.stats.find((x) => x.questionId === q.questionId);
                  return { label: shortLabel(s?.position ?? 0, q.category, q.key), text: q.text, a: q.comparison.a.mean, b: q.comparison.b.mean, na: q.comparison.a.n, nb: q.comparison.b.n };
                })}
              />
            </section>
            <section className="panel panel-7" aria-labelledby="p-time">
              <h2 id="p-time" className="panel-title">Evolução das avaliações</h2>
              <TimelineCharts data={d.timeline} />
            </section>
            <section className="panel panel-5" aria-labelledby="p-versions">
              <div className="panel-head">
                <h2 id="p-versions" className="panel-title">Versões do iVent</h2>
                <Link className="btn btn-sm" to={link("/admin/versoes")}>Detalhes <ArrowRight /></Link>
              </div>
              <VersionSnapshot />
            </section>
          </div>
        </>
      )}
    </>
  );
}

function RankList({ title, items }: { title: string; items: QuestionStats[] }) {
  return (
    <div className="stack-sm">
      <p className="eyebrow">{title}</p>
      <ol className="rank-list">
        {items.map((s) => (
          <li key={s.questionId} className="rank-item" title={s.text}>
            <span className="num dim">Q{s.position + 1}</span>
            <span className="clamp-2">{s.category ?? s.text}</span>
            <span className={`rank-score num tone-${scoreTone(s.scale!.mean)}`}>{fmt(s.scale!.mean, 1)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
