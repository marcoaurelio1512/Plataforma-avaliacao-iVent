import { useState } from "react";
import { GROUP_COMPARISON_NOTE } from "../../../shared/stats.ts";
import { PHYSIO, RESIDENT } from "../../../shared/domain.ts";
import { DistributionChart } from "../../components/charts/DistributionChart.tsx";
import { GroupBarsChart } from "../../components/charts/GroupBarsChart.tsx";
import { ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { fmt } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { SourceList } from "../components/SourceList.tsx";
import { useScope } from "../scope.tsx";
import type { GroupResult, TextDoc } from "../types.ts";

interface Side { topWords: { key: string; label: string; occurrences: number; participants: number }[]; themes: { theme: string; comments: number }[]; comments: TextDoc[]; commentCount: number }
interface Data { professions: { code: string; label: string }[]; result: GroupResult; sideA: Side; sideB: Side }

export default function ComparePage() {
  const { query, surveyId } = useScope();
  const [a, setA] = useState(RESIDENT);
  const [b, setB] = useState(PHYSIO);
  const state = useAsync((signal) => (surveyId ? api<Data>("/api/admin/compare", { query: { ...query, a, b }, signal }) : Promise.resolve(null)), [JSON.stringify(query), a, b]);
  const d = state.data;
  const r = d?.result;
  return (
    <>
      <PageHeader eyebrow="Comparação entre grupos" title={r ? `${r.groupA.label} × ${r.groupB.label}` : "Residentes × Fisioterapeutas"} description={GROUP_COMPARISON_NOTE} />
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="g-a">Grupo A</label>
          <select id="g-a" className="select" value={a} onChange={(e) => setA(e.target.value)}>
            {d?.professions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="g-b">Grupo B</label>
          <select id="g-b" className="select" value={b} onChange={(e) => setB(e.target.value)}>
            {d?.professions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <FilterBar show={["versionId", "from", "to", "iventVersionId"]} />
      {state.loading && <Loading />}
      {state.error != null && <ErrorState error={state.error} onRetry={state.reload} />}
      {d && r && (
        <>
          <div className="split">
            {[{ g: r.groupA, s: r.overall.a, tone: "a" }, { g: r.groupB, s: r.overall.b, tone: "b" }].map(({ g, s, tone }) => (
              <section key={g.code} className={`panel group-head group-${tone}`}>
                <p className="eyebrow">{g.label}</p>
                <div className="stat-strip">
                  <div><strong>{fmt(s.mean)}</strong><span>média geral (n={s.n} notas)</span></div>
                  <div><strong>{fmt(s.median, 1)}</strong><span>mediana</span></div>
                  <div><strong>{g.n}</strong><span>participantes</span></div>
                </div>
              </section>
            ))}
          </div>
          <section className="panel">
            <h2 className="panel-title">Média por pergunta</h2>
            <GroupBarsChart labelA={r.groupA.label} labelB={r.groupB.label} data={r.questions.filter((q) => q.scaleMin === 1 && q.scaleMax === 5).map((q, i) => ({ label: `Q${i + 1} · ${q.category ?? q.key}`, text: q.text, a: q.comparison.a.mean, b: q.comparison.b.mean, na: q.comparison.a.n, nb: q.comparison.b.n }))} />
            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr><th>Pergunta</th><th className="num">A n</th><th className="num">A média</th><th className="num">A mediana</th><th className="num">A DP</th><th className="num">B n</th><th className="num">B média</th><th className="num">B mediana</th><th className="num">B DP</th><th className="num">A − B</th></tr>
                </thead>
                <tbody>
                  {r.questions.map((q) => (
                    <tr key={q.questionId}>
                      <td title={q.text}>{q.category ?? q.key}</td>
                      <td className="num">{q.comparison.a.n}</td><td className="num">{fmt(q.comparison.a.mean)}</td><td className="num">{fmt(q.comparison.a.median, 1)}</td><td className="num">{fmt(q.comparison.a.sd)}</td>
                      <td className="num">{q.comparison.b.n}</td><td className="num">{fmt(q.comparison.b.mean)}</td><td className="num">{fmt(q.comparison.b.median, 1)}</td><td className="num">{fmt(q.comparison.b.sd)}</td>
                      <td className="num">{fmt(q.comparison.meanDifference)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="split">
            {[{ g: r.groupA, key: "distributionA" as const }, { g: r.groupB, key: "distributionB" as const }].map(({ g, key }) => (
              <section key={g.code} className="panel">
                <h2 className="panel-title">Distribuição das notas — {g.label}</h2>
                <DistributionChart data={r.questions.filter((q) => q.scaleMax === 5 && q.scaleMin === 1).map((q, i) => ({ position: i, key: q.key, category: q.category, text: q.text, n: q[key].reduce((s, f) => s + f.count, 0), frequencies: q[key] }))} />
              </section>
            ))}
          </div>
          <div className="split">
            {[{ g: r.groupA, s: d.sideA }, { g: r.groupB, s: d.sideB }].map(({ g, s }) => (
              <section key={g.code} className="panel">
                <h2 className="panel-title">Textos — {g.label}</h2>
                <p className="panel-note">{s.commentCount} texto(s)</p>
                <p className="field-label">Palavras mais frequentes</p>
                <div className="word-chips">
                  {s.topWords.length === 0 && <span className="muted">Sem textos.</span>}
                  {s.topWords.map((w) => <span key={w.key} className="badge">{w.label} <span className="dim num">{w.occurrences}·{w.participants}p</span></span>)}
                </div>
                <p className="field-label">Temas identificados (palavras-chave)</p>
                <ul className="dist-list">
                  {s.themes.map((t) => <li key={t.theme} className="row-between"><span>{t.theme}</span><span className="num">{t.comments}</span></li>)}
                </ul>
                <details>
                  <summary className="btn btn-sm">Ver comentários ({s.comments.length})</summary>
                  <SourceList docs={s.comments} />
                </details>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
