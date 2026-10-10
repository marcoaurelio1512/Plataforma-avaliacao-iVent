import { api } from "../../lib/api.ts";
import { fmt } from "../../lib/format.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { Loading } from "../../components/States.tsx";

export interface Evolution {
  versions: { id: string; label: string; releasedAt: string | null }[];
  rows: {
    key: string;
    text: string;
    category: string | null;
    type: string;
    scaleMin: number;
    scaleMax: number;
    compatible: boolean;
    incompatibilityReason: string | null;
    textVaries: boolean;
    byVersion: Record<string, { n: number; mean: number | null; median: number | null; sd: number | null }>;
  }[];
  categories: { category: string; byVersion: Record<string, { n: number; mean: number | null }> }[];
  unassignedResponses: number;
}

/** Resumo compacto: média por categoria em cada versão do iVent. */
export function VersionSnapshot() {
  const state = useAsync((signal) => api<Evolution>("/api/admin/versions/evolution", { signal }), []);
  if (state.loading) return <Loading />;
  const ev = state.data;
  if (!ev) return null;
  const withData = ev.versions.filter((v) => ev.categories.some((c) => (c.byVersion[v.id]?.n ?? 0) > 0));
  if (withData.length < 2) {
    return <p className="muted">Há respostas para {withData.length} versão(ões) do iVent. A comparação aparece quando houver avaliações de pelo menos duas versões.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Categoria</th>
            {withData.map((v) => (
              <th key={v.id} className="num">{v.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ev.categories.map((c) => (
            <tr key={c.category}>
              <td>{c.category}</td>
              {withData.map((v) => (
                <td key={v.id} className="num">{fmt(c.byVersion[v.id]?.mean ?? null)} <span className="dim">n={c.byVersion[v.id]?.n ?? 0}</span></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
