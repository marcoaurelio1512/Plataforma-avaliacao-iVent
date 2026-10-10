import { FilterX } from "lucide-react";
import { useScope, type FilterKey } from "../scope.tsx";

export interface FilterBarProps {
  show?: FilterKey[];
  versions?: { id: string; number: number; responseCount: number }[];
  questions?: { key: string; text: string }[];
}

/** Filtros comuns às telas de análise; cada tela escolhe quais exibir. */
export function FilterBar({ show = ["versionId", "profession", "from", "to", "iventVersionId"], versions, questions }: FilterBarProps) {
  const { filters, setFilter, clearFilters, professions, iventVersions } = useScope();
  const has = (k: FilterKey) => show.includes(k);
  const active = show.some((k) => filters[k]);
  return (
    <div className="filter-bar" role="search" aria-label="Filtros">
      {has("versionId") && versions && versions.length > 1 && (
        <div className="field">
          <label htmlFor="f-version">Versão do questionário</label>
          <select id="f-version" className="select" value={filters.versionId ?? ""} onChange={(e) => setFilter("versionId", e.target.value || undefined)}>
            <option value="">Padrão (mais recente com respostas)</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>v{v.number} · {v.responseCount} resposta(s)</option>
            ))}
          </select>
        </div>
      )}
      {has("profession") && (
        <div className="field">
          <label htmlFor="f-prof">Profissão</label>
          <select id="f-prof" className="select" value={filters.profession ?? ""} onChange={(e) => setFilter("profession", e.target.value || undefined)}>
            <option value="">Todos</option>
            {professions.map((p) => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>
      )}
      {has("questionKey") && questions && (
        <div className="field">
          <label htmlFor="f-q">Pergunta</label>
          <select id="f-q" className="select" value={filters.questionKey ?? ""} onChange={(e) => setFilter("questionKey", e.target.value || undefined)}>
            <option value="">Todas</option>
            {questions.map((q) => (
              <option key={q.key} value={q.key}>{q.text.length > 70 ? `${q.text.slice(0, 70)}…` : q.text}</option>
            ))}
          </select>
        </div>
      )}
      {has("iventVersionId") && iventVersions.length > 0 && (
        <div className="field">
          <label htmlFor="f-iv">Versão do iVent</label>
          <select id="f-iv" className="select" value={filters.iventVersionId ?? ""} onChange={(e) => setFilter("iventVersionId", e.target.value || undefined)}>
            <option value="">Todas</option>
            {iventVersions.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
      )}
      {has("from") && (
        <div className="field field-date">
          <label htmlFor="f-from">De</label>
          <input id="f-from" type="date" className="input" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value || undefined)} />
        </div>
      )}
      {has("to") && (
        <div className="field field-date">
          <label htmlFor="f-to">Até</label>
          <input id="f-to" type="date" className="input" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value || undefined)} />
        </div>
      )}
      {active && (
        <button type="button" className="btn btn-ghost filter-clear" onClick={clearFilters}>
          <FilterX /> Limpar filtros
        </button>
      )}
    </div>
  );
}
