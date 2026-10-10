import { Download, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, ErrorState, Loading } from "../../components/States.tsx";
import { api, download, errorMessage } from "../../lib/api.ts";
import { useAsync } from "../../lib/useAsync.ts";
import { FilterBar } from "../components/FilterBar.tsx";
import { PageHeader } from "../components/PageHeader.tsx";
import { SourceList } from "../components/SourceList.tsx";
import { useScope } from "../scope.tsx";
import type { TextDoc } from "../types.ts";

interface Data { total: number; questions: { key: string; text: string }[]; items: TextDoc[] }

export default function CommentsPage() {
  const { query, surveyId, filters, setFilter } = useScope();
  const [search, setSearch] = useState(filters.search ?? "");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("recent");
  const [exportError, setExportError] = useState<string | null>(null);

  // Busca com pequeno atraso para não consultar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setFilter("search", search.trim() || undefined), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const state = useAsync(
    (signal) => (surveyId ? api<Data>("/api/admin/comments", { query: { ...query, kind, sort }, signal }) : Promise.resolve(null)),
    [JSON.stringify(query), kind, sort],
  );
  const d = state.data;

  return (
    <>
      <PageHeader
        eyebrow="Textos livres"
        title="Comentários e Sugestões"
        description="Todas as respostas abertas e os comentários por item, exatamente como foram escritos."
        actions={
          <button type="button" className="btn" onClick={() => download("/api/admin/reports/csv", { ...query, kind: "comentarios" }).catch((e) => setExportError(errorMessage(e)))}>
            <Download /> Exportar CSV
          </button>
        }
      />
      <div className="search-row">
        <div className="search-box">
          <Search aria-hidden="true" />
          <label htmlFor="c-search" className="sr-only">Pesquisar por palavra</label>
          <input id="c-search" className="input" type="search" placeholder="Pesquisar por palavra…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" aria-label="Origem" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Abertas e comentários</option>
          <option value="open">Somente perguntas abertas</option>
          <option value="comment">Somente comentários por item</option>
        </select>
        <select className="select" aria-label="Ordenação" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="profession">Por profissão</option>
          <option value="question">Por pergunta</option>
          <option value="length">Mais longos</option>
        </select>
      </div>
      <FilterBar show={["versionId", "profession", "questionKey", "from", "to", "iventVersionId"]} questions={d?.questions} />
      {exportError && <div className="alert alert-error">{exportError}</div>}
      {state.loading && <Loading />}
      {state.error != null && <ErrorState error={state.error} onRetry={state.reload} />}
      {d && <p className="muted"><b className="num">{d.total}</b> texto(s) encontrado(s){d.total > d.items.length ? ` — exibindo os ${d.items.length} primeiros` : ""}.</p>}
      {d && d.items.length === 0 && <Empty title="Nenhum texto encontrado" />}
      {d && d.items.length > 0 && <SourceList docs={d.items} search={filters.search} />}
    </>
  );
}
