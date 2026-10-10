import { Info } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api.ts";
import { fmt } from "../../lib/format.ts";
import { Loading, ErrorState } from "../../components/States.tsx";
import { useAsync } from "../../lib/useAsync.ts";
import { useScope } from "../scope.tsx";
import type { Dashboard, PriorityItem, TextDoc } from "../types.ts";
import { Drawer } from "./Drawer.tsx";
import { SourceList } from "./SourceList.tsx";

export function Priorities({ data }: { data: Dashboard["priorities"] }) {
  const [selected, setSelected] = useState<PriorityItem | null>(null);
  const items = data.items.slice(0, 8);
  return (
    <>
      {items.length === 0 ? (
        <p className="muted">Ainda não há dados suficientes para priorizar.</p>
      ) : (
        <ol className="priority-list">
          {items.map((p, i) => (
            <li key={p.theme}>
              <button type="button" className="priority-item priority-btn" onClick={() => setSelected(p)} disabled={!p.comments}>
                <span className="priority-rank">{i + 1}</span>
                <span className="stack-sm">
                  <strong>{p.theme}</strong>
                  <span className="priority-meta">
                    <span>Nota média: <b className="num">{p.mean === null ? "sem nota" : `${fmt(p.mean, 1)}/5`}</b>{p.mean !== null && <span className="dim"> (n={p.meanN})</span>}</span>
                    <span><b className="num">{p.comments}</b> comentário(s) relacionados</span>
                    <span><b className="num">{p.participants}</b> participante(s)</span>
                  </span>
                </span>
                <span className={`badge level-${p.level}`}>Prioridade: {p.level}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="panel-note row">
        <Info size={14} aria-hidden="true" />
        Fonte dos temas: {data.source === "ai" ? "última análise por IA" : "palavras-chave (determinística)"}. {data.formula}
      </p>
      {selected && <PriorityDrawer item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function PriorityDrawer({ item, onClose }: { item: PriorityItem; onClose: () => void }) {
  const { query } = useScope();
  const docs = useAsync((signal) => api<TextDoc[]>("/api/admin/priorities/docs", { query: { ...query, ids: item.docIds.join(",") }, signal }), [item.theme]);
  return (
    <Drawer open title={item.theme} subtitle={`${item.comments} comentário(s) que fundamentam este item · prioridade ${item.level}`} onClose={onClose}>
      {item.relatedQuestions.length > 0 && (
        <p className="muted">Perguntas relacionadas: {item.relatedQuestions.map((q) => q.key).join(", ")}</p>
      )}
      {docs.loading && <Loading />}
      {docs.error != null && <ErrorState error={docs.error} onRetry={docs.reload} />}
      {docs.data && <SourceList docs={docs.data} />}
    </Drawer>
  );
}
