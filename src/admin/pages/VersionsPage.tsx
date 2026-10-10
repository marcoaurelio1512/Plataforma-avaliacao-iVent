import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, TooltipBox } from "../../components/charts/ChartTooltip.tsx";
import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api } from "../../lib/api.ts";
import { fmt } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { PageHeader } from "../components/PageHeader.tsx";
import type { Evolution } from "../components/VersionSnapshot.tsx";
import { useScope } from "../scope.tsx";

const SERIES = ["var(--series-a)", "var(--series-b)", "var(--series-c)", "var(--series-d)"];
const FOCUS = ["Interface", "Usabilidade", "Realismo fisiológico", "Desempenho", "Educação", "Avaliação geral"];

export default function VersionsPage() {
  const { filters, setFilter, professions } = useScope();
  const state = useAsync((signal) => api<Evolution>("/api/admin/versions/evolution", { query: { profession: filters.profession }, signal }), [filters.profession]);
  const ev = state.data;
  const versions = ev?.versions.filter((v) => ev.rows.some((r) => (r.byVersion[v.id]?.n ?? 0) > 0)) ?? [];
  const chartVersions = versions.slice(-4);
  const rank = (c: string) => (FOCUS.includes(c) ? FOCUS.indexOf(c) : FOCUS.length);
  const categories = [...(ev?.categories ?? [])].sort((x, y) => rank(x.category) - rank(y.category));
  const chartRows = categories.map((c) => ({ category: c.category, ...Object.fromEntries(chartVersions.map((v) => [v.id, c.byVersion[v.id]?.mean ?? undefined])), ...Object.fromEntries(chartVersions.map((v) => [`n_${v.id}`, c.byVersion[v.id]?.n ?? 0])) }));
  return (
    <>
      <PageHeader
        eyebrow="Comparação entre versões"
        title="Evolução do iVent"
        description="Somente perguntas metodologicamente compatíveis são comparadas: mesma chave, mesmo tipo e mesma escala. Linhas em que o texto mudou entre versões são sinalizadas."
      />
      <div className="filter-bar">
        <div className="field">
          <label htmlFor="v-prof">Profissão</label>
          <select id="v-prof" className="select" value={filters.profession ?? ""} onChange={(e) => setFilter("profession", e.target.value || undefined)}>
            <option value="">Todos</option>
            {professions.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
      </div>
      {state.loading && <Loading />}
      {state.error != null && <ErrorState error={state.error} />}
      {ev && versions.length === 0 && <Empty title="Ainda não há respostas associadas a versões do iVent" />}
      {ev && ev.unassignedResponses > 0 && <p className="panel-note">{ev.unassignedResponses} resposta(s) sem versão do iVent associada não entram nesta comparação.</p>}
      {ev && versions.length > 0 && (
        <>
          {versions.length < 2 && <div className="alert alert-info">Há avaliações de apenas uma versão. Cadastre a próxima versão em Configurações e associe-a a uma nova pesquisa (duplicar mantém as perguntas comparáveis).</div>}
          <section className="panel">
            <h2 className="panel-title">Média por categoria e versão (Likert 1–5)</h2>
            {versions.length > 4 && <p className="panel-note">O gráfico mostra as 4 versões mais recentes; a tabela abaixo traz todas.</p>}
            <div className="legend">
              {chartVersions.map((v, i) => <span key={v.id}><i style={{ background: SERIES[i] }} />{v.label}</span>)}
            </div>
            <div className="chart-box" style={{ height: Math.max(260, categories.length * 56) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barGap={2} barCategoryGap={12}>
                  <CartesianGrid horizontal={false} stroke="var(--axis-grid)" />
                  <XAxis type="number" domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
                  <YAxis type="category" dataKey="category" width={160} {...AXIS} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--surface-2)" }}
                    content={({ active, payload }) => {
                      const row = active && (payload?.[0]?.payload as Record<string, number | string> | undefined);
                      if (!row) return null;
                      return <TooltipBox title={String(row.category)} rows={chartVersions.map((v, i) => ({ label: v.label, value: `${fmt((row[v.id] as number) ?? null)} (n=${row[`n_${v.id}`]})`, swatch: SERIES[i] }))} />;
                    }}
                  />
                  {chartVersions.map((v, i) => <Bar key={v.id} dataKey={v.id} name={v.label} fill={SERIES[i]} radius={[0, 4, 4, 0]} isAnimationActive={false} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <h2 className="panel-title">Por pergunta</h2>
            <div className="table-wrap">
              <table className="table table-compact">
                <thead>
                  <tr><th>Pergunta</th><th>Compatível</th>{versions.map((v) => <th key={v.id} className="num">{v.label}</th>)}</tr>
                </thead>
                <tbody>
                  {ev.rows.map((r) => (
                    <tr key={r.key}>
                      <td title={r.text}>
                        <span className="num dim">{r.key}</span>
                        <div className="clamp-2">{r.text}</div>
                        {r.textVaries && <span className="badge badge-warning"><AlertTriangle size={12} /> texto mudou entre versões</span>}
                      </td>
                      <td>{r.compatible ? <span className="badge badge-ok">Sim</span> : <span className="badge badge-critical" title={r.incompatibilityReason ?? ""}>Não</span>}</td>
                      {versions.map((v) => {
                        const c = r.byVersion[v.id];
                        return <td key={v.id} className="num">{r.compatible && c?.n ? <>{fmt(c.mean)} <span className="dim">n={c.n}</span></> : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
